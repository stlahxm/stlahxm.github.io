---
title: "순차 호출 8개, 커넥션을 7초 넘게 붙잡던 구조 고치기"
description: "외부 API를 순차 호출하며 응답 대기 중에도 커넥션을 붙잡던 구조를, CompletableFuture 병렬 실행과 커넥션 점유 시간 분리로 해결한 기록"
pubDate: 2026-05-10
category: "경력"
tags: ["동시성", "Spring", "커넥션풀"]
metric: "p95 응답 속도 7.2s → 363ms 단축"
stats:
  - label: "p95 응답 지연"
    value: "7.2s → 363ms"
  - label: "DB 커넥션 점유 시간"
    value: "7.2s → 0.1s 미만"
  - label: "150 VUs 요청 실패율"
    value: "100% → 0%"
badge: "Async"
cover: "/covers/completablefuture-connection-scope.png"
coverFit: "logo"
---

## 부하 테스트 로그가 보여준 것

k6로 150 VUs 동시 접속 부하 테스트를 돌렸을 때, 서버는 1초도 버티지 못하고 접속을 즉시 거절하며 실패율 100%를 기록했습니다. 기능 테스트에서는 전혀 드러나지 않던 증상이었습니다.

사용자 한 명이 순서대로 요청을 보내는 동안에는 아무 문제가 없었기 때문입니다.

원인을 좁혀가기 전에, 먼저 정상 흐름부터 다시 봤습니다. 사용자 요청이 들어오면 서버는 데이터를 8건의 외부 AI API에 순차로 넘겨 점수를 계산하고, 그 결과를 DB에 이력으로 저장합니다.

이 8건의 API 호출, 계산, DB 쓰기가 전부 하나의 `@Transactional` 메서드 안에 동기식으로 묶여 있었습니다.

```
[사용자 요청]
       ↓
[Tomcat 요청 스레드 획득]
       ↓
[@Transactional 트랜잭션 시작 (DB 커넥션 점유 시작)]
       ↓
[외부 AI API 1 ~ 8 순차 호출 (누적 대기 시간 p95 7.2초)] ── DB I/O는 없으나 커넥션 미반납
       ↓
[점수 계산 및 DB 쓰기 반영]
       ↓
[트랜잭션 커밋 및 커넥션 반납]
```

## 왜 "느린 API"가 아니라 "커넥션 고갈"이었나

`@Transactional`은 DB에 쓰기 작업이 있는 메서드라면 습관적으로 붙이게 되는 어노테이션입니다. 문제는 이 어노테이션이 "쓰기 작업을 하는 동안"이 아니라 "메서드가 시작해서 끝날 때까지" DB 커넥션을 붙잡는다는 점입니다.

메서드 안에 DB와 무관한 대기 시간, 특히 외부 네트워크 호출이 섞여 있으면 그 대기 시간까지 통째로 커넥션 점유 시간에 더해집니다.

HikariCP 커넥션 풀의 물리 한도는 기본값인 10개였습니다. 8건의 외부 API를 순차 호출하는 7.2초 동안 `@Transactional`이 활성 상태로 커넥션을 쥐고 있었기 때문에, 동시 요청이 10건을 넘는 순간 나머지 요청은 커넥션을 아예 받지 못하고 대기 상태로 밀렸습니다.

여기에 Tomcat 스레드 풀 문제까지 겹쳤습니다. 외부 API 호출을 동기로 대기하는 요청 스레드가 늘어나면서 Tomcat 스레드마저 함께 포화됐고, 신규 유저는 요청 스레드를 배정받지 못한 채 큐잉 지연으로 연결이 거절되는 상황까지 이어졌습니다.

병목의 실체는 "외부 API가 느리다"가 아니라, "느린 외부 API 호출을 트랜잭션이 함께 붙잡고 있어 커넥션 점유 시간이 그대로 늘어난다"는 것이었습니다.

## 대안이 하나씩 걸러진 이유

리소스 점유 시간을 줄이기 위해 세 가지 방안을 검토했습니다.

**Spring WebFlux 완전 논블로킹 전환**은 스레드 점유 없이 수만 개의 동시 요청을 처리할 수 있다는 장점이 있었지만, 기존 코드베이스가 JDBC 기반 블로킹 DB 액세스 계층 위에 있어 프레임워크 전체를 리액티브로 전환하는 리팩토링 비용이 이 문제의 크기에 비해 과도했습니다. 기각했습니다.

**동일 클래스 내에서 트랜잭션 메서드만 분리 호출**하는 방법은 클래스 구조 변경이 최소화된다는 점에서 매력적이었지만, 같은 클래스 안에서 `@Transactional` 메서드를 직접 호출하면 Spring AOP 프록시를 거치지 않아 트랜잭션 자체가 동작하지 않는 자가 호출(Self-Invocation) 문제가 그대로 재현됩니다. 배제했습니다.

**영속성 서비스를 별도 빈으로 물리 분리**하는 방법을 최종 채택했습니다. "DB 커넥션은 실제 쓰기 작업이 일어나는 순간에만 점유한다"는 원칙을 코드 구조로 강제할 수 있다는 게 결정적이었습니다. 클래스가 하나 늘어나는 비용은, 커넥션 고갈이라는 장애의 크기에 비하면 감수할 만하다고 판단했습니다.

```java
@Service
@RequiredArgsConstructor
public class AsyncAnalysisService {

    private final PersistenceService persistenceService;

    @Async("reportExecutor")
    public void processFullAnalysis(int requestNo, String input) {
        // DB 커넥션을 전혀 쥐지 않은 상태로 외부 API 8개 병렬 호출
        List<Map<String, Object>> aiResults = callAiApisParallel(input);
        Score score = scoreDomain.calculate(aiResults);

        // 여기서 처음으로 프록시를 통해 트랜잭션 경계에 진입
        persistenceService.saveResults(requestNo, score);
    }
}

@Service
@RequiredArgsConstructor
public class PersistenceService {

    private final ResultMapper resultMapper;

    @Transactional
    public void saveResults(int requestNo, Score score) {
        // 이 메서드가 실행되는 밀리초 단위 구간에만 커넥션 점유
        resultMapper.updateResult(requestNo, score);
        resultMapper.insertRecord(requestNo, score);
    }
}
```

8개의 외부 API 호출은 서로 의존성이 없었기 때문에 `CompletableFuture.allOf()`로 병렬화했고, 특정 호출이 느려져도 전체가 물려 대기하지 않도록 `orTimeout`과 `exceptionally`를 함께 걸었습니다.

```java
private CompletableFuture<Map<String, Object>> callWithFallback(
        String type,
        Supplier<Map<String, Object>> supplier,
        int requestNo
) {
    return CompletableFuture
        .supplyAsync(supplier, reportExecutor)
        .orTimeout(20, TimeUnit.SECONDS)
        .exceptionally(ex -> {
            log.warn("[Analysis] AI call timeout/failed. type={}, requestNo={}", type, requestNo);
            return Collections.emptyMap();
        });
}
```

비동기로 넘어간 작업이 실패했을 때 그 실패가 조용히 사라지지 않도록, 실패 이력을 상태 코드로 DB에 강제로 마킹해 장애 모니터링에서 놓치지 않게 했습니다.

## 재측정

150 VUs 동시 접속 조건에서 재측정한 결과입니다.

| 구분 | 지표 | 개선 전 | 개선 후 |
| --- | --- | --- | --- |
| 속도 | p95 응답 지연 | 7.2s | 363ms |
| 인프라 | DB 커넥션 점유 시간 | 7.2초 이상 | 0.1초 미만 |
| 안정성 | 150 VUs 요청 실패율 | 100% | 0% |

## 다음에도 유효했던 원칙

1. **`@Transactional`을 습관적으로 메서드 전체에 붙이는 방식은, 그 메서드 안에 커넥션과 무관한 대기 시간이 섞이는 순간 커넥션 풀 전체를 갉아먹는 단일 장애점이 됩니다.**  
   "트랜잭션 범위를 얼마나 짧게 유지하느냐"는 성능 문제가 아니라 가용성 문제였습니다.
2. **같은 클래스 내부 호출이 프록시를 우회한다는 사실은, 트랜잭션 구조를 리팩토링할 때마다 다시 검토해야 하는 제약이었습니다.**  
   영속성 로직을 분리할 때 "어느 클래스로 옮기느냐"가 "얼마나 옮기느냐"보다 중요했습니다.
3. **비동기로 넘어간 작업의 실패는 기본적으로 눈에 띄지 않습니다.**  
   명시적으로 실패를 기록하는 최소한의 장치 없이는 비동기 전환이 오히려 장애를 숨기는 결과로 이어질 수 있었습니다.
