---
title: "InnoDB 락 / MVCC / Phantom Read 정리"
summary: "일반 SELECT와 잠금 읽기의 차이, Read View 가시성 판정, Next-Key Lock이 Phantom Read를 막는 원리까지"
pubDate: 2026-09-05
tags: ["MySQL", "InnoDB", "동시성"]
---

## Phantom Read

- **정의**: 한 트랜잭션 안에서 같은 조건의 쿼리를 두 번 실행했을 때, 그 사이 다른 트랜잭션이 커밋한 INSERT/UPDATE 때문에 두 결과가 달라지는 현상.
- SQL 표준(ANSI SQL-92) 기준으로는 REPEATABLE READ에서 발생해도 표준 위반이 아니다. 표준상 완전히 막으려면 SERIALIZABLE이 필요하다.

## 읽기 방식에 따라 발생 여부가 다르다

### 1) 일반(잠금 없는) SELECT — MVCC 스냅샷 읽기
- InnoDB REPEATABLE READ에서 Read View(스냅샷)는 **트랜잭션의 첫 일반 SELECT 시점에 한 번만 생성**되고, 이후 같은 트랜잭션의 모든 일반 SELECT가 이 스냅샷을 재사용한다(쿼리마다 새로 생성되지 않음).
- 스냅샷은 row당/테이블당이 아니라 **트랜잭션당 하나**다. 이 하나의 스냅샷을 기준으로 어떤 테이블의 어떤 row를 조회하든 매번 대조한다.
- 결과적으로 스냅샷 생성 시점 이후 다른 트랜잭션이 커밋한 변경은 계속 안 보인다 → **일반 SELECT는 애초에 Phantom Read가 발생하지 않는다.**

### 2) 잠금 읽기(`SELECT ... FOR UPDATE`, `LOCK IN SHARE MODE`)와 쓰기(UPDATE/DELETE, INSERT 중복 체크)
- 스냅샷이 아니라 **최신 커밋 데이터(Current Read)**를 읽는다. 같은 트랜잭션 안이라도 마찬가지다.
- 이유: 잠금을 거는 목적 자체가 "지금 실제 최신 데이터에 락을 거는 것"이기 때문. 예전 스냅샷 버전에 락을 걸면 그 사이 커밋된 변경을 덮어쓰는 Lost Update가 생긴다.
- Gap Lock/Next-Key Lock이 없다면: A가 범위를 `FOR UPDATE`로 조회 → 그 사이 B가 그 범위에 INSERT 커밋 → A가 같은 조건으로 재조회하면 새 row가 보임 → 이것이 실제 Phantom Read.
- InnoDB는 **Next-Key Lock(Record Lock + Gap Lock)**으로 그 범위의 간격(gap) 자체를 잠가 B의 INSERT를 원천 차단한다.

## 다른 SELECT는 막히는가?

`FOR UPDATE`로 락을 건 상태에서도, 다른 트랜잭션의 **일반 SELECT(잠금 없는 읽기)는 막히지 않는다** — 자신의 스냅샷을 읽기 때문. 막히는 건 쓰기 작업과 잠금 읽기뿐이다.

## MVCC 내부 동작 — 일반 SELECT가 어떻게 스냅샷을 읽는가

### 저장 구조
- 테이블에는 row당 **최신 버전 하나만** 물리적으로 존재한다. 과거 버전을 별도 복사해두지 않는다.
- 각 row는 숨겨진 컬럼을 가진다: **`DB_TRX_ID`**(이 버전을 만든 트랜잭션 ID), **`DB_ROLL_PTR`**(이 row의 바로 이전 버전이 저장된 Undo Log 위치를 가리키는 포인터, 7바이트).
- 과거 버전들은 **Undo Log**(롤백 세그먼트)에 체인 형태로 쌓인다 — row가 수정될 때마다 이전 값이 Undo Log로 밀려나고, 그 Undo Log 레코드도 또 그 이전 버전을 가리켜 연결 리스트를 이룬다.

### Read View(스냅샷)의 구성
Read View는 실제 데이터가 아니라 **판단 규칙**이다. 생성 시점에 기록하는 값:
- `trx_ids`: 생성 시점에 아직 커밋 안 하고 활성 중이던 트랜잭션 ID 목록
- `up_limit_id`: `trx_ids` 중 최솟값
- `low_limit_id`: 그 시점까지 발급된 최대 트랜잭션 ID + 1(다음에 발급될 ID)
- `creator_trx_id`: 이 Read View를 만든 트랜잭션 자신의 ID

### 가시성 판정 규칙
row 버전의 `DB_TRX_ID`를 아래 순서로 비교:
1. `DB_TRX_ID == creator_trx_id` → 보임(자기 자신이 만든 변경)
2. `DB_TRX_ID < up_limit_id` → 보임(스냅샷 시점 이전에 이미 커밋 확정된 트랜잭션)
3. `DB_TRX_ID >= low_limit_id` → 안 보임(스냅샷 이후에 시작된 트랜잭션 = 미래의 변경)
4. 그 사이(`up_limit_id <= DB_TRX_ID < low_limit_id`) → `trx_ids` 목록에 있으면 안 보임(스냅샷 시점에 미커밋), 없으면 보임(그 사이 커밋 완료)

핵심 요약: **"이 버전을 만든 트랜잭션이 내 스냅샷 시점에 이미 커밋 완료 상태였는가?"** 하나의 질문으로 요약되며, 위 숫자 비교는 이 질문을 빠르게 계산하기 위한 구현 방식일 뿐이다.

### 조회 시 동작 순서
1. 트랜잭션의 첫 일반 SELECT면 Read View 생성, 아니면 기존 것 재사용(트랜잭션당 1회).
2. 인덱스로 조건에 맞는 **최신 row**를 가져온다(테이블 기준).
3. 그 row의 `DB_TRX_ID`를 Read View 규칙에 대입해 가시성 판정.
4. 통과하면 채택하고 종료.
5. 실패하면 `DB_ROLL_PTR`을 따라 Undo Log에서 한 단계 이전 버전을 가져와 다시 3번부터 반복.
6. 통과하는 버전이 나올 때까지 반복, 체인 끝까지 가도 없으면 "이 시점엔 존재하지 않던 row"로 처리해 결과에서 제외.

### 이 메커니즘이 왜 Phantom Read를 막는가
스냅샷 생성 시점에 **아직 진행 중이었거나 커밋되지 않은 변경(INSERT/UPDATE)**은 위 가시성 판정에서 전부 탈락한다. 따라서 같은 트랜잭션 안에서 몇 번을 재조회해도 항상 "스냅샷 시점에 이미 확정된 데이터"만 보이므로, 조건 범위가 겹치든 아니든 결과가 달라질 일이 없다 — 이것이 일반 SELECT에서 Phantom Read가 발생하지 않는 이유다.

## InnoDB RR이 표준보다 강한 이유 / 다른 DB와의 차이

- MySQL InnoDB의 REPEATABLE READ는 SQL 표준이 요구하는 것보다 강하게 구현되어 있어, 위 메커니즘 덕분에 실질적으로 Phantom Read가 거의 발생하지 않는다.
- PostgreSQL 등 다른 DB는 REPEATABLE READ를 Snapshot Isolation 방식으로 구현하는 등 락 메커니즘이 다르며, 같은 이름의 격리수준이어도 실제 보장 범위가 다를 수 있다.

## 실무에서 체감되는 지점

- Phantom Read 자체를 직접 마주치는 일은 드물지만, 그 방어 수단인 **Next-Key Lock/Gap Lock이 원인 모를 락 경합·데드락**으로 실무에서 자주 나타난다.
- 조건 컬럼에 **인덱스가 없으면** Gap Lock 대신 **테이블 전체**에 락이 걸려 성능 문제로 이어질 수 있다.
- **READ COMMITTED**로 격리수준을 낮추면 Gap Lock이 꺼지므로, 이 레벨에서는 잠금 읽기에서도 Phantom Read가 실제로 발생할 수 있다.
- 재고 차감, 정산 배치처럼 "범위 집계 후 갱신"하는 로직에서 격리수준을 잘못 고르면 실제 버그/데드락으로 이어진다.
- 면접에서 Phantom Read를 묻는 실질적 의도는 개념 암기 확인이 아니라, 그 개념이 만드는 **락 경합/데드락 원인을 진단할 수 있는지**를 보려는 것에 가깝다.
