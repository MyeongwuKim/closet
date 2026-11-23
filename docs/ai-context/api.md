# API와 데이터 맥락

## 요청과 오류 처리

`apps/api`는 Fastify·Apollo GraphQL을 사용한다. [app.ts](../../apps/api/src/app.ts)는 `/health`, `/graphql`과 광고 검증용 `GET /ads/admob/reward` 경로를 등록한다. 기본 포트는 4000이다. 브라우저 허용 출처는 `WEB_ORIGIN`과 WebView 기준 주소 `https://closet.native`로 구성된다.

GraphQL 계약은 [schema.ts](../../apps/api/src/graphql/schema.ts), 기능별 resolver 조합은 [resolvers.ts](../../apps/api/src/graphql/resolvers.ts)에 있다. 기존 처리 흐름은 resolver → service → repository → Prisma다.

`StyleProfile.thighCircumferenceCm`와 `UpdateMyStyleProfileInput.thighCircumferenceCm`는 선택적인 한쪽 허벅지 둘레(cm)다. 입력 범위는 20~150cm이며, 업데이트에서 생략하면 기존 값을 유지하고 `null`이면 지운다. 저장값이 없는 기존 프로필은 `null`로 조회한다. 바지의 `thighWidthCm`는 옷의 단면으로 별도 관리하며, 두 값의 비교와 생성 지침은 [룩북 체형과 기장](lookbook-proportions.md)에 있다.

[errors.ts](../../apps/api/src/graphql/errors.ts)는 `ServiceError.code`를 GraphQL의 `extensions.code`로 전달한다. 웹의 로그인 만료·사용권 부족·작업 복원 분기가 이 코드를 사용한다. GraphQL 요청 전체의 크기 제한과 이미지 개별 입력 검증은 서로 다른 단계에 있다.

## 인증 현황

[context.ts](../../apps/api/src/graphql/context.ts)는 Bearer 토큰에서 요청별 사용자 조회를 제공한다. [auth.service.ts](../../apps/api/src/features/auth/auth.service.ts)의 테스트 로그인은 기존 계정을 검증하거나 새 ID의 계정을 생성하고 서버 세션을 저장한다. 테스트 로그인도 실제 API DB를 사용한다.

토큰은 임의 문자열이며 서버에는 [sessionToken.ts](../../apps/api/src/features/auth/sessionToken.ts)의 해시로 저장된다. JWT 검증 구조가 아니다. 로그아웃은 세션과 해당 세션의 푸시 기기 등록을 함께 제거한다.

`myAccount`는 인증된 본인의 이름·이메일·테스트 로그인 ID만 반환한다. 사용자 ID 인자를 받지 않으며 `userRepository.findAccountInfoById`는 비밀번호·세션 정보를 선택하지 않는다. 계정 관리 화면 전용 조회이고 기존 `Viewer` 설정 응답과 분리한다. 인증·조회 필드·다른 사용자 지정 거절 검사는 `features/user/account-info.test.ts`다.

`deleteMyAccount(confirmation: "회원탈퇴")`는 인증된 본인의 회원탈퇴다. `account-deletion.service.ts`가 최종 확인을 검증하고 repository가 모든 세션·푸시 기기·계정 연결·설정·옷·코디·날짜 기록·생성 작업·사용권·AI 캐시를 한 트랜잭션에서 삭제한다. 오류 시 전체를 롤백하며 사용자 ID 인자를 받지 않는다. 원격 사진 번호는 계정 정보가 없는 `AccountImageCleanup` 큐에 먼저 남기고 커밋 후 worker가 CF 삭제를 재시도한다. 늦은 업로드 저장은 탈퇴와 같은 계정 잠금을 거쳐 거절하고, 원격 정리 실패도 이 큐에 남긴다. 세부 파일 수명은 [이미지 정리](media-jobs.md#이미지-보관교체정리-배치)에 있다. 단위 검사는 `features/user/account-deletion.test.ts`, 실제 MongoDB 검사는 `account-deletion.integration.test.ts`다.

[auth.resolvers.test.ts](../../apps/api/src/features/auth/auth.resolvers.test.ts)는 메모리 계정·세션 저장소를 사용해 GraphQL에서 잘못된 비밀번호, 만료된 세션, 로그아웃한 토큰을 거절하는지와 같은 계정의 다른 세션이 유지되는지 확인한다.

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

`WardrobePageInput.colors`·`brandNames`·`tags`는 같은 항목 안에서 OR, 항목 사이에서는 AND로 적용한다. `includeUnbranded`는 선택한 브랜드와 미지정 옷을 함께 포함한다. 기존 `color`·`brandName`·`tag`도 복수 입력과 합쳐 처리하며, `unbrandedOnly`의 미지정 단독 조회 우선순위는 유지한다. `catalog.service.ts`의 페이지 조회와 개수 집계는 같은 사용자·활성 옷 조건을 사용하며, `catalog.service.test.ts`에서 복수 조건·기존 입력 호환·GraphQL 입력·태그 조회 경로를 검사한다.

보관 삭제한 옷의 원본·누끼 사진은 실제 코디·날짜·진행 작업 참조가 모두 없어진 뒤 기존 이미지 배치에서 정리한다. 새 참조 저장과 정리는 `features/wardrobe/wardrobe-image-lifecycle.ts`의 전용 DB 잠금 키를 같은 트랜잭션 안에서 사용한다. CF 삭제 성공 후 사진 연결만 해제하고 옷 메타데이터는 남긴다. 자세한 후보·재시도·실행 조건은 [이미지 정리](media-jobs.md#이미지-보관교체정리-배치)를 따른다.

`wardrobeRediscovery`는 `features/wardrobe/wardrobe-rediscovery.service.ts`에서 전체 활성 옷장과 오늘까지 실제 착용을 확인한 플래너 기록(`wornAt`)을 읽는다. 배정만 된 일정은 착용 이력·통계·최근 착용과 하이라이트 선정에 반영하지 않는다. 등록 후 30일 이상 지났고 최근 30일간 착용 기록이 없는 분류 완료 옷 중 최대 세 벌을 고른다. 한국 날짜의 월로 판정한 현재 계절을 `seasons`에 포함한 옷만 남긴 뒤 미노출·오래전 노출·오래된 착용일·등록일 순으로 정렬한다. `other`·카테고리/계절 미지정·추천 보류 옷은 제외한다. `lastWornTemperatureC`는 마지막 착용일 기록의 하루 평균 기온이며 해당 날짜에 값이 없으면 null이다. 다른 날짜의 기온이나 예보로 채우지 않는다.

`WardrobeRediscovery` 모델은 사용자 ID를 MongoDB 기본키로 사용하며 당일 선택 ID·마지막 노출일 맵·낙관적 잠금 버전을 보관한다. 조회 시 하루 선택만 준비하고 `markWardrobeRediscoverySeen`에서 실제 보인 옷의 노출일을 갱신한다. 오늘 선정한 현재 계정의 활성 옷만 확인할 수 있고 중복 확인은 다시 쓰지 않는다. 날짜는 한국 기준이며 이 기록은 옷의 `updatedAt`·AI 추천 캐시·사용권과 별개다. 규칙·서비스 검사는 같은 폴더의 `wardrobe-rediscovery.*.test.ts`에 있다.

코디북의 `CreateOutfitItemInput.slot`은 선택 항목이다. 기존 호출은 등록된 대표 카테고리를 사용한다. 직접 코디북을 구성할 때는 아우터와 중간 아우터 중 해당 옷에 등록된 위치를 지정할 수 있다. 코디의 위치는 `OutfitItem.slot`에 기록하며 옷장 분류는 바뀌지 않는다.

코디북의 받쳐 입는 옷은 `OutfitItem.isBaseLayer`가 true인 상의다. 몸에 가까운 순서를 `layerOrder`에 저장한다. 누락과 null은 일반 옷으로 처리하며, 날짜별 복사본에도 역할과 순서를 보존한다. 기존 MongoDB 문서에 값을 채우거나 인덱스를 바꿀 필요가 없다. `setDirectPlannerEntry`에서 선택 입력 `items`를 보내면 `itemIds`와 같은 순서의 같은 아이템이어야 하며 위치와 받쳐 입는 역할을 날짜 코디에도 저장한다. 선택한 `seasons`를 보내면 날짜 코디에 저장하고, 생략하면 선택한 옷의 공통 계절을 사용한다.

코디북과 날짜별 `plannerOnly` 복사본은 서로 독립된 코디다. 코디북 수정·삭제 전에는 기존 직접 연결 날짜도 분리 보존하며, 플래너에서 코디북 저장은 별도 복사로 처리한다. 코디 삭제의 이전 이미지는 현재 날짜·다른 코디의 참조 검사를 거쳐 정리한다. 이미지의 임시·영구 보관과 사용권은 [이미지와 생성 작업](media-jobs.md)에 있다.

원피스 한 벌은 코디북과 플래너 날짜에 코디로 저장할 수 있다. 새 구성은 보유 중인 활성 옷과 완성 조건을 검증한다. 플래너의 착용 완료 기록을 변경하는 조건은 [플래너와 날씨](planner-weather.md#일정과-착용-데이터)에 있다.

`WardrobeItem.storageLocation`은 선택적인 현재 보관 장소이며 40자 이내로 공백·유니코드를 정규화한다. 수정에서 생략하면 유지하고 null·빈 문자열이면 지운다. `wearAvoidanceReason`은 최신 사용자 입력 사유(`hard_to_style`, `fit_issue`, `temporarily_unused`)이며 재발견 응답의 시스템 선정 근거 `reason`과 다르다. `recommendationResumeOn`은 한국 날짜 문자열이다. 일시 보류를 설정할 때 유효한 내일 이후 날짜를 요구하고 사유를 지우거나 다른 사유로 바꾸면 재개일도 비운다. 기존 누락 필드는 null로 반환한다. 조회·수정은 기존 소유권 검사를 유지한다.

옷 생성의 선택 입력 `registrationRequestId`는 클라이언트가 사진 후보에 부여한 UUID v4다. 서버는 사용자와 요청 키로 기존 등록을 조회하며 동시 생성은 기존 DB 트랜잭션·요청별 mutex로 직렬화한다. 같은 요청의 재시도는 기존 옷을 반환하고, 그 옷을 이미 삭제했다면 `WARDROBE_REGISTRATION_ARCHIVED`로 거절한다. 사진 참조 잠금과 소유권·업로드 완료 검증도 유지한다. API 계약·입력·재시도 검사는 `wardrobe-preferences.test.ts`, `wardrobe.service.test.ts`, `wardrobe-registration.test.ts`다. DB를 대체한 단위 검사는 실제 MongoDB 잠금 검증과 구분한다.

## DB와 공용 계약

MongoDB 모델과 관계는 [schema.prisma](../../apps/api/prisma/schema.prisma), Prisma Client는 [prisma.ts](../../apps/api/src/lib/prisma.ts)에 있다. AI 저장소·사용권·날씨 위치 변경에는 MongoDB 트랜잭션을 사용하는 경로가 있다.

공용 도메인 타입은 [packages/types/src/index.ts](../../packages/types/src/index.ts)에 있다. [packages/types/package.json](../../packages/types/package.json)의 `outfit-items`·`outfit-colors` export는 런타임 `.js`와 `.d.ts` 선언을 각각 가리킨다. GraphQL 스키마·공용 타입·클라이언트의 요청과 변환 타입은 각각 관리된다.

[index.ts](../../apps/api/src/index.ts)는 환경 로딩, 저장소·인덱스 준비, 공유 AI 실행기 설치, 미리보기·착용 날씨 워커 시작과 종료를 담당한다. 준비 실패 시 메모리 구현으로 우회하지 않고 시작을 중단한다. 테스트가 사용하는 `buildApp()`은 서버 시작과 워커 설치를 포함한 이 진입점과 별개다.

`features/push/rediscovery-push.service.ts`의 worker도 서버 진입점에서 시작·종료한다. `UserSettings.rediscoveryPushEnabled`는 기본 false이며 인증된 본인만 별도 mutation으로 변경한다. 같은 값의 저장은 예약을 초기화하지 않는다. 켠 다음 한국 시간 오전 9시부터 매분 도래 계정을 최대 50개씩 확인하고 오후 8시부터 다음 오전 9시 전까지는 보내지 않는다. `rediscoveryPushNextAt`의 원자적 갱신으로 계정당 최소 7일 발송 간격과 여러 서버의 중복 방지를 유지한다. 현재 재발견 후보 또는 활성 세션 기기가 없으면 다음 아침에 재검사하고, 실제 전송 실패는 부분 수신 중복을 피하려고 주간 예약을 유지한다. 전송 직전 동의를 다시 확인하며 목록 조회만으로 노출 이력이나 AI 사용권을 사용하지 않는다. 새 필드·복합 인덱스는 Prisma 스키마에 정의하며 배포 시 기존 DB 스키마 반영 절차를 따른다. 검사는 `rediscovery-push.service.test.ts`·`rediscovery-push.repository.test.ts`다.

## 관련 검사

`UserSettings.completionPushEnabled`는 기존 동작을 유지하는 기본 true다. `Viewer`에 같은 이름으로 반환하고 인증된 본인의 `setCompletionPushEnabled`로만 변경한다. 설정이 없거나 기존 문서에 필드가 없으면 true로 취급한다. `pushService.sendCompletion`·`sendFailure`는 발송 시 현재 설정을 확인해 false면 건너뛰며, 테스트 발송·주간 재발견과 앱 안의 완료 UI는 독립적이다. 검사는 `user/completion-push-preference.test.ts`와 `push/push.service.test.ts`다. 실제 DB 변경 없이 테스트 대체 저장소·전송기로 확인한다.

API 타입 검사는 `pnpm --filter @closet/api typecheck`, 공용 타입 검사는 `pnpm --filter @closet/types typecheck`다. API 테스트는 주로 구현 옆의 `*.test.ts`에 있다.

통합 테스트의 DB 조건과 개별 테스트 실행 예시는 [개발과 검증](development.md#단위-테스트와-통합-테스트)에 있다.
