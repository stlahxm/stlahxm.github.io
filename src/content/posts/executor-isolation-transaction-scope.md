---
title: "AI 응답 대기 중 커넥션까지 물고 있던 문제, Executor 분리와 트랜잭션 범위 축소로 해결"
description: "AI 응답 대기 중 톰캣 스레드와 DB 커넥션이 함께 점유돼 서비스 전체가 마비되던 문제를 전용 Executor 분리와 트랜잭션 범위 축소로 해결한 기록"
pubDate: 2026-06-02
category: "경력"
tags: ["동시성", "Spring", "트랜잭션", "커넥션풀"]
metric: "p95 47.2s → 2.8s (93.9%↓), 처리량 3.4배↑"
stats:
  - label: "p95 지연 시간"
    value: "47.2s → 2.8s"
  - label: "처리량"
    value: "3.4배 향상"
  - label: "비동기 API 평균 응답"
    value: "3,600ms → 10ms 미만"
badge: "TX"
cover: "/covers/executor-isolation-transaction-scope.webp"
---

STT → Chat → Point로 이어지는 AI 대화 체인은 각 단계가 외부 AI 엔진과 통신합니다. Blocking I/O 기반의 Spring Boot(Tomcat)

구조에서는 요청 하나가 들어오면 워커 스레드 하나가 할당되고, 외부 응답을 기다리는 동안 그 스레드는 CPU를 쓰지 않으면서도 다른 요청을 처리하지 못한 채 점유 상태로 남습니다. 이번 개선은 이 체인의 병목을 두 차례에 걸쳐 다른 자원에서 발견하고, 그때마다 다시 측정해 다음 병목을 찾아간 기록입니다.

## 물리적으로는 6초, 실제로는 9초

100 VU 기준 Baseline 부하 테스트에서 STT·Chat·Point 각각을 2,000ms Mock 지연으로 고정하고 측정했습니다. 물리적으로는 6,000ms(2,000ms × 3)면 끝나야 할 체인이었는데, 실제 p95 지연 시간은 9,047ms로 나왔습니다.

예상보다 약 3,000ms가 더 걸리고 있었습니다.

### 애플리케이션 처리 시간이 아니라 Queueing Delay였다

Glowroot APM으로 트랜잭션 내부를 보면 STT/Chat/Point 개별 응답 시간은 모두 2,000ms~2,010ms로 일정했습니다. Mock이 항상 일정한 지연을 유지했는데도 전체 p95가 9초를 넘었다는 것은, 외부 API 지연값이 흔들려서 생긴 문제가 아니라는 뜻이었습니다.

JVM Thread Stats를 확인하니 `Waited time`은 약 1,700~2,000ms인데 `Blocked time`은 0ms였습니다. Blocked time이 0ms라는 건 DB Lock이나 synchronized lock 같은 자원 경합으로 막힌 게 아니라는 의미고, Waited time이 2초에 가깝다는 건 스레드가 외부 응답을 TIMED_WAITING 상태로 기다리며 자원을 점유하고 있었다는 의미였습니다.

k6가 관찰한 전체 p95(9,047ms)와 Glowroot가 기록한 내부 처리 시간(약 6,000ms) 사이의 약 3초 간극은, Tomcat 워커 스레드를 할당받기 전 Accept Queue에서 대기한 시간이었습니다.

100명의 유저가 각각 6초 동안 스레드를 점유하면서 Tomcat 워커 스레드 풀 자체가 포화 상태에 가까워졌던 것입니다.

## 스레드 병목을 풀었더니 DB 커넥션 병목이 드러났다

유저 플로우를 다시 보면 STT와 Chat은 대화 화면에 즉시 반영돼야 하지만, Point(발음 점수 분석·DB 저장)는 사용자가 대화방을 나간 뒤에야 확인하는 값이라 실시간일 필요가 없었습니다. Point를 `@Async`와 전용 Executor로 분리해 메인 대화 흐름에서 떼어냈습니다.

그런데 재측정 결과 p95 지연 시간이 오히려 47,223ms까지 폭증했습니다. Glowroot에서 확인하니 전체 실행 시간의 97~99%가 `jdbc get connection` 구간에 몰려 있었고, HikariCP 로그에는 다음 메시지가 남아 있었습니다.

```
HikariPool-1 - Connection is not available, request timed out after 30008ms (waiting=80)
```

병목이 사라진 게 아니라 자리를 옮긴 것이었습니다. 원인은 다음 순서였습니다.

```
1. 비동기 스레드 풀이 포화됨
2. 설정된 큐가 가득 참
3. CallerRunsPolicy가 발동됨
4. Tomcat 워커 스레드가 직접 외부 AI API 호출 같은 긴 I/O 작업을 수행함
5. 외부 AI API 호출 구간이 @Transactional 범위 안에 포함됨
6. 외부 API 응답을 기다리는 수 초 동안 DB 커넥션이 반납되지 않음
7. HikariCP 커넥션 풀이 고갈됨
```

```
Tomcat Thread Starvation
        ↓ (비동기 격리로 해소)
DB Connection Pool Exhaustion
        ↓ (여전히 남은 문제)
```

여기서 확인한 건 "커넥션 개수가 부족하다"가 아니라 "각 커넥션이 실제 DB 작업과 무관한 시간까지 너무 오래 점유된다"는 점이었습니다. 스레드를 격리하는 조치만으로는, 그 스레드가 트랜잭션 안에서 외부 I/O를 기다리는 구조 자체는 그대로 남아있었던 것입니다.

## 증설이 아니라 점유 시간을 줄이는 쪽으로

두 가지 방향을 비교했습니다.

1. **DB 커넥션 풀·서버 인프라 증설**
   - 장점: 코드 변경 범위가 작고, 단기적으로 더 많은 요청을 받아낼 수 있습니다.
   - 단점: 커넥션이 오래 점유되는 구조 자체는 그대로 남아 부하가 다시 늘면 같은 증상이 재발합니다. 근본 해결이 아니라고 판단해 기각했습니다.
2. **비동기 스레드 구조 격리와 트랜잭션 범위 최소화 (채택)**
   - 장점: 비동기 풀을 명확히 격리하고 트랜잭션 범위를 실제 DB 작업 구간으로 줄이면, 지속 가능성과 비용 효율성이 함께 확보됩니다.
   - 단점: 트랜잭션 범위를 쪼개는 만큼 원자성의 범위도 함께 줄어들어, 중간 실패 상태를 별도로 관리해야 합니다.

```java
// 개선 전: 외부 I/O가 트랜잭션에 포함된 구조
@Transactional
public void processAiJob(...) {
    List<SourceData> sourceList = repository.findSourceData(...);
    // 응답 대기 시간 동안 커넥션 점유 유지
    List<AiResult> results = externalAiClient.requestAnalysis(...);
    repository.saveAll(results);
}
```

```java
// 개선 후: 외부 I/O와 트랜잭션의 엄격한 분리
public void processAiJob(...) {
    List<SourceData> sourceList = repository.findSourceData(...);
    // 트랜잭션 범위 밖에서 수행 — 대기 중 DB 커넥션을 점유하지 않는다
    List<AiResult> results = externalAiClient.requestAnalysis(...);
    // 실제 저장 시점에만 최소한의 트랜잭션 유지
    saveResultsAtomic(userId, jobId, results);
}

@Transactional
public void saveResultsAtomic(...) {
    repository.deletePreviousResults(...);
    repository.saveAll(...);
}
```

트랜잭션을 이렇게 쪼개면 외부 API 호출은 성공했는데 DB 저장이 실패하는 중간 상태가 생길 수 있습니다. 이 트레이드오프를 감수하는 대신, 실제 저장 구간(`saveResultsAtomic`)만큼은 여전히 하나의 트랜잭션으로 원자성을 보장하도록 남겨뒀습니다.

## 엣지 케이스: 무한 대기보다 안전한 실패

비동기 실행기 튜닝도 함께 다뤘습니다. 처음에는 스레드 수를 무작정 늘리는 방법도 고려했지만, 스레드가 늘어날수록 각 스레드의 Stack 메모리, CPU context switching 비용, GC 효율 저하가 함께 증가해 오히려 처리량을 갉아먹을 위험이 있었습니다.

대신 시스템이 감당 가능한 수준을 실험으로 찾고, 초과 요청은 빠르게 실패시키는 방향을 선택했습니다. 500 VU 규모의 극한 부하 테스트를 세 단계로 나눠 검증했습니다.

| 단계 | 설정 | 결과 |
| --- | --- | --- |
| 1단계 | 10 / 10 / 0 / AbortPolicy | 100% 실패 — Tomcat 레벨 Connection Refused, 비동기 격리벽 도달 전 병목 |
| 2단계 | 50 / 50 / 0 / AbortPolicy | 여전히 100% 실패 — 병목이 인증 단계의 동시다발적 DB 조회에 있음을 확인 |
| 3단계 | 50 / 50 / 200 / AbortPolicy | 성공률 52%, p95 7.7초 — 초과 요청 48%를 안전하게 거절 |

3단계에서 중요한 건 성공률이 100%가 아니었다는 점이 아니라, 초과 요청 48%를 안전하게 거절했다는 점이었습니다. 이전에는 과부하 상황에서 서버 전체가 마비될 수 있었지만, 개선 후에는 감당 가능한 요청에는 예측 가능한 응답을, 감당 불가능한 요청에는 빠른 실패를 돌려줄 수 있게 됐습니다.

또한 HikariCP의 `connection-timeout`을 5초로, `leak-detection-threshold`를 10초로 설정해 커넥션이 무한정 대기하지 않고 빠르게 실패하면서, 비정상적으로 긴 점유는 로그로 감지할 수 있게 했습니다.

핵심 병목은 "프레임워크가 Blocking인가?" 자체가 아니라 "느린 외부 I/O가 Tomcat 스레드와 DB 커넥션을 얼마나 오래 점유하는가"였습니다. MyBatis/JDBC 기반의 Blocking 데이터 액세스 계층이 남아있는 한 WebFlux로 전환해도 완전한 효과를 얻기 어려웠고, 전용 Executor 격리와 트랜잭션 다이어트가 현재 병목을 더 직접적으로 겨냥했습니다.

## 결과 및 회고

동일 조건에서 재측정한 최종 결과입니다.

| 지표 | 개선 전/중간 상태 | 최종 개선 후 |
| --- | --- | --- |
| p95 지연 시간 | 약 47.2초 | 약 2.8초 |
| 처리량 | 1x | 3.4배 |
| 비동기 API 평균 응답 | 약 3,600ms | 10ms 미만 |

1. **성능 문제는 속도가 아니라 리소스가 얼마나 오래 점유되는지의 문제였습니다.** Tomcat 워커 스레드, 비동기 Executor 스레드, HikariCP DB 커넥션, 트랜잭션 범위 각각의 Holding Time을 줄이는 것이 실제 개선이었습니다.
2. **병목은 사라지는 것이 아니라 이동합니다.** Point를 비동기로 분리하자 Tomcat 스레드 병목은 완화됐지만, 곧바로 DB 커넥션 풀이 새로운 병목으로 드러났습니다. 하나의 병목을 해결한 뒤에는 반드시 재측정해야 다음 병목이 어디로 옮겨갔는지 알 수 있습니다.
3. **외부 시스템의 지연은 완전히 통제할 수 없지만, 그 지연이 내부 핵심 자원(Tomcat 스레드, DB 커넥션)까지 함께 묶이게 둘 필요는 없었습니다.** 실행 경계를 다시 설계하는 것이 외부 API 자체를 빠르게 만드는 것보다 훨씬 통제 가능한 해법이었습니다.
