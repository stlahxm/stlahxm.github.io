---
title: "프론트는 이미 페이지네이션을 하고 있었다 — 백엔드만 모르고 있었을 뿐"
description: "퀴즈 이력 목록 조회 API의 무제한 로드와 N+1 쿼리를 페이지 조회와 IN절 일괄조회로 전환한 기록"
pubDate: 2026-08-31
category: "프로젝트"
tags: ["MySQL", "쿼리최적화", "N+1", "Spring Data JPA"]
metric: "쿼리 수 고정 (400건 기준 881회→3회)"
stats:
  - label: "쿼리 수 (400건 기준)"
    value: "881회 → 3회"
  - label: "페이지당 최대 건수"
    value: "50건 고정"
  - label: "N번째 시도 계산"
    value: "페이지 무관 고정 쿼리"
badge: "N+1"
cover: "/covers/pagination-n-plus-1.jpeg"
---

## 들어가며

퀴즈 이력 화면은 프론트엔드에 페이지 번호 버튼과 이전/다음 화살표가 이미 다 붙어 있었습니다. 코드를 열어보면 `page`, `totalPages` 상태를 관리하고, API를 호출할 때도 `?page=${currentPage - 1}&size=${ITEMS_PER_PAGE}`를 매번 붙여서 보내고 있었습니다.

겉보기엔 이미 완성된 페이지네이션 기능이었습니다.

문제는 이 파라미터를 받는 쪽, 백엔드 컨트롤러였습니다.

## 문제 상황

`QuizAttemptHistoryController`의 목록 조회 API는 `page`, `size` 같은 요청 파라미터를 아예 선언하고 있지 않았습니다.

```java
@GetMapping
@Operation(summary = "퀴즈 이력 목록 조회 API", description = "완료된 퀴즈 시도만 최신순으로 전부 나열합니다.")
public ResponseEntity<ApiResponse<QuizAttemptHistoryResponseDTO.ListDTO>> getQuizAttemptHistoryList(
        @RequestHeader(value = "Authorization") String authorization) {
    return ResponseEntity.ok(ApiResponse.onSuccess(
            quizAttemptHistoryUseCase.getQuizAttemptHistoryList(authorization)));
}
```

프론트엔드가 URL에 `page=0&size=10`을 아무리 붙여 보내도, Spring MVC는 컨트롤러 메서드에 그 파라미터를 받을 자리가 없으니 그냥 무시했습니다. 서비스 레이어도 `findByUserIdAndStatusOrderByCreatedAtDesc`로 완료된 퀴즈 이력 전체를 매번 가져오고 있었고, 응답 DTO(`ListDTO`)에도 `totalPages` 같은 페이지 메타 정보가 아예 없었습니다.

프론트엔드는 이 응답을 받아 `data.result?.totalPages ?? 1`로 안전하게 폴백 처리하고 있었기 때문에, 화면은 에러 없이 정상적으로 렌더링됐습니다.

다만 페이지 번호를 눌러도 매번 같은 전체 목록의 앞부분만 잘려 보이거나(클라이언트가 그런 슬라이싱을 하지 않는 이상), 실제로는 이력이 쌓일수록 매 요청마다 서버가 사용자의 퀴즈 이력 전체를 DB에서 긁어오고 있었습니다. 화면은 "페이지네이션이 되는 것처럼" 보였지만, 서버는 그 계약을 지키고 있지 않았던 것입니다.

## 원인 분석

### 2-1. 이미 한 번 고쳤던 N+1, 하지만 남아있던 무제한 로드

이력 목록에는 각 시도(attempt)마다 강의자료 제목과 분석 페이지 범위가 함께 표시됩니다. 초기 구현은 이력을 순회하며 강의자료 정보를 하나씩 개별 쿼리로 조회했고, 이 부분은 이전에 이미 `findAllById`로 강의자료 id들을 모아 IN절 한 번에 조회하도록 고쳐져 있었습니다.

```java
List<String> lectureIds = attempts.stream().map(QuizAttempt::getLectureId).distinct().collect(Collectors.toList());
Map<String, History> lectureById = historyRepository.findAllById(lectureIds).stream()
        .collect(Collectors.toMap(History::getId, h -> h));
```

이 배치 조회 덕분에 강의자료 정보를 가져오는 쿼리는 이력 건수와 무관하게 1회로 고정돼 있었습니다. 하지만 이 최적화는 "쿼리가 몇 번 도는가"만 해결했을 뿐, "애초에 몇 건을 한 번에 가져오는가"는 건드리지 못했습니다.

`findByUserIdAndStatusOrderByCreatedAtDesc`는 여전히 사용자의 완료 이력 전체를 페이지 제한 없이 한 번에 반환하고 있었고, 이력이 400건이면 400건짜리 리스트가 통째로 메모리에 올라와 직렬화되고 있었습니다.

### 2-2. 왜 지금까지 Pageable을 그냥 못 얹었는가

여기서 페이지네이션이 단순히 `Pageable`을 리포지토리 메서드에 끼워 넣는 것으로 끝나지 않는 이유가 있었습니다. 목록의 각 항목에는 "같은 강의자료 내 N번째 시도"라는 라벨이 붙는데, 이 번호는 다음과 같이 계산되고 있었습니다.

```java
// 같은 강의자료 내 완료 attempt들에 대해 오래된 순으로 1,2,3... 번호 부여.
// 이미 조회된 attempts 목록만으로 강의자료별 그룹핑 후 계산 — DB 재조회 없음.
private Map<String, Integer> computeAttemptNumbers(List<QuizAttempt> attempts) {
    Map<String, List<QuizAttempt>> byLecture = attempts.stream()
            .collect(Collectors.groupingBy(QuizAttempt::getLectureId));
    ...
}
```

이 계산은 "메모리에 사용자의 이력 전체가 이미 올라와 있다"는 전제 위에 서 있었습니다. 그런데 목록을 페이지 단위로만 가져오면, 지금 화면에 보이는 시도가 그 강의자료에서 몇 번째 시도인지 판단할 근거(그 강의자료의 더 이전 시도들)가 메모리에 없어집니다.

여기서 순진하게 "N번째 시도를 구하려면 결국 강의자료별로 다시 조회해야 하니, 이력 하나마다 별도 쿼리를 날리자"고 접근했다면, 페이지네이션을 도입하면서 방금 막았던 N+1을 다른 자리에서 그대로 재현하는 셈이 됩니다.

## 재설계

### Action 1. 목록 조회를 Spring Data의 `Page<T>`로 전환

리포지토리 메서드의 반환 타입을 `Page<QuizAttempt>`로 바꾸고 정렬은 메서드명이 아니라 `Pageable`(`Sort`)로 넘기도록 정리했습니다.

```java
// 정렬은 Pageable(Sort)로 넘기므로 메서드명에 OrderBy를 넣지 않는다.
Page<QuizAttempt> findByUserIdAndStatus(String userId, String status, Pageable pageable);
```

```java
int safePage = Math.max(page, 0);
int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
Pageable pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"));

Page<QuizAttempt> attemptPage = quizAttemptRepository.findByUserIdAndStatus(uid, STATUS_COMPLETED, pageable);
List<QuizAttempt> attempts = attemptPage.getContent();
```

페이지 크기는 클라이언트가 임의로 큰 값을 보내 사실상 무제한 로드를 재현하는 것을 막기 위해 상한(`MAX_PAGE_SIZE`)을 뒀습니다.

### Action 2. N번째 시도 계산을 "현재 페이지의 강의자료 범위"로만 배치 조회

전체 이력을 메모리에 두는 대신, 이번 페이지에 등장한 강의자료 id만 모아 그 강의자료들의 완료 이력 전체를 IN절 한 번으로 가져오도록 리포지토리 메서드를 추가했습니다.

```java
// 현재 페이지에 등장한 강의자료들에 한해서만, 그 강의자료의 완료 attempt 전체를 오래된 순으로 배치 조회.
// 페이지네이션 이후에는 메모리에 전체 이력이 없으므로 IN절로 필요한 범위만 한 번에 가져온다.
List<QuizAttempt> findByUserIdAndLectureIdInAndStatusOrderByCreatedAtAsc(
        String userId, List<String> lectureIds, String status
);
```

```java
List<QuizAttempt> attemptsForRanking = lectureIds.isEmpty()
        ? List.of()
        : quizAttemptRepository.findByUserIdAndLectureIdInAndStatusOrderByCreatedAtAsc(uid, lectureIds, STATUS_COMPLETED);
Map<String, Integer> attemptNumberById = computeAttemptNumbers(attemptsForRanking);
```

이렇게 하면 한 페이지에 서로 다른 강의자료가 몇 개 섞여 있든, "N번째 시도" 라벨을 매기기 위한 쿼리는 이력 건수가 아니라 페이지 안에 등장한 강의자료 종류 수에만 비례합니다. 페이지 크기(10건)를 훨씬 넘는 규모로 이력이 쌓여도, 목록 조회 API 전체가 실행하는 쿼리 수는 고정됩니다.

### Action 3. 응답에 페이지 메타 정보 추가

프론트엔드가 이미 기대하고 있던 `totalPages`를 포함해 페이지 메타 정보를 응답 DTO에 채워, 그동안 `?? 1` 폴백으로 가려져 있던 계약을 실제로 채웠습니다.

```java
return QuizAttemptHistoryResponseDTO.ListDTO.builder()
        .attempts(items)
        .page(safePage)
        .size(safeSize)
        .totalElements(attemptPage.getTotalElements())
        .totalPages(attemptPage.getTotalPages())
        .hasNext(attemptPage.hasNext())
        .build();
```

## 엣지 케이스

통계 화면(`/v1/quiz-attempts/stats`)은 이번 리팩토링에서 건드리지 않았습니다. 정답률 추이나 취약 개념 분석은 사용자의 완료 이력 전체를 봐야 의미가 있는 집계이기 때문에, 여기는 여전히 `findByUserIdAndStatusOrderByCreatedAtDesc`로 전체를 가져옵니다.

모든 조회를 페이지네이션으로 통일하는 대신, "화면에 뿌릴 목록"과 "전체를 훑어야 하는 집계"를 서로 다른 쿼리 전략으로 분리해 둔 것입니다.

## 결과 및 회고

N+1 배치 조회를 처음 적용했을 때 측정한 수치는 이력 400건 기준 쿼리 881회에서 3회로 줄어든 것이었습니다. 이번 페이지네이션 전환은 여기서 한 단계 더 나아가, 애초에 한 번의 요청이 만지는 이력 건수 자체를 이력 누적량과 무관하게 고정시켰습니다.

1. **N+1을 잡았다고 해서 무제한 로드 문제까지 함께 해결된 건 아니었습니다.** 쿼리 횟수를 줄이는 것과 한 번에 처리하는 데이터량을 제한하는 것은 서로 다른 축의 문제였고, 둘 다 잡아야 이력이 아무리 쌓여도 응답이 느려지지 않는다는 보장이 생겼습니다.
2. **프론트엔드가 이미 기대하고 있는 계약을 백엔드가 조용히 어기고 있어도, 폴백 처리가 잘 돼 있으면 겉으로는 아무 문제 없어 보입니다.** `totalPages ?? 1` 같은 방어 코드는 화면이 깨지지 않게는 해주지만, 계약이 실제로 지켜지고 있는지는 별개로 확인해야 했습니다.
3. **페이지네이션을 도입할 때, 그 페이지네이션 때문에 깨지는 다른 로직이 있는지부터 살펴야 했습니다.** "N번째 시도" 번호 계산이 전체 이력이 메모리에 있다는 가정에 기대고 있었다는 걸 놓쳤다면, 페이지네이션을 도입하면서 방금 고쳤던 N+1을 다른 곳에서 다시 만들었을 것입니다.
