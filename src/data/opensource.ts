// 오픈소스 기여 데이터 — about.astro 간략 리스트와 /work/opensource 상세 페이지에서 공유

export interface OssItem {
  title: string;
  desc: string;
  issue: string;
  pr: string;
}

export interface OssRepo {
  repo: string;
  count: string;
  items: OssItem[];
}

export const openSource: OssRepo[] = [
  {
    repo: "redisson/redisson",
    count: "5 issues · 4 merged PRs",
    items: [
      {
        title: "BaseTransactionalMap.isEqual() ByteBuf 누수",
        desc: "트랜잭션 처리 시마다 ByteBuf가 해제되지 않고 누적되는 누수를 발견, 메인테이너가 후속 PR로 수정",
        issue: "https://github.com/redisson/redisson/issues/7302",
        pr: "https://github.com/redisson/redisson/pull/7303",
      },
      {
        title: "getEx() TTL 옵션 무시 버그",
        desc: "PERSIST/KEEPTTL/EXAT/PXAT 옵션을 무시하고 항상 상대 시간(PX)으로 처리해 TTL이 의도와 다르게 설정되는 버그를 Spring Data Redis 전체 버전 모듈에 걸쳐 수정",
        issue: "https://github.com/redisson/redisson/issues/7308",
        pr: "https://github.com/redisson/redisson/pull/7309",
      },
      {
        title: "set() KEEPTTL·절대시각 만료 오처리",
        desc: "캐시 항목이 의도치 않게 즉시 만료되거나 영구 보존되는 버그를 Spring Data Redis 전체 버전 모듈에 걸쳐 수정",
        issue: "https://github.com/redisson/redisson/issues/7315",
        pr: "https://github.com/redisson/redisson/pull/7316",
      },
      {
        title: "RedissonKeysRx SCAN 커서 중복 구현",
        desc: "기존 RxIteratorConsumer와 중복 구현된 SCAN 커서 순회 로직을 발견, 공용 유틸을 재사용하도록 리팩터링",
        issue: "https://github.com/redisson/redisson/issues/7311",
        pr: "https://github.com/redisson/redisson/pull/7312",
      },
      {
        title: "RedissonCache.retrieve() 센티널 객체 반환",
        desc: "캐시된 null 값을 재조회할 때 내부 센티널 객체를 그대로 반환해 캐시 조회 결과가 오염되는 버그를 수정",
        issue: "https://github.com/redisson/redisson/issues/7326",
        pr: "https://github.com/redisson/redisson/pull/7327",
      },
    ],
  },
  {
    repo: "lukas-krecan/ShedLock",
    count: "2 issues · 1 PR (리뷰 중)",
    items: [
      {
        title: "JooqLockProvider 트랜잭션 공유 시 정합성 문제",
        desc: "이미 열린 트랜잭션(auto-commit=false)에 바인딩된 DSLContext를 그대로 사용할 때, lock_until이 stale 스냅샷으로 계산되거나 호출자의 무관한 데이터가 조용히 함께 커밋되는 문제를 재현·리포트하고 DataSource 기반 격리를 선택적으로 적용할 수 있는 수정을 제안",
        issue: "https://github.com/lukas-krecan/ShedLock/issues/3682",
        pr: "https://github.com/lukas-krecan/ShedLock/pull/3684",
      },
    ],
  },
  {
    repo: "langchain4j/langchain4j",
    count: "2 issues · 1 merged, 1 리뷰 중",
    items: [
      {
        title: "HierarchicalDocumentSplitter IndexOutOfBoundsException",
        desc: "서브스플리터가 빈 배열을 반환할 때 발생하는 예외를 실제 PDF 추출 데이터로 재현·근본 원인 추적해 제보, 이슈 기반으로 커뮤니티 기여자에 의해 수정·머지됨",
        issue: "https://github.com/langchain4j/langchain4j/issues/6085",
        pr: "https://github.com/langchain4j/langchain4j/pull/6091",
      },
      {
        title: "loadDocuments() 파일 하나 실패 시 배치 전체 중단",
        desc: "파일별 파싱 실패는 개별적으로 잡아 건너뛰되 CancellationException만 별도로 구분해 그대로 전파시키는 방식으로 수정 PR 제출",
        issue: "https://github.com/langchain4j/langchain4j/issues/6095",
        pr: "https://github.com/langchain4j/langchain4j/pull/6096",
      },
    ],
  },
];
