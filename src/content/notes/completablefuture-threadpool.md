---
title: "CompletableFuture / 스레드풀 개념 정리"
summary: "Future의 한계부터 CompletableFuture 콜백 체이닝, ThreadPoolExecutor 내부 동작, 데몬 스레드와 무중단 배포 시 executor 정리까지"
pubDate: 2026-09-03
tags: ["Java", "동시성", "CompletableFuture"]
---

## 1. Future의 한계

- Java 5부터 존재. `submit()`으로 작업을 던지면 `Future<T>` 반환.
- 결과 조회는 `.get()`뿐 — 블로킹 호출. 콜백 등록 불가.
- 여러 작업 조합(다 끝나면 합치기 등) 사실상 불가 — 수동 폴링/블로킹만 가능.
- 예외도 `.get()`에서 `ExecutionException`으로만 확인 가능, 체인 중간 처리 불가.
- `.get()`을 안 부르면: 정상 결과는 그냥 방치, 예외는 조용히 묻혀 아무도 모름.

## 2. CompletableFuture가 푸는 것 (Java 8+)

- `Future` + `CompletionStage` 구현.
- 콜백 체이닝: `thenApply`/`thenAccept`/`thenCompose`/`thenCombine` — 완료 시 실행할 로직을 등록만 해두면 됨, 호출 스레드는 블로킹 없이 진행.
- 조합: `allOf(...)`(전부 완료해야 완료, `Void` 반환 — 개별 결과는 각 CF에서 따로 꺼냄), `anyOf(...)`(하나만 완료돼도 완료).
- 예외 체이닝: `exceptionally`/`handle`/`whenComplete`.
- executor 안 넘기면 기본 `ForkJoinPool.commonPool()` 사용, `thenApplyAsync(fn, executor)`처럼 명시 가능.

## 3. 블로킹이 실제로 일어나는 지점

- Future: 기다리는 코드를 호출자가 직접, 그 자리에서 작성해야 함(동기 강제).
- CompletableFuture: 기다리는 로직을 콜백으로 위임 → 호출 스레드는 그 사이 다른 일 가능. **최종적으로 값을 그 자리에서 당장 써야 하는 지점(`.join()`/`.get()`)에서만 블로킹 발생.**
- 콜백 체인 안에서 끝까지 처리(예: `thenAccept`로 로그/저장까지 끝냄)하면 `.join()` 없이 영원히 논블로킹 유지 가능.
- 즉 이득은 "블로킹 제거"가 아니라 **"블로킹 시점을 마지막 한 곳으로 몰아 그 전까지 스레드를 다른 데 쓸 수 있게 함"**.

## 4. 블로킹/논블로킹 vs 동기/비동기 (서로 다른 축)

|  | 동기 | 비동기 |
|---|---|---|
| **블로킹** | 일반 함수 호출, `future.get()` | (드묾) |
| **논블로킹** | 즉시 리턴, 완료 여부는 직접 polling | 즉시 리턴, 완료 시 콜백 자동 호출(진짜 비동기 I/O) |

- 블로킹/논블로킹: 호출 시 제어권을 바로 돌려주는가
- 동기/비동기: 완료를 누가 확인하는가(직접 확인 vs 통보받음)
- `Future.get()` = 블로킹+동기, `thenApply` 등록 자체 = 논블로킹+비동기, `.join()`은 그 흐름을 끊고 다시 블로킹+동기로 되돌아가는 지점

## 5. ThreadPoolExecutor 동작 원리

- `corePoolSize` = 평상시 유지 최소 스레드 수(하한), `maximumPoolSize` = 허용 최대(상한)
- `newFixedThreadPool(n)` → `core == max == n`, 무한 큐(`LinkedBlockingQueue`)
- **생성은 lazy**: 생성자 호출 시 스레드 0개. 작업이 들어올 때마다 "현재 수 < corePoolSize"면 딱 그 작업 처리할 스레드 1개만 생성. 코어 사이즈만큼 한 번에 안 채움 — 동시 요청 개수만큼만 늘어남.
- 미리 채우려면 `prestartCoreThread()`/`prestartAllCoreThreads()` 명시 호출.

**워커 스레드 내부 루프**
```java
while (true) {
    task = (현재 스레드 수 <= corePoolSize) ? queue.take()  // 무한 대기 → 코어는 안 죽음
                                            : queue.poll(keepAliveTime, unit); // 초과분만 타임아웃 대기
    if (task == null) break; // idle timeout → 종료
    task.실행();
}
```

- 스레드 수 감소: corePoolSize를 넘는 초과 스레드만 idle timeout으로 자동 종료. `newFixedThreadPool`은 core==max라 초과분 자체가 없어 절대 안 줄어듦. 감소 확인하려면 `newCachedThreadPool()`(core=0, max=MAX_VALUE, keepAlive=60s) 같은 케이스 필요.
- 코어 스레드가 죽는 조건: `shutdown()`/`shutdownNow()` 호출, `allowCoreThreadTimeOut(true)` 설정, JVM 프로세스 종료 — 이 셋 외엔 안 죽음.

## 6. execute() vs submit()

- `execute(Runnable)`: `void`, 결과/추적 불가. 예외 발생 시 `UncaughtExceptionHandler`로 전파(콘솔에 찍히고 스레드만 교체됨), 호출자는 알 방법 없음.
- `submit(Runnable|Callable)`: `Future<T>` 반환. 예외는 Future 내부에 조용히 저장되고, `.get()` 호출 시 `ExecutionException`으로 래핑되어 던져짐 — `.get()` 안 부르면 예외를 영영 놓침.
- 선택 기준: fire-and-forget → `execute()`, 결과/완료 추적 필요 → `submit()`.

## 7. `.get()` 호출과 블로킹의 정체

- `.get()`은 호출자 스레드를 블로킹(`LockSupport.park()` 기반 실제 대기, busy-wait 아님). 작업을 실행하는 워커 스레드는 `.get()` 호출 여부와 무관하게 독립적으로 계속 실행됨.
- `.get()`이 블로킹을 강제하는 근본 이유: `T get()` 시그니처가 "호출 즉시 실제 값을 동기 반환한다"는 계약이라, 값이 아직 없으면 기다리는 것 외에 선택지가 없음(콜백 등록 경로가 Future엔 없어서).
- 이 계약을 "값이 생기면 콜백 실행"으로 바꾼 게 CompletableFuture — 콜백 등록은 "값을 어디에 저장해둘 스레드"가 필요 없이, CompletableFuture 객체 자신의 필드(힙)에 콜백 목록과 결과값을 들고 있다가 완료 시 트리거하는 구조 (Observer 패턴과 동일).

## 8. `supplyAsync`와 함수형 인터페이스

```java
static <U> CompletableFuture<U> supplyAsync(Supplier<U> supplier)
static <U> CompletableFuture<U> supplyAsync(Supplier<U> supplier, Executor executor)
```

- `static <U>`: static 메서드는 클래스 레벨 제네릭(`CompletableFuture<T>`의 T)을 못 쓰므로 메서드 자신만의 타입 파라미터를 새로 선언.
- `Supplier<T>`(`java.util.function`): `T get()` 메서드 하나뿐인 함수형 인터페이스 — "인자 없이 값 하나 리턴".
- 람다(`() -> "hello"`)는 이 인터페이스 구현체를 그 자리에서 표현하는 문법. 대입 문맥(타겟 타입)을 보고 컴파일러가 어떤 인터페이스인지 추론 — 메서드 1개짜리 인터페이스에서만 가능.
- 형제 인터페이스: `Consumer<T>`(`void accept(T)`), `Function<T,R>`(`R apply(T)`), `BiFunction<T,U,R>`(`R apply(T,U)` — `handle()`이 이 타입), `Runnable`(`void run()`).
- 팩토리 메서드: `new CompletableFuture<>()`(빈 상자)와 달리, 작업을 executor에 던져 실행 시작한 상태의 객체를 만들어 반환.

## 9. 제네릭 `<T>` vs 람다 `->` (구분)

- `<T>`: 타입을 나중에 채우겠다는 자리 표시(placeholder). `class Box<T>`처럼 선언, `Box<String>`처럼 확정.
- `() -> ...`: 함수 내용을 그 자리에서 표현하는 문법. `()`=매개변수, `->`=실행하면, 뒤=리턴값.
- 완전히 별개의 문법이 한 줄(`Supplier<String> s = () -> "hello"`)에 같이 나와서 헷갈리기 쉬움.

## 10. 예외 처리 3종 비교

| 메서드 | 시그니처 | 정상일 때 | 실패했을 때 | 리턴값 |
|---|---|---|---|---|
| `exceptionally(fn)` | `Function<Throwable,T>` | 통과 | fn(ex) → 대체값 | 정상값 or 대체값 |
| `handle(fn)` | `BiFunction<T,Throwable,R>` | fn(result, null) | fn(null, ex) | 항상 fn 결과 |
| `whenComplete(fn)` | `BiConsumer<T,Throwable>` | fn(result, null) | fn(null, ex) | 원래 값/예외 그대로 전파(fn 리턴 무시) |

- `exceptionally`: 실패 시에만 개입, 값 대체 — `allOf` 묶기 전 개별 fallback에 적합.
- `handle`: 성공/실패를 한 곳에서 분기 처리.
- `whenComplete`: 로깅/모니터링 전용, 값 불변경 — 이후 `.join()`에서 예외 그대로 터짐(처리한 게 아님, 흔한 착각).
- **함정**: 체인 안에서 던진 예외는 `CompletionException`으로 한 번 래핑돼서 전달됨. `ex.getMessage()`는 원본 메시지가 아니라 원본 예외의 `toString()`을 반환 — 원본이 필요하면 `ex.getCause()`.

## 11. 데몬 스레드와 JVM 종료

- JVM은 살아있는 **non-데몬** 스레드가 하나도 없으면 즉시 종료 — 데몬 스레드가 뭘 하고 있든 그냥 강제 종료.
- `main` 스레드, `Executors.newFixedThreadPool()` 등 직접 만든 풀의 스레드는 기본 non-데몬.
- `ForkJoinPool.commonPool()`의 워커 스레드는 **데몬**으로 설계됨 → executor 안 넘기고 `supplyAsync`만 쓰고 `.join()`도 안 부른 채 `main()`이 끝나버리면, 진행 중이던 작업이 완료 전에 강제 종료될 수 있음.
- `thread.setDaemon(true)`로 직접 지정 가능(스레드 시작 전에 설정해야 함).

## 12. 무중단 배포 시 executor 정리

- 프레임워크 레벨: `server.shutdown: graceful` (Spring Boot) — 새 요청 거절, 진행 중 요청은 설정된 시간까지 마저 처리.
- 직접 만든 executor는 별도로 훅 필요:
```java
@PreDestroy
public void shutdown() {
    executor.shutdown();                              // 새 작업 거절, 기존 건 계속 진행
    if (!executor.awaitTermination(20, TimeUnit.SECONDS)) {
        executor.shutdownNow();                        // 시간 초과 시 강제 인터럽트
    }
}
```
- 배포 플랫폼의 종료 유예시간(예: Cloud Run은 SIGTERM 후 기본 유예시간 뒤 SIGKILL)보다 짧게 타임아웃을 맞춰야 함.
