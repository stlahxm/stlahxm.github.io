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
  /** 헤더 배지용 작은 심플 아이콘. 없으면 logo를 사용 */
  icon?: string;
  /** 소개 페이지 카드 이미지 표시 방식 — 기본 cover(꽉 채움), 워드마크형 로고는 contain 권장 */
  imageFit?: "cover" | "contain";
  name: string;
  period: string;
  tag: string;
  summary: string;
  links: { label: string; href: string }[];
  metrics: { label: string; value: string }[];
  /** 실제로 이 프로젝트에서 사용한 기술 스택 — 근거 없는 항목은 넣지 않음(비워도 됨) */
  stack?: string[];
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
  /** 라이브 데모가 없는 라이브러리용 — 터미널 설치 + Before/After 코드 정제 예시 (demoGif가 없을 때 폴백) */
  codeDemo?: {
    terminalLines: string[];
    beforeLabel: string;
    afterLabel: string;
    beforeCode: string;
    afterCode: string;
    note?: string;
  };
  /** 실제 동작을 녹화한 GIF (예: 브라우저 인터랙티브 플레이그라운드) — 있으면 codeDemo보다 우선 표시 */
  demoGif?: { src: string; caption: string };
  /**
   * 라이브 데모 iframe을 이 픽셀 폭 기준 데스크톱 레이아웃으로 렌더링한 뒤 컨테이너에 맞게 축소 표시.
   * 임베드 사이트가 좁은 화면에서 모바일 레이아웃으로 전환돼 버릴 때 사용 (예: 1440).
   */
  demoDesktopWidth?: number;
}

export const projects: ProjectEntity[] = [
  {
    slug: "mori-q",
    no: "01",
    badge: "MQ",
    logo: "/logos/mori-q-banner.png",
    icon: "/logos/mori-q-icon.png",
    name: "모릭 (Mori-Q)",
    period: "2025.09 ~",
    tag: "대학생 AI 학습 생산성 플랫폼",
    summary: "총 사용자 200+, MAU 100+ | 백엔드 아키텍처 설계 및 백그라운드 AI 분석 파이프라인 구축 주도",
    links: [
      { label: "GitHub", href: "#" },
      { label: "홈페이지", href: "https://mori-q.com" },
    ],
    demoUrl: "https://mori-q.com",
    demoDesktopWidth: 1024,
    architectureImage: "/diagrams/mori-q-architecture.png",
    subtitle:
      "\"강의 자료는 이미 학생들 손에 있습니다. 문제는 시험 때까지 그 자료를 몇 번이고 다시 찾고 이어서 학습할 방법이 없다는 점이었습니다.\"",
    metrics: [
      { label: "요청 성공률", value: "97.4%" },
      { label: "캐시 적중률", value: "21.6%" },
      { label: "쿼리 수 고정", value: "881회→3회" },
      { label: "100 VU 부하테스트 p95", value: "3.55s→350.8ms" },
      { label: "월 인프라 고정비", value: "$23~26→$0~2" },
    ],
    stack: [
      "Java 17",
      "Spring Boot",
      "Spring Security (JWT)",
      "JPA/Hibernate",
      "PostgreSQL",
      "Redis",
      "Python (FastAPI)",
      "Docker",
      "GCP",
      "JUnit5/Mockito",
      "Prometheus",
      "Grafana",
      "SLF4J",
    ],
    problemRoleApproach: [
      {
        label: "문제",
        body: "강의 자료는 이미 학생들 손에 있지만, 필요한 페이지 범위만 골라 복습·요약·퀴즈로 반복 학습할 방법이 없었습니다. 서비스가 성장하면서는 AI 분석 요청이 몰릴 때 실패율이 치솟고, 동일 자료 중복 업로드가 AI API를 중복 호출해 비용이 새는 문제도 함께 떠안았습니다.",
      },
      {
        label: "역할",
        body: "개발자 1(백엔드 전담) · 디자이너 1 · 기획자 1로 구성된 3인 팀에서, 백엔드 아키텍처 설계와 백그라운드 AI 분석 파이프라인 구축을 주도했습니다.",
        tags: ["개발자 1", "디자이너 1", "기획자 1"],
      },
      {
        label: "접근",
        body: "Redis + ARQ 백그라운드 워커로 무거운 연산을 요청 스레드에서 분리하고, Redis 락·낙관적 크레딧 차감·페이지네이션으로 동시성·비용·쿼리 문제를 각각 해결했습니다.",
      },
    ],
    resultsTable: [
      { label: "요청 처리", before: "요청 스레드가 AI 연산 직접 처리", after: "Redis+ARQ 분리, 성공률 97.4%" },
      { label: "중복 API 호출", before: "동일 자료 재업로드 시 중복 호출", after: "Redis 락으로 방어, 캐시 적중률 21.6%" },
      { label: "퀴즈 이력 쿼리 수", before: "881회 (N+1)", after: "3회로 고정 (페이지네이션 + IN절)" },
      { label: "100 VU 부하테스트 p95", before: "3.55s (인스턴스 증설만으로는 개선 안 됨)", after: "350.8ms (Hikari 풀+PgBouncer 재조정)" },
      { label: "100 VU 부하테스트 실패율", before: "0.16%", after: "0.00%" },
      { label: "월 DB/Redis 인프라 고정비", before: "$23~26 (Cloud SQL 관리형)", after: "$0~2 (VM 무료 티어 + Postgres self-host)" },
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
        title: "Cloud SQL → Self-host 마이그레이션 + 부하테스트 기반 커넥션 풀 튜닝",
        desc: "월 $23~26 고정비 Cloud SQL을 VM 무료 티어 Postgres self-host로 전환하고, k6 100 VU 부하테스트로 재현한 커넥션 풀 병목을 PgBouncer 도입과 Hikari 풀 재조정으로 해결, p95 3.55s→350.8ms·실패율 0.16%→0.00% 달성",
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
    imageFit: "contain",
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
    demoUrl: "https://stlahxm.github.io/llm-markdown-sanitizer/",
    demoGif: {
      src: "/covers/llm-markdown-sanitizer-demo.gif",
      caption: "브라우저에서 실제 PyPI 패키지를 그대로 실행합니다(Pyodide) — 별도 서버 없이 왼쪽에 깨진 마크다운을 붙여넣고 Run을 누르면 오른쪽에 정제된 결과가 나옵니다.",
    },
    metrics: [
      { label: "다운로드", value: "3600+" },
      { label: "자동 정제율", value: "응답 20%+" },
    ],
    stack: ["Python", "Java"],
    problemRoleApproach: [
      {
        label: "문제",
        body: "모릭이 강의 자료를 분석한 결과를 마크다운으로 생성해 렌더링하는데, LLM이 표 직후 리스트·4칸 들여쓰기·언어 태그 없는 코드펜스에서 CommonMark 사양과 어긋나는 마크다운을 반복 생성해 렌더링이 깨지는 문제가 계속 반복됐습니다.",
      },
      {
        label: "역할",
        body: "모릭 서비스 코드에 흩어져 있던 정규식 땜질을 범용 정규화 로직과 도메인 로직으로 분리, 별도 오픈소스 라이브러리로 설계·개발",
        tags: ["Python", "Java"],
      },
      {
        label: "접근",
        body: "표 직후 리스트, 들여쓰기 스케일, 코드펜스 오검출 등 증상별로 줄 단위 정규화 로직을 작성하고, 각 케이스를 회귀 테스트로 고정해 재발을 막았습니다.",
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
  {
    slug: "lc4j-lens",
    no: "03",
    badge: "LZ",
    icon: "/logos/lc4j-lens-icon.png",
    name: "lc4j-lens",
    period: "2026.09 ~",
    tag: "LangChain4j EmbeddingStore 디버깅 오픈소스",
    summary: "RAG 리트리버가 왜 그 청크를 골랐는지, 로컬에서 t-SNE로 시각화해서 보여주는 도구",
    links: [
      { label: "GitHub", href: "https://github.com/stlahxm/lc4j-lens" },
      { label: "Discussion", href: "https://github.com/langchain4j/langchain4j/discussions/6327" },
    ],
    metrics: [],
    subtitle:
      "\"가까운 점 = 의미적으로 비슷한 청크\"가 성립하려면 이웃 관계를 보존하는 축소 기법이어야 한다는 걸, PCA로 한 번 틀려보고서야 알았습니다.",
    stack: ["Java 17", "LangChain4j", "t-SNE (bh-tsne)", "JDK HttpServer"],
    problemRoleApproach: [
      {
        label: "배경",
        body: "LangChain4j로 RAG를 붙이면서 리트리버가 이상한 청크를 반환할 때마다 원인을 찾기가 막막했습니다. EmbeddingStore는 벡터 유사도 순으로 결과만 돌려줄 뿐, '왜 이 청크가 뽑혔는지'를 실제로 눈으로 확인할 방법이 없었습니다. 로그로 코사인 유사도 숫자만 보고 감으로 판단하던 게 불편해서, 저장된 임베딩 전체를 눈에 보이는 지도로 만들면 되겠다는 생각으로 시작했습니다.",
      },
      {
        label: "무엇을 해결하나",
        body: "쿼리를 던지면 EmbeddingStore에 저장된 모든 벡터와 쿼리 벡터를 함께 2차원으로 배치해, 실제로 가까운 벡터가 화면에서도 가깝게 보이도록 시각화합니다. 서버·DB·API 키 없이 로컬에서 바로 실행되고, 저장할 때 쓴 임베딩 모델과 조회할 때 쓴 모델이 다르면 그 자체를 오류로 감지해 경고합니다.",
      },
      {
        label: "만들며 겪은 문제",
        body: "처음엔 PCA로 차원을 축소했는데, PCA는 데이터 전체의 분산 방향만 보존할 뿐 '가까운 점 = 비슷한 의미'라는 전제를 보장하지 않아 결과가 별자리처럼 무의미하게 흩어져 보였습니다. 이웃 관계(로컬 구조)를 보존하는 t-SNE로 바꾸고 나서야, 실제로 의미적으로 비슷한 청크들이 화면에서도 뭉쳐서 나타났습니다.",
      },
    ],
    contributions: [
      {
        title: "PCA → t-SNE 전환",
        desc: "이웃 유사도를 보존하지 않는 PCA 대신 t-SNE로 교체해, 의미적으로 가까운 청크가 시각적으로도 가깝게 나오도록 수정",
      },
      {
        title: "임베딩 모델 불일치 감지",
        desc: "저장 시 사용한 임베딩 모델과 조회 시 모델이 다르면 자동으로 감지해 화면에 경고를 표시",
      },
    ],
  },
  {
    slug: "llm-cassette",
    no: "04",
    badge: "LC",
    icon: "/logos/llm-cassette-icon.png",
    name: "llm-cassette",
    period: "2026.09 ~",
    tag: "LangChain4j ChatModel용 VCR 스타일 테스트 오픈소스",
    summary: "Claude Code·Cursor 같은 에이전트가 빠르게 바꾸는 프롬프트의 회귀를, 기존 CI 파이프라인에서 그대로 잡아내는 JUnit5 확장",
    links: [{ label: "GitHub", href: "https://github.com/stlahxm/llm-cassette" }],
    metrics: [],
    subtitle:
      "\"AI 에이전트가 diff 속에 묻어서 바꾼 프롬프트\"를 잡아내는 데는, 매번 API를 호출하는 통합 테스트가 아니라 한 번 기록하고 계속 재생하는 VCR 방식이 더 맞았습니다.",
    stack: ["Java 17", "JUnit5", "LangChain4j", "Jackson"],
    problemRoleApproach: [
      {
        label: "배경",
        body: "Claude Code나 Cursor 같은 에이전트로 기능을 빠르게 만들다 보면, 프롬프트 텍스트가 몇백 줄짜리 diff 속에 묻혀서 조용히 바뀌는 경우가 있습니다. 리뷰어도 사람도 그걸 한 줄 한 줄 다 확인하지 못하고 넘어가고, 나중에 모델 응답 품질이 미묘하게 달라진 다음에야 원인을 찾아 거슬러 올라가는 식이었습니다.",
      },
      {
        label: "무엇을 해결하나",
        body: "실제 모델 호출을 한 번 기록해두면, 그 다음부터는 기록된 요청과 지금 나가는 요청을 비교해서 프롬프트나 temperature 같은 파라미터가 조금이라도 달라지면 테스트가 실패합니다. API 키 없이도, 매번 실제 모델을 호출하지 않고도 CI에서 그대로 잡아낼 수 있습니다.",
      },
      {
        label: "만들며 겪은 문제",
        body: "매번 실제 API를 호출하는 통합 테스트로는 비용도 크고 응답이 결정적이지 않아 CI에 넣기 어려웠습니다. LangChain4j의 ChatModel이 결국 doChat(ChatRequest) 한 지점을 거친다는 데 착안해 그 지점만 가로채는 데코레이터로 구현했고, 실제로 CI에서 통하는지 확인하려고 이 저장소 밖에 별도의 Maven·Gradle 프로젝트를 만들어 진짜 exit code와 diff 출력까지 검증했습니다.",
      },
    ],
    contributions: [
      {
        title: "기록/재생/diff 핵심 로직 구현",
        desc: "ChatModel.doChat() 단일 지점을 가로채는 데코레이터로 기록·재생·diff·미사용 감지까지 구현, IntelliJ가 자동으로 diff를 렌더링하도록 opentest4j 타입을 그대로 재사용",
      },
      {
        title: "Maven/Gradle 실제 소비자 프로젝트로 검증",
        desc: "이 저장소 자체 테스트뿐 아니라 별도로 만든 Maven·Gradle 프로젝트에서 실제 exit code와 diff 출력을 확인해, CI에서 정말 실패로 잡히는지 검증",
      },
    ],
  },
];
