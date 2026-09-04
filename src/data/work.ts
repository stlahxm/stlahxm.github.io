// 경력·활동 상세 페이지(/work/[slug])용 데이터
// contributions[].postSlug는 src/content/posts/*.md 의 파일명(확장자 제외)과 일치해야 함

export interface WorkContribution {
  title: string;
  desc: string;
  postSlug?: string;
}

export interface WorkEntity {
  slug: string;
  type: "경력" | "활동";
  badge: string;
  logo?: string;
  /** 상세 페이지 헤더용 정사각 아이콘. 없으면 배지 텍스트로 표시(가로로 긴 logo를 억지로 정사각 박스에 넣지 않기 위함) */
  icon?: string;
  /** 소개 페이지 카드 이미지 표시 방식 — 기본 cover(꽉 채움), 워드마크형 로고는 contain 권장 */
  imageFit?: "cover" | "contain";
  name: string;
  role: string;
  period: string;
  summary: string;
  metrics: { label: string; value: string }[];
  /** 실제로 이 프로젝트에서 사용한 기술 스택 — 근거 없는 항목은 넣지 않음(비워도 됨) */
  stack?: string[];
  contributions: WorkContribution[];
}

export const work: WorkEntity[] = [
  {
    slug: "edutem",
    type: "경력",
    badge: "ET",
    logo: "/logos/edutem-icon.png",
    icon: "/logos/edutem-icon.png",
    name: "(주) 에듀템 웹개발팀",
    role: "백엔드 인턴",
    period: "2026.03 – 2026.06",
    summary: "자사 서비스 핵심 API 리팩토링 및 성능 개선을 위한 백그라운드 처리 모듈 설계 참여",
    metrics: [
      { label: "커넥션 점유 단축", value: "7.2s → 363ms" },
      { label: "데드락", value: "500 VUs, 0건" },
      { label: "핵심 API 방어", value: "지연 124ms" },
    ],
    stack: ["Java 17", "Spring Boot", "JPA/Hibernate", "MyBatis", "MySQL", "JUnit5/Mockito"],
    contributions: [
      {
        title: "순차 호출 커넥션 점유 개선",
        desc: "외부 API 순차 호출로 인한 150 VUs 부하 테스트 전량 실패를, CompletableFuture 병렬 실행과 커넥션 점유 시간 분리로 해결",
        postSlug: "completablefuture-connection-scope",
      },
      {
        title: "복합 인덱스로 락 범위 축소",
        desc: "인덱스 부재로 인한 풀 테이블 스캔·락 확산을, 조회 조건 순서에 맞춘 복합 인덱스로 해결",
        postSlug: "composite-index-lock-scope",
      },
      {
        title: "함수형 유니크 인덱스로 데드락 제거",
        desc: "갭 락 경합으로 인한 데드락을, 선조회 없는 즉시 insert + 유니크 인덱스 조합으로 해결",
        postSlug: "functional-unique-index-deadlock",
      },
      {
        title: "스레드 풀 분리 + Fail-fast",
        desc: "공용 스레드 풀 소진으로 핵심 API까지 마비되던 문제를, 전용 풀 분리와 즉시 거절 정책으로 해결",
        postSlug: "thread-pool-fail-fast",
      },
      {
        title: "AOP self-invocation 문제 해결",
        desc: "같은 클래스 내 메서드 직접 호출로 트랜잭션 프록시가 무효화되던 문제를 별도 서비스 빈 분리로 해결",
        postSlug: "aop-self-invocation-proxy",
      },
      {
        title: "Executor 격리 + 트랜잭션 범위 축소",
        desc: "AI 응답 대기 중 스레드·DB 커넥션이 함께 점유되던 문제를 전용 Executor 분리와 트랜잭션 범위 축소로 해결",
        postSlug: "executor-isolation-transaction-scope",
      },
    ],
  },
  {
    slug: "fitfit",
    type: "활동",
    badge: "FF",
    logo: "/logos/fitfit.png",
    name: "핏핏 (중고의류 판매 서비스)",
    role: "백엔드 · AI 기능 전담",
    period: "탄소중립 INNOVATION ACADEMY 최우수상 · 2025.12",
    summary: "상품 등록·거래·판매자-구매자 채팅 기능 구현, 가상 피팅 API 연동",
    metrics: [{ label: "수상", value: "최우수상" }],
    stack: ["Java", "Spring Boot", "JPA/Hibernate", "QueryDSL", "AWS EC2", "JUnit5/Mockito"],
    contributions: [
      {
        title: "백엔드·AI 기능 전담 개발",
        desc: "상품 등록·거래·채팅 기능 구현과 가상 피팅 API 연동, Spring Data JPA/QueryDSL 도메인 모델링, AWS EC2 CI/CD 파이프라인 구성",
      },
    ],
  },
  {
    slug: "ddangbogo",
    type: "활동",
    badge: "DB",
    logo: "/logos/ddangbogo-banner.png",
    imageFit: "contain",
    name: "땅보고 (공공데이터 활용 창업경진대회)",
    role: "서비스 개발 전담",
    period: "2026.07 – 2026.09",
    summary: "국토교통부·한국농어촌공사 등 공공데이터 오픈 API 연동, 농지 위험 요인 수집 파이프라인 구축",
    metrics: [{ label: "응답 단축", value: "p95 32.8%↓" }, { label: "처리량", value: "1.6배" }],
    contributions: [
      {
        title: "외부 API 장애 격리 + 병렬화",
        desc: "외부 API 실패 시 폴백값 반환과 지수 백오프 재시도로 장애를 격리하고, 순차 호출 병목을 스레드풀 병렬화로 해결",
      },
    ],
  },
];
