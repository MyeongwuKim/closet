# 개발과 검증 참고

각 명령의 작업 디렉터리는 저장소 루트다. 버전과 스크립트 정의는 [루트 package.json](../../package.json)과 각 앱의 `package.json`에 있다.

## 실행과 환경

| 목적 | 명령 |
| --- | --- |
| 의존성 설치 | `pnpm install` |
| 웹·API 개발 | `pnpm dev` |
| 개별 개발 | `pnpm web:dev` / `pnpm api:dev` |
| Expo 개발 클라이언트 | `pnpm native:dev` |
| 네이티브 웹 번들 생성·반영 | `pnpm native:bundle` / `pnpm native:web:sync` |
| iOS 로컬·실기기 | `pnpm native:ios:local` / `pnpm native:ios:device` |
| Android 로컬 | `pnpm native:android:dev` |

| 환경 | 참고 파일 | 주요 값·조건 |
| --- | --- | --- |
| API | [apps/api/.env.example](../../apps/api/.env.example) | 현재 예제는 광고 설정만 포함한다. `DATABASE_URL`, 사용할 `OPENAI_API_KEY`·이미지 저장소 등의 서버 설정은 별도 준비 대상이다. |
| 웹 | [apps/web/.env.example](../../apps/web/.env.example) | `VITE_API_URL`. 전송 함수의 미설정 기본 주소는 `http://localhost:4000`이다. |
| 네이티브 | [apps/native/.env.example](../../apps/native/.env.example) | `EXPO_PUBLIC_API_URL`과 선택한 앱 환경. 실제 기기에서 접근 가능한 API 주소가 필요하다. |

API 기본 포트는 4000이며 `api:dev`는 시작 전 Prisma Client를 생성한다. 서버 시작은 DB 저장소·인덱스 준비와 worker 실행도 포함한다. API를 띄우는 것만으로 격리된 테스트 환경이 만들어지지는 않는다.

`db:push`는 DB 스키마를 반영한다. 이미지 정리 CLI는 기본적으로 삭제 후보만 확인하고 `--execute`에서 실제 삭제한다. 환경 선택과 번들 전달 구조는 [네이티브](native.md#빌드-환경과-검사)에 있다.

## 타입과 정적 검사

| 대상 | 명령 |
| --- | --- |
| 웹 타입 | `pnpm --filter @closet/web exec tsc -b` |
| 웹 lint | `pnpm --filter @closet/web lint` |
| API 타입 | `pnpm --filter @closet/api typecheck` |
| 공용 타입 | `pnpm --filter @closet/types typecheck` |
| 네이티브 타입 | `pnpm --filter @closet/native typecheck` |
| E2E 코드 타입 | `pnpm typecheck:e2e` |

웹에는 전용 `typecheck` 스크립트가 없다. 루트 `pnpm typecheck`는 네이티브 검사에 포함된 웹 빌드를 통해 웹 타입을 간접 검사하며 네이티브 환경 설정과 번들 생성이 필요하다. 루트 `pnpm lint`는 스크립트가 정의된 웹 패키지만 검사한다.

`typecheck:e2e`는 브라우저 E2E와 AI 테스트용 tsconfig를 모두 검사하지만 브라우저·DB·AI 호출은 실행하지 않는다. [CI 검사](../../.github/workflows/regression.yml)는 main push에서 Node 22로 타입, API·웹 단위 테스트, 빌드, 모의 E2E 순으로 실행한다. 실제 DB 통합 테스트는 별도 실행이 필요하다.

## 단위 테스트와 통합 테스트

API 테스트는 주로 구현 옆의 `*.test.ts`, 웹 단위 테스트는 `apps/web/tests/*.test.ts`, 네이티브 테스트는 `apps/native/scripts/*.test.mjs`에 있다. API에 설치된 `tsx`로 TypeScript 테스트를 실행할 수 있다.

`pnpm test:unit:api`와 `pnpm test:unit:web`은 각각 API `src`와 웹 `tests` 아래의 `*.test.ts`를 재귀적으로 찾고 `*.integration.test.ts`는 제외한다. 둘 다 API의 `tsx`를 사용하고, 웹 단위 검사는 웹의 JSX 설정을 함께 읽는다. 처음 실행할 때는 `pnpm --filter @closet/api db:generate`로 Prisma Client를 준비한다. 단위 테스트에는 실제 API 서버나 DB 연결이 필요하지 않다.

```sh
# API 단위 테스트 한 파일
pnpm --filter @closet/api exec node --import tsx --test src/features/outfit/outfit-color-rules.test.ts

# 웹 단위 테스트 한 파일
pnpm --filter @closet/api exec node --import tsx --test ../../apps/web/tests/formatPlanPeriodLabel.test.ts

# 네이티브 위치 브리지
pnpm --filter @closet/native test:location-bridge

# TypeScript를 직접 import하는 네이티브 GraphQL 테스트
pnpm --filter @closet/api exec node --import tsx --test ../native/scripts/graphql-bridge.test.mjs
```

GraphQL·알림 이동처럼 TypeScript를 직접 import하는 `.mjs`는 로컬 Node 20 기준으로 로더 없는 `node --test`로 실행되지 않는다. 반면 자체 변환을 하는 카메라·위치 테스트 등에는 기존 패키지 명령이 있다.

`pnpm test:ai:rules`는 API의 `test:colors`에 정의된 일부 검사다. `outfit-style-rules.test.ts`, 설명·사용권·웹 추천 기록 테스트는 이 묶음 밖이므로 개별 파일 선택 대상이다.

| 실제 DB 통합 검사 | 실행 조건과 데이터 영향 |
| --- | --- |
| 공유 실행기·미리보기 작업·공통 사용권 | `AI_INTEGRATION_DATABASE`가 skip을 제어한다. DB 연결은 별도의 `DATABASE_URL`을 사용하며 플래그 자체가 주소를 테스트 DB로 바꾸지 않는다. |
| 이미지 참조·고아·삭제 옷 사진 정리 | `TEST_DATABASE_URL`에 별도의 빈 `closet_image_orphan_test_숫자` MongoDB 주소를 지정한다. `image-orphan-cleanup.integration.test.ts`와 `archived-wardrobe-image-cleanup.integration.test.ts`는 각각 독립 프로세스·별도 빈 DB에서 실행한다. 트랜잭션을 지원하는 테스트 인스턴스가 필요하며 종료 시 소유한 전용 DB를 삭제한다. CF는 대체한다. |
| 테스트 사용권 충전 | `TEST_CREDIT_REFILL_INTEGRATION_DATABASE`로 실행을 제어하고 별도 `DATABASE_URL`의 DB 이름이 `closet_credit_refill_test_숫자`인지 검사한다. 종료 시 해당 DB를 삭제하므로 새로 만든 빈 DB만 지정한다. |
| 착용 날씨 | `WEAR_WEATHER_INTEGRATION_DATABASE`로 실행을 제어한다. DB 이름이 `closet_wear_weather_test_숫자` 형식인지 검사한다. 종료 시 해당 DB를 삭제하므로 새로 만든 빈 DB만 지정한다. |
| 최근 착용 리마인드 | `RECENT_WEAR_INTEGRATION_DATABASE`로 실행을 제어하며 별도 `DATABASE_URL`의 DB 이름이 `closet_recent_wear_test_숫자`인지 검사한다. 기존 컬렉션이 없는 DB에서만 테스트 사용자·착용 기록을 만들고 로그인 GraphQL 조회를 검증한다. 종료 시 해당 DB를 삭제한다. |
| 스타일 프로필 허벅지 둘레 | `STYLE_PROFILE_INTEGRATION_DATABASE=1`과 별도의 빈 `DATABASE_URL`을 사용한다. `user-style-profile.integration.test.ts`는 DB 이름이 `closet_style_profile_test_숫자`이고 38바이트 이하인지, 컬렉션이 없는지 검사한다. 인증 GraphQL로 70cm 저장·조회, 생략 유지·null 삭제·범위 밖 거절을 확인하며 종료 시 소유한 전용 DB를 삭제한다. |

첫 그룹의 예시는 `shared-ai-executor.integration.test.ts`, `preview-job.integration.test.ts`, `preview-credit.integration.test.ts`다. 테스트 사용권 충전과 착용 날씨는 플래그에 `0`을 설정해도 실행된다. 검사를 건너뛸 때는 해당 변수를 설정하지 않는다. 환경과 파일별 정리 절차에 따라 실제 인덱스·테스트 데이터가 변경되므로 실행 전에 전용 DB 주소와 정리 범위를 확인한다.

## 브라우저 E2E

[playwright.config.ts](../../playwright.config.ts)는 `127.0.0.1:4173`에 웹 서버를 띄운다. 테스트에서 [mockApi fixture](../../tests/support/fixture.ts)를 사용하면 테스트별 메모리 데이터와 모의 로그인 토큰을 준비하고, GraphQL·업로드를 대체하며 허용되지 않은 외부 통신을 차단한다. 이 구성은 화면과 요청을 검증한다. 로그인 화면부터 시작할 때는 `test.use({ seedMockSession: false })`로 토큰 주입을 끈다. 실제 인증·권한·저장은 API 또는 DB 통합 테스트의 검증 범위다.

개별 실행 예시는 `pnpm exec playwright test tests/plan.spec.ts`다. 기본 설정은 `tests/ai-api`를 제외한다.

## 실제 AI 검사

[playwright.ai.config.ts](../../playwright.ai.config.ts)와 `tests/ai-api`는 실제 GraphQL 처리와 AI HTTP 호출을 검사한다. 계정·옷장·사용권 저장소는 테스트 데이터로 대체하고 DB 주소를 연결 불가능한 로컬 주소로 고정하지만 AI 요청에는 비용이 발생한다. 실행 명령은 `pnpm test:ai:api`다.

[evaluate-colors.ts](../../apps/api/src/cli/evaluate-colors.ts)는 `--live`가 있어야 실제 평가를 실행한다. 사진·원단 영역 fixture, 평가 단계·요청 상한을 사용하고 API 응답과 보고서를 저장한다. 계정·사용권 저장소 대체와 실제 유료 AI 호출은 별개다.

`test:classifier`는 실행 중인 API를 호출하고, `test:background`는 빌드 후 로컬 배경 제거 모델을 실행한다. `evaluate:*`도 일반 단위 테스트와 별개인 평가 스크립트다.

룩북 합성 평가는 `pnpm --filter @closet/api evaluate:lookbook`으로 사용법을 확인한다. `--live`에서만 최대 3회의 유료 생성을 실행하며 실제 DB·Cloudflare는 사용하지 않는다. 케이스·실측·시각 검토 기준은 [룩북 체형과 기장](lookbook-proportions.md#합성-평가)에 있다.
