# 가계부

나만 쓰는 데스크톱용 웹 가계부. 키보드로 빠르게 기록하고, 돈의 흐름을 한눈에 봅니다.

> 이전 버전(React + Spring Boot)은 [`legacy`](../../tree/legacy) 브랜치에 있습니다.

## 할 수 있는 것 (1단계)

- **빠른 입력** — 어디서든 `N`을 누르고 한 줄로 기록
  - `점심 김밥 4500 카드` → 지출 · 식비 · 신용카드
  - `월급 3,200,000` → 수입 · 급여 · 통장
  - `카드값 450000` → 통장 → 신용카드 이체
  - `어제 택시 12만5천 #출장` → 날짜, 한글 금액 단위, 태그까지
- **명령 팔레트** (`⌘K`) — 페이지 이동, 카테고리별 내역, 그리고 `커피 4500`을 치면 바로 기록
- **거래 내역** — 날짜별로 묶인 표, 월 이동(`[` `]`), 유형·계좌·카테고리 필터, 검색(`/`), `J`/`K`로 이동, `Enter` 수정, `⌫` 삭제(되돌리기 가능)
- **대시보드** — 이번 달 지출(지난달 같은 기간 대비), 수입, 수지, 순자산 / 누적 지출 그래프 / 카테고리별 지출 / 최근 6개월 / 계좌 잔액
- **계좌** — 현금·통장·카드·투자. 잔액은 거래로 자동 계산
- **카테고리** — 아이콘·색·키워드 편집. 키워드가 빠른 입력의 자동 분류 기준
- 다크 모드, 한국 시간 기준 날짜

## 돈 모델

- 모든 거래는 **계좌**에 속합니다. 종류는 **수입 / 지출 / 이체**.
- 신용카드는 계좌입니다. 카드로 쓰면 카드 잔액이 마이너스(=갚을 돈)가 되고, **카드값 납부는 통장 → 카드 이체**입니다. 그래서 카드 지출이 두 번 잡히지 않습니다.
- 잔액은 저장하지 않고 `시작 잔액 + 거래 합계`로 계산합니다. 어긋날 일이 없습니다.
- 순자산 = 모든 계좌 잔액의 합.

## 실행

필요한 것: Node 24+, Docker

```bash
docker compose up -d          # Postgres (localhost:5433)
cp .env.example .env.local    # BETTER_AUTH_SECRET을 `openssl rand -base64 32` 값으로 바꾸기
npm install
npm run db:migrate
npm run db:seed               # (선택) 5개월치 데모 데이터. 계정 정보는 scripts/seed.ts
npm run dev                   # http://localhost:3000
```

| 스크립트 | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | 빠른 입력 파서 테스트 (Vitest) |
| `npm run typecheck` / `lint` | 타입 검사 / ESLint |
| `npm run db:generate` | 스키마 변경 후 마이그레이션 생성 |
| `npm run db:migrate` | 마이그레이션 적용 |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | 데모 데이터 |

## 단축키

| 키 | 동작 |
|---|---|
| `N` | 빠른 입력 |
| `⌘K` | 명령 팔레트 |
| `G` → `D` / `T` / `W` / `C` | 대시보드 / 거래 내역 / 계좌 / 카테고리 |
| `[` `]` | 이전 / 다음 달 |
| `/` | 검색 |
| `J` `K` · `Enter` · `⌫` | 거래 선택 · 수정 · 삭제 |
| `?` | 단축키 도움말 |

빠른 입력 안에서: `Enter` 저장, `⇧Enter` 저장하고 계속, `Tab` 자세히 편집.
한글 자판 상태에서도 동작합니다.

## 기술 스택

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Recharts · Drizzle ORM · PostgreSQL 18 · Better Auth · Zod · Vitest

```
src/
  app/(app)/        로그인 후 화면: 대시보드, 거래 내역, 계좌, 카테고리
  app/login/        로그인 / 회원가입
  components/       화면 컴포넌트 (app/: 사이드바·팔레트·단축키, transactions/, dashboard/, ...)
  db/               Drizzle 스키마 (schema.ts), 인증 테이블 (auth-schema.ts)
  lib/              quick-entry.ts(파서), dates.ts(KST), money.ts, auth
  server/           queries.ts(조회), actions.ts(Server Actions), session.ts
drizzle/            마이그레이션
scripts/seed.ts     데모 데이터
```

## 로드맵

1. ~~뼈대 + 빠른 입력~~ ✅
2. 카드사·은행 엑셀 드래그&드롭, AI 한 줄 입력, 결제 캡처 붙여넣기, 반복 거래, 예산과 "오늘 쓸 수 있는 돈"
3. 지출 잔디 캘린더, 무지출 스트릭·챌린지, 소비 만족도, 월간·연말 리포트
4. AI에게 질문하기, 구독 감지, 여행 모드, 더치페이
