---
title: "같은 클래스 안에서 호출하면 @Transactional이 무효화되는 이유"
description: "퀴즈 재생성 로직에서 같은 클래스 내 메서드 직접 호출로 트랜잭션 프록시를 거치지 못해, 삽입 실패 시 롤백이 안 되던 문제를 해결한 기록"
pubDate: 2026-05-15
category: "경력"
tags: ["Spring", "트랜잭션", "AOP"]
badge: "AOP"
cover: "/covers/aop-self-invocation-proxy.png"
coverFit: "logo"
---

## 들어가며

AI 퀴즈 재생성 로직은 기존 문항을 지우고 새 문항을 다시 채우는 구조였습니다. 삭제와 삽입 사이에 실패가 끼면 문항이 통째로 사라질 수 있으니, 이 메서드에 `@Transactional`을 붙여두면 당연히 안전할 거라 생각했습니다. 이 가정이 틀렸다는 걸 알게 된 건, 실제로 삽입이 실패했을 때였습니다.

## 문제 상황

```java
public class GameServiceImpl {
    @Async
    public void generateQuiz() {
        this.processDbLogic();
    }

    @Transactional
    public void processDbLogic() {
        deleteOldData();
        insertNewData(); // 실패해도 롤백되지 않았다
    }
}
```

삽입 단계에서 예외가 발생했을 때, 롤백이 되어야 할 삭제 작업까지 그대로 커밋돼 퀴즈 테이블이 비어있는 상태로 남는 현상이 발견됐습니다. 어노테이션은 분명히 붙어 있는데, 트랜잭션이 마치 처음부터 없었던 것처럼 동작하고 있었습니다.

## 원인 분석

Spring의 `@Transactional`과 `@Async`는 둘 다 AOP 프록시를 거쳐야 동작합니다. 외부에서 이 빈(Bean)의 메서드를 호출하면 프록시 객체가 중간에 개입해 트랜잭션을 열고 닫습니다.

문제는 `generateQuiz()`가 `processDbLogic()`을 호출하는 방식에 있었습니다. 두 메서드가 같은 클래스(`GameServiceImpl`) 안에 있었기 때문에, 이 호출은 `this.processDbLogic()`과 동일하게 프록시를 거치지 않고 객체 내부에서 직접 실행됩니다. 프록시를 거치지 않으니 `@Transactional` 인터셉터가 개입할 자리가 없고, 어노테이션은 있어도 없는 것과 같은 상태가 됩니다.

처음에 오해하고 있던 지점은 정확히 여기였습니다. `@Transactional`이 "메서드 위에 붙어 있으면 항상 동작한다"고 가정했지만, 실제로는 "프록시를 거쳐 호출됐을 때만" 동작합니다. 같은 클래스 내부 호출인지 여부는 코드만 봐서는 잘 드러나지 않기 때문에, 이 구조는 기능 테스트에서는 걸러지지 않고 예외가 실제로 발생하는 순간에만 드러났습니다.

## 재설계

프록시를 거치도록 만드는 방법을 비교했습니다.

1. **자가 주입(Self-injection)**
   - 장점: 자기 자신을 의존성으로 주입받아 프록시를 통해 호출하는 방식으로, 구현이 간단합니다.
   - 단점: 순환 참조 위험이 있어 설계적으로 지양되는 방식입니다.
2. **TransactionTemplate 직접 사용**
   - 장점: 프로그래밍 방식으로 트랜잭션을 수동 관리하면 프록시 문제 자체에서 자유로워집니다.
   - 단점: 비즈니스 로직에 데이터베이스 관리 코드가 섞여 가독성이 떨어집니다.
3. **트랜잭션 로직을 별도 서비스 빈으로 분리 (채택)**
   - 장점: Spring AOP의 프록시 메커니즘을 자연스럽게 활용할 수 있고, 역할 분리가 명확해집니다.
   - 단점: 클래스가 하나 더 늘어나지만, 이번 사례에서는 이 정도 구조 변경이 가장 근본적인 해결이라고 판단했습니다.

```java
// 1. 트랜잭션 전용 서비스로 로직 이관
public class QuizGenerationServiceImpl implements QuizGenerationService {
    @Transactional
    @Override
    public void processAiQuizGeneration(...) {
        gameMapper.deleteMeaningQuizByUser(...);
        gameMapper.insertMeaningQuizBatch(...); // 실패 시 정상 롤백
    }
}

// 2. 외부 주입을 통한 프록시 호출 유도
public class GameServiceImpl {
    private final QuizGenerationService quizGenerationService;

    @Async
    public void generate_quiz_by_ai(int chatbotReportNo) {
        // 프록시 객체를 통해 호출되므로 트랜잭션이 정상 작동
        quizGenerationService.processAiQuizGeneration(...);
    }
}
```

## 결과 및 회고

삽입 실패를 의도적으로 재현한 뒤 재검증한 결과입니다.

| 지표 | 개선 전 | 개선 후 |
| --- | --- | --- |
| 삽입 실패 시 롤백 성공률 | 0% | 100% |
| 데이터 유실 발생 | 발생 | 0건 |

1. **`@Transactional`을 붙이는 것과 그 트랜잭션이 실제로 동작하는 것은 다른 문제였습니다.** 어노테이션 기반 선언적 트랜잭션은 프록시라는 메커니즘 위에서 동작하고, 같은 클래스 내부 호출은 그 메커니즘을 조용히 건너뜁니다.
2. **이 문제는 코드 리뷰만으로는 잡히지 않는 종류였습니다.** 클래스 내부 호출인지 외부 호출인지는 어노테이션만 봐서는 구분되지 않기 때문에, 이후로는 트랜잭션이 필요한 로직을 처음부터 별도 서비스로 분리해두는 걸 원칙으로 삼게 됐습니다.
