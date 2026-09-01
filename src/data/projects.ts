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
      { label: "홈페이지", href: "#" },
    ],
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
    links: [
      { label: "GitHub", href: "#" },
      { label: "PyPI", href: "#" },
      { label: "JitPack", href: "#" },
    ],
    metrics: [
      { label: "다운로드", value: "3600+" },
      { label: "자동 정제율", value: "응답 20%+" },
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
