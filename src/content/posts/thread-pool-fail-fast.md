---
title: "공용 스레드 풀 소진으로 로그인까지 마비되던 문제, 격리와 Fail-fast로 막기"
description: "오래 걸리는 외부 API 하나가 톰캣 공용 스레드를 전부 잡아먹으면서 로그인 같은 핵심 API까지 응답이 막히던 문제를 스레드 풀 분리와 즉시 거절 정책으로 해결한 기록"
pubDate: 2026-05-20
category: "경력"
tags: ["동시성", "Spring", "Tomcat", "장애격리"]
metric: "핵심 API 지연 124ms 수준 방어"
badge: "Thread"
cover: "/covers/thread-pool-fail-fast.png"
coverFit: "logo"
---

## 기본값 하나가 만든 장애

Java의 `ThreadPoolExecutor`는 풀과 큐가 모두 가득 찼을 때 새 작업을 어떻게 처리할지 정하는 거절 정책(RejectedExecutionHandler)을 갖습니다. 그중 `CallerRunsPolicy`는 "풀이 꽉 찼으니 이 작업을 요청한 스레드가 직접 실행해라"는 정책입니다. 큐를 무한정 늘리지 않으면서도 작업을 유실하지 않는다는 점에서 안전한 기본값처럼 보이지만, "요청한 스레드가 누구인가"에 따라 이 안전장치가 정반대로 작동할 수 있습니다.

학습 서비스는 AI 분석 리포트 생성을 별도 스레드 풀(`leveltestReportExecutor`)에 위임해 두고 있었습니다. 평소에는 문제가 없었지만, 분석 요청이 몰리는 시간대가 되면 리포트를 요청하지 않은 사용자까지 로그인이 안 되는 현상이 반복됐습니다. 무거운 기능 하나가, 완전히 다른 기능까지 함께 무너뜨리고 있었습니다.

## 사라진 대기 시간을 추적하다

장애를 재현하기 위해 k6로 부하 테스트를 돌렸습니다. APM(Glowroot)으로 실제 트랜잭션 내부를 들여다보니, 비즈니스 로직과 외부 AI API 호출을 포함한 순수 연산 시간에 비해 응답 지연이 훨씬 크게 나왔습니다. 추적 결과, Tomcat의 요청 수신 워커 스레드가 모두 고갈되어 신규 요청이 WAS 내부로 진입조차 하지 못하고 큐잉 지연을 겪고 있었습니다. AI 리포트를 요청하지 않고 단순히 로그인이나 메인 홈 화면에 접근하려던 대다수 유저들마저 이 큐잉 대기를 거치며 커넥션 타임아웃을 겪었습니다.

`@Async`로 무거운 AI 리포트 분석 작업은 이미 백그라운드 스레드 풀(`leveltestReportExecutor`)에 위임하도록 구성해 둔 상태였습니다. 그런데 왜 Tomcat 스레드 풀까지 고갈됐을까요.

```
1. AI 분석 요청 폭주 ➔ 비동기 스레드 풀과 대기 큐가 포화됨
2. CallerRunsPolicy 작동: "비동기 풀이 꽉 찼으니, 이 작업을 요청한 메인 Tomcat 스레드가 직접 실행해라!"
3. Tomcat 스레드가 직접 외부 AI API 호출을 동기식으로 대기하며 블로킹됨
```

앞 문단의 "안전한 기본값"이 정확히 이 구간에서 뒤집혔습니다. `CallerRunsPolicy`가 작업을 넘기는 대상은 "비동기 작업을 요청한 스레드"인데, 이 서비스에서 그 스레드는 다름 아닌 로그인·홈 화면과 같은 풀을 공유하는 Tomcat 워커 스레드였습니다. 여기에 트랜잭션 범위 문제가 한 겹 더 결합돼 있었습니다.

```java
@Transactional
public void processReport(...) {
    ...
    // 오래 걸리는 외부 AI API 동기 호출이 트랜잭션 내부에서 수행됨
    List<Response> response = externalAiClient.requestReport(...);
    ...
}
```

비동기 풀에서 넘쳐난 작업을 위임받은 Tomcat 스레드가 하필 `@Transactional` 어노테이션이 달린 메서드 내에서 외부 API 호출을 대기하게 된 것입니다. 결과적으로 Tomcat 스레드들이 AI 응답을 기다리는 동안 DB 커넥션(HikariCP)을 반납하지 않고 계속 쥐고 있게 되었고, 커넥션 풀마저 함께 고갈되면서 다른 필수 기능을 이용하려던 일반 사용자 스레드들까지 커넥션을 획득하지 못하는 상황으로 번졌습니다.

## 세 가지 대안, 그리고 선택

Tomcat 스레드 자원과 가용성을 복구하기 위해 세 가지 방안의 트레이드오프를 검토했습니다.

1. **Spring WebFlux 완전 논블로킹 전환**
   - 장점: 스레드 점유 없이 대량의 동시 요청을 처리할 수 있습니다.
   - 단점: JDBC를 사용하는 기존 데이터베이스 계층 전체를 비동기 드라이버로 리팩토링해야 해서 전환 비용과 테스트 오버헤드가 과도했습니다.
2. **메시지 큐(RabbitMQ / Kafka) 도입**
   - 장점: 영속성과 작업 큐잉을 인프라 레벨에서 확실히 격리할 수 있습니다.
   - 단점: 새로운 인프라 미들웨어를 도입하고 이를 모니터링해야 하는 관리 비용과 복잡도가 추가됩니다.
3. **Bulkhead 격리 및 트랜잭션 다이어트 (최종 채택)**
   - 장점: 기존 Spring MVC 아키텍처를 온전히 유지하면서, 전용 Executor 기반 Bulkhead 격리와 스레드 풀 거절 정책 튜닝만으로 문제의 핵심을 직접 겨냥할 수 있습니다.
   - 단점: 스레드 풀 크기, 큐 용량, 거절 정책을 실제 트래픽에 맞춰 세밀하게 튜닝해야 합니다.

## 구현: 격리와 즉시 거절

Tomcat 스레드 풀과 무거운 분석 작업을 수행하는 비동기 스레드 풀을 완벽하게 분리 격리했습니다.

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "leveltestReportExecutor")
    public Executor leveltestReportExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(50);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("LtReport-");

        // 톰캣 스레드 침범을 원천 차단하고 즉각 실패(Fail-fast)를 던지는 정책
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.initialize();
        return executor;
    }
}
```

`CallerRunsPolicy` 대신 `AbortPolicy`로 바꾸면, 비동기 풀과 큐가 꽉 찼을 때 시스템은 메인 WAS 스레드를 동원하지 않고 `RejectedExecutionException`을 즉시 발생시킵니다. 일시적인 과부하 상태에서 AI 분석을 요청한 일부 사용자는 대기 혹은 실패 예외를 마주할 수 있지만, 로그인이나 마이페이지 탐색 등 핵심 동선을 밟는 대다수 일반 사용자들은 이 장애 전파에서 완전히 분리됩니다.

여기에 더해, 외부 API 호출 대기 시간 동안 DB 커넥션을 쥐고 있던 구조를 격리해, 실제 조회와 쓰기 트랜잭션 바운더리를 외부 API 호출 구간 밖으로 빼는 샌드위치 패턴을 적용했습니다.

```java
public void processAiQuizGeneration(...) {
    // 1. 읽기 작업 (트랜잭션 영역 진입 전이므로 커넥션 즉시 반납)
    List<Map<String, String>> sourceList = gameMapper.selectSourceWordsByLevel(...);

    // 2. 외부 AI API 호출 (Non-Transactional)
    // 이 호출 대기 시간 동안 DB 커넥션을 전혀 점유하지 않습니다
    List<ChatbotMeaningQuizVO> results = elasolution.requestQuizOptions(...);

    // 3. 실제 DB 저장 (실제 DB 영속화가 진행되는 최소한의 범위에만 트랜잭션 활성화)
    saveQuizResultsAtomic(userNo, levelTitleNo, quizType, results);
}

@Transactional
public void saveQuizResultsAtomic(...) {
    gameMapper.deleteMeaningQuizByUser(...);
    gameMapper.insertMeaningQuizBatch(...);
}
```

## 결과 및 회고

과부하 상황을 재현한 부하 테스트에서 실측한 서버 가용성 지표입니다.

| 구분 | 지표 | 개선 전 (동기 + CallerRunsPolicy) | 개선 후 (Bulkhead + Transaction Diet) |
| --- | --- | --- | --- |
| 가용성 | 로그인 등 핵심 API | 스레드 고갈로 마비/타임아웃 | 124ms 이내 정상 서빙 |

1. **거절 정책은 비즈니스 안전망의 시작입니다.** 실행 풀의 크기만 고려하고 거절 정책을 기본값으로 방치하는 것은, 동시성 한계점에서 그 기본값이 누구를 희생시킬지 미리 정해두지 않았다는 뜻입니다. `CallerRunsPolicy`가 항상 나쁜 선택은 아니지만, "요청한 스레드가 다른 중요한 기능과 풀을 공유하는가"를 먼저 확인해야 했습니다.
2. **성능 개선의 핵심은 속도가 아니라 자원 점유 시간의 최소화였습니다.** 무심코 사용한 `@Transactional`이 외부 네트워크 I/O를 물고 늘어지는 순간, DB 커넥션 풀은 순식간에 말라버립니다.
3. **WebFlux나 메시지 큐 같은 고비용 아키텍처를 맹종하기보다, 기존 환경에서 Bulkhead 패턴과 거절 정책 튜닝만으로 리소스를 통제하는 편이 이 문제의 크기에는 더 적정한 기술이었습니다.**
