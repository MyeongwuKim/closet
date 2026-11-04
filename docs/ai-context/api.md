# API와 데이터 맥락

## 요청과 오류 처리

`apps/api`는 Fastify·Apollo GraphQL을 사용한다. [app.ts](../../apps/api/src/app.ts)는 `/health`, `/graphql`과 광고 검증용 `GET /ads/admob/reward` 경로를 등록한다. 기본 포트는 4000이다. 브라우저 허용 출처는 `WEB_ORIGIN`과 WebView 기준 주소 `https://closet.native`로 구성된다.

GraphQL 계약은 [schema.ts](../../apps/api/src/graphql/schema.ts), 기능별 resolver 조합은 [resolvers.ts](../../apps/api/src/graphql/resolvers.ts)에 있다. 기존 처리 흐름은 resolver → service → repository → Prisma다.

[errors.ts](../../apps/api/src/graphql/errors.ts)는 `ServiceError.code`를 GraphQL의 `extensions.code`로 전달한다. 웹의 로그인 만료·사용권 부족·작업 복원 분기가 이 코드를 사용한다. GraphQL 요청 전체의 크기 제한과 이미지 개별 입력 검증은 서로 다른 단계에 있다.

## 인증 현황

[context.ts](../../apps/api/src/graphql/context.ts)는 Bearer 토큰에서 요청별 사용자 조회를 제공한다. [auth.service.ts](../../apps/api/src/features/auth/auth.service.ts)의 테스트 로그인은 기존 계정을 검증하거나 새 ID의 계정을 생성하고 서버 세션을 저장한다. 테스트 로그인도 실제 API DB를 사용한다.

토큰은 임의 문자열이며 서버에는 [sessionToken.ts](../../apps/api/src/features/auth/sessionToken.ts)의 해시로 저장된다. JWT 검증 구조가 아니다. 로그아웃은 세션과 해당 세션의 푸시 기기 등록을 함께 제거한다.

네이티브 Apple·Google 로그인은 아직 연결되지 않았고, `apps/native/src/auth/nativeProviderAuth.ts`에서 연결 전 오류를 반환한다. 루트 README에는 로그인·저장·날씨·AI 연결 전 단계의 설명이 남아 있어 현재 코드와 차이가 있다.

## 기능과 데이터 경계

| API 기능 폴더 | 담당 데이터·처리 |
| --- | --- |
| `features/auth`, `features/user` | 로그인·세션, 프로필·스타일·착용 알림 설정 |
| `features/wardrobe`, `features/catalog` | 옷장 CRUD·보관, 카테고리·브랜드·통계 |
| `features/classification`, `features/image` | 이미지 분석, 업로드와 이미지 메타데이터 |
| `features/outfit` | 코디 구성·저장·추천, 미리보기 작업 |
| `features/planner`, `features/weather` | 일정·최근 착용, 위치·예보·착용 기온 |
| `features/preview-credits`, `features/push` | 공통 AI 사용권·광고 검증, 세션별 푸시 기기·알림 |

위 경로는 `apps/api/src` 기준이다. 옷장 삭제 동작은 [wardrobe.service.ts](../../apps/api/src/features/wardrobe/wardrobe.service.ts)의 보관 처리와 `archivedAt`을 사용한다. 활성 옷장 필터와 관계 데이터는 [wardrobe.repository.ts](../../apps/api/src/features/wardrobe/wardrobe.repository.ts)에 있다.

GraphQL `WardrobeItem.archivedAt`은 nullable ISO 문자열이며 기존 누락 필드는 null로 반환한다. 코디북·플래너 코디의 옷 관계는 보관 삭제한 옷도 반환해 이름·사진과 삭제 상태를 유지한다. 일반 옷장 조회·새 선택·추천의 활성 필터는 그대로 적용한다. 계약 검사는 `features/wardrobe/wardrobe.resolvers.test.ts`에 있다.

보관 삭제한 옷의 원본·누끼 사진은 실제 코디·날짜·진행 작업 참조가 모두 없어진 뒤 기존 이미지 배치에서 정리한다. 새 참조 저장과 정리는 `features/wardrobe/wardrobe-image-lifecycle.ts`의 전용 DB 잠금 키를 같은 트랜잭션 안에서 사용한다. CF 삭제 성공 후 사진 연결만 해제하고 옷 메타데이터는 남긴다. 자세한 후보·재시도·실행 조건은 [이미지 정리](media-jobs.md#이미지-보관교체정리-배치)를 따른다.

`wardrobeRediscovery`는 `features/wardrobe/wardrobe-rediscovery.service.ts`에서 전체 활성 옷장과 오늘까지 실제 착용을 확인한 플래너 기록(`wornAt`)을 읽는다. 배정만 된 일정은 착용 이력·통계·최근 착용과 하이라이트 선정에 반영하지 않는다. 등록 후 30일 이상 지났고 최근 30일간 착용 기록이 없는 분류 완료 옷 중 최대 세 벌을 고른다. 노출되지 않았거나 가장 오래전에 노출된 옷부터 순환하고, 노출일이 같으면 현재 계절·오래된 착용일·등록일 순으로 정렬한다. `other`·카테고리/계절 미지정 옷은 제외한다.

`WardrobeRediscovery` 모델은 사용자 ID를 MongoDB 기본키로 사용하며 당일 선택 ID·마지막 노출일 맵·낙관적 잠금 버전을 보관한다. 조회 시 하루 선택만 준비하고 `markWardrobeRediscoverySeen`에서 실제 보인 옷의 노출일을 갱신한다. 오늘 선정한 현재 계정의 활성 옷만 확인할 수 있고 중복 확인은 다시 쓰지 않는다. 날짜는 한국 기준이며 이 기록은 옷의 `updatedAt`·AI 추천 캐시·사용권과 별개다. 규칙·서비스 검사는 같은 폴더의 `wardrobe-rediscovery.*.test.ts`에 있다.

코디북과 날짜별 `plannerOnly` 복사본은 서로 독립된 코디다. 코디북 수정·삭제 전에는 기존 직접 연결 날짜도 분리 보존하며, 플래너에서 코디북 저장은 별도 복사로 처리한다. 코디 삭제의 이전 이미지는 현재 날짜·다른 코디의 참조 검사를 거쳐 정리한다. 이미지의 임시·영구 보관과 사용권은 [이미지와 생성 작업](media-jobs.md)에 있다.

## DB와 공용 계약

MongoDB 모델과 관계는 [schema.prisma](../../apps/api/prisma/schema.prisma), Prisma Client는 [prisma.ts](../../apps/api/src/lib/prisma.ts)에 있다. AI 저장소·사용권·날씨 위치 변경에는 MongoDB 트랜잭션을 사용하는 경로가 있다.

공용 도메인 타입은 [packages/types/src/index.ts](../../packages/types/src/index.ts)에 있다. [packages/types/package.json](../../packages/types/package.json)의 `outfit-items`·`outfit-colors` export는 런타임 `.js`와 `.d.ts` 선언을 각각 가리킨다. GraphQL 스키마·공용 타입·클라이언트의 요청과 변환 타입은 각각 관리된다.

[index.ts](../../apps/api/src/index.ts)는 환경 로딩, 저장소·인덱스 준비, 공유 AI 실행기 설치, 미리보기·착용 날씨 워커 시작과 종료를 담당한다. 준비 실패 시 메모리 구현으로 우회하지 않고 시작을 중단한다. 테스트가 사용하는 `buildApp()`은 서버 시작과 워커 설치를 포함한 이 진입점과 별개다.

## 관련 검사

API 타입 검사는 `pnpm --filter @closet/api typecheck`, 공용 타입 검사는 `pnpm --filter @closet/types typecheck`다. API 테스트는 주로 구현 옆의 `*.test.ts`에 있다.

통합 테스트의 DB 조건과 개별 테스트 실행 예시는 [개발과 검증](development.md#단위-테스트와-통합-테스트)에 있다.
