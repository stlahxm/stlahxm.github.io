// 프로젝트 상세 페이지(/projects/[slug])용 데이터
// contributions[].postSlug는 src/content/posts/*.md 의 파일명(확장자 제외)과 일치해야 함

export interface ProjectContribution {
  title: string;
  desc: string;
  postSlug?: string;
}

export interface ProjectEntity {
  slug: string;
  no: string;
  badge: string;
  logo?: string;
  name: string;
  period: string;
  tag: string;
  summary: string;
  links: { label: string; href: string }[];
  metrics: { label: string; value: string }[];
  contributions: ProjectContribution[];
  /** 라이브 서비스 URL — 상세 페이지에 임베드 미리보기로 표시 */
  demoUrl?: string;
  /** 아키텍처 다이어그램 이미지 경로 (public/ 기준) */
  architectureImage?: string;
  /** 헤드라인 아래 인용구 스타일 부제 (라이브러리 소개형 상세 페이지용) */
  subtitle?: string;
  /** 문제/역할/접근 3단 요약 (라이브러리 소개형 상세 페이지용) */
  problemRoleApproach?: { label: string; body: string; tags?: string[] }[];
  /** 배포 패키지 카드 (예: PyPI, JitPack) */
  packages?: { name: string; desc: string; installCmd: string; bullets: string[] }[];
  /** 결과 비교 표 */
  resultsTable?: { label: string; before: string; after: string }[];
}

export const projects: ProjectEntity[] = [
  {
    slug: "mori-q",
    no: "01",
    badge: "MQ",
    logo: "/logos/mori-q-banner.png",
    name: "모릭 (Mori-Q)",
    period: "2025.09 ~",
    tag: "대학생 AI 학습 생산성 플랫폼",
    summary: "총 사용자 200+, MAU 100+ | 백엔드 아키텍처 설계 및 백그라운드 AI 분석 파이프라인 구축 주도",
    links: [
      { label: "GitHub", href: "#" },
      { label: "홈페이지", href: "https://mori-q.com" },
    ],
    demoUrl: "https://mori-q.com",
    architectureImage: "/diagrams/mori-q-architecture.png",
    metrics: [
      { label: "요청 성공률", value: "97.4%" },
      { label: "캐시 적중률", value: "21.6%" },
      { label: "쿼리 수 고정", value: "881회→3회" },
    ],
    contributions: [
      {
        title: "Redis + ARQ 백그라운드 워커",
        desc: "요청 스레드가 직접 처리하던 오래 걸리는 AI 연산을 Redis 큐 + ARQ 워커로 분리, 요청 처리 성공률 97.4% 달성",
        postSlug: "redis-arq-background-worker",
      },
      {
        title: "캐시 스탬피드 방지",
        desc: "동일 자료 중복 업로드 시 AI API 중복 호출을, Redis 락과 ARQ 지연 재시도로 방어, 월 100만+ 토큰 비용 절감",
        postSlug: "cache-stampede-redis-lock",
      },
      {
        title: "실시간 장애 알림 파이프라인",
        desc: "저빈도 에러를 Pub/Sub → Cloud Function → Discord 실시간 전파와 자동 분류로 추적 가능하게 함",
        postSlug: "discord-alert-pipeline",
      },
      {
        title: "크레딧 선차감 + 실패 시 환불",
        desc: "연타로 악용되던 마이너스 크레딧 문제를 선차감 낙관적 업데이트와 실패 시 환불 로직으로 해결",
        postSlug: "credit-refund-optimistic-update",
      },
      {
        title: "페이지네이션 + N+1 제거",
        desc: "퀴즈 이력 조회의 무제한 로드와 N+1 쿼리를 페이지 조회 + IN절 일괄조회로 전환, 쿼리 수 고정",
        postSlug: "pagination-n-plus-1",
      },
    ],
  },
  {
    slug: "llm-markdown-sanitizer",
    no: "02",
    badge: "MD",
    logo: "/covers/llm-markdown-sanitizer.svg",
    name: "llm-markdown-sanitizer",
    period: "2026.08 ~",
    tag: "PyPI 3600+ 다운로드 오픈소스 라이브러리",
    summary: "LLM이 생성한 마크다운에서 실제로 발생하는 오류를 정제하는 라이브러리",
    subtitle:
      "\"LLM의 병목은 호출이 아니라, 모델의 느슨한 마크다운 출력과 CommonMark 파서의 엄격함이 서로 어긋나는 순간에 생겨납니다.\"",
    links: [
      { label: "GitHub", href: "#" },
      { label: "PyPI", href: "#" },
      { label: "JitPack", href: "#" },
    ],
    metrics: [
      { label: "다운로드", value: "3600+" },
      { label: "자동 정제율", value: "응답 20%+" },
    ],
    problemRoleApproach: [
      {
        label: "문제",
        body: "LLM은 표 직후 리스트, 4칸 들여쓰기, 언어 태그 없는 코드펜스에서 CommonMark 사양과 어긋나는 마크다운을 반복해서 생성합니다.",
      },
      {
        label: "역할",
        body: "모릭 서비스 코드에 흩어져 있던 정규식 땜질을 범용 정규화 로직과 도메인 로직으로 분리, 별도 오픈소스 라이브러리로 설계·개발",
        tags: ["Python", "Java", "CLI/DX 자동화"],
      },
      {
        label: "접근",
        body: "AST 기반 파싱으로 표/리스트/코드펜스 경계를 분석해 CommonMark 스케일에 맞게 재작성하고, 회귀는 전부 단위 테스트로 고정했습니다.",
      },
    ],
    packages: [
      {
        name: "llm-markdown-sanitizer (PyPI)",
        desc: "Python 런타임 코어. emphasis 경계, 표 확장/복구, 리스트 들여쓰기 정규화, 코드펜스 오검출 교정을 담당합니다.",
        installCmd: "pip install llm-markdown-sanitizer",
        bullets: [
          "clean_markdown_response() 한 번 호출로 표·리스트·코드펜스 정규화",
          "언어 태그가 있는 코드펜스는 산문처럼 보여도 그대로 보존",
        ],
      },
      {
        name: "llm-markdown-sanitizer (JitPack)",
        desc: "동일 정규화 로직의 Java 포트. JVM 기반 서비스에서 같은 규칙을 그대로 적용할 수 있습니다.",
        installCmd: "implementation 'com.github.stlahxm:llm-markdown-sanitizer:TAG'",
        bullets: ["Python 코어와 동일한 회귀 테스트 케이스로 동작 검증"],
      },
    ],
    resultsTable: [
      { label: "누적 다운로드", before: "0", after: "PyPI 기준 3,600+" },
      { label: "마크다운 오류", before: "표 직후 리스트·들여쓰기 붕괴 반복 제보", after: "실서버 응답 20%+ 자동 탐지·정제" },
      { label: "정규화 로직 위치", before: "서비스 코드 안 정규식 산발", after: "별도 라이브러리 + 단위 테스트로 고정" },
    ],
    contributions: [
      {
        title: "마크다운 오류 정제 라이브러리 개발",
        desc: "모릭에서 겪은 문제를 계기로 흔한 마크다운 깨짐 유형을 분류·정제하는 라이브러리로 일반화, Python/Java 두 언어 지원",
        postSlug: "llm-markdown-sanitizer",
      },
    ],
  },
];
