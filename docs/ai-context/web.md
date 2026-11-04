# 웹 맥락

## 화면과 라우팅

`apps/web`은 React·Vite·Tailwind 기반이다. [router.tsx](../../apps/web/src/app/router.tsx)의 주요 경로는 `/plan`, `/closet`, `/lookbook`, `/settings`다. `/recommend`와 `/profile`에는 호환용 이동 경로가 남아 있다. 브라우저에서는 browser router, 네이티브 런타임에서는 hash router를 사용한다.

로그인 경로 바깥의 주요 화면은 `RequireAuth`와 [AppLayout.tsx](../../apps/web/src/components/layout/AppLayout.tsx)를 거친다. AppLayout은 헤더·탭·화면 Outlet·스크롤 복원과 날씨 지역 동기화를 연결한다. 상세·작성·설정 하위 경로에서는 하단 탭이 숨겨진다.

화면은 `apps/web/src/features/*/pages`, 관련 UI·Hook·API 함수는 같은 기능 폴더에 있다. 공통 스타일은 `apps/web/src/index.css`, 공통 레이아웃은 `apps/web/src/components/layout`에 있다.

## 공통 팝업과 상태

[GlobalUi.tsx](../../apps/web/src/components/GlobalUi.tsx)는 분류 확인·최근 착용 안내·사용권 안내·생성 완료 안내·토스트를 연결한다. 분류 확인은 `useUiStore`의 대기열을 사용한다. 저장 중에는 취소를 막고 완료는 후보 ID로 처리해 다음 사진을 제거하지 않는다.

서버 상태는 TanStack Query, UI 공통 상태는 [useUiStore.ts](../../apps/web/src/stores/useUiStore.ts), 기능별 편집 상태는 각 `features/*/stores`에 있다. 플래너·코디 작성과 분류 확인에 필요한 옷장·룩북 데이터는 GlobalUi에서 Query 결과를 Store에 채우는 경로도 있다. 모든 화면이 전체 옷장·룩북을 항상 조회하는 구조는 아니다.

[usePreviewJobNotification.ts](../../apps/web/src/features/lookbook/hooks/usePreviewJobNotification.ts)는 미확인 생성 결과를 조회한다. 백그라운드에서는 안내를 멈추고, 이번 실행에서 전경에 열어 본 이미지 번호를 계정별로 기억해, 미리보기를 저장·닫은 뒤 완료 목록이 늦게 도착해도 중복 안내하지 않고 확인 처리한다. 현재 실행 중 숨기기와 서버 확인 처리는 별개다. 결과의 저장·복구 구조는 [이미지와 생성 작업](media-jobs.md#생성-작업과-복구)에 있다.

## 전송과 계정 전환

[graphql.ts](../../apps/web/src/lib/graphql.ts)는 브라우저의 API 요청과 `window.ClosetNative.requestGraphql` 전송을 연결한다. API 오류의 `extensions.code`와 세션 만료도 여기서 처리한다. [queryKeys.ts](../../apps/web/src/lib/queryKeys.ts)는 쿼리 키를, [queryClient.ts](../../apps/web/src/lib/queryClient.ts)는 공통 조회·재시도 옵션을 정의한다.

[authQueries.ts](../../apps/web/src/features/auth/api/authQueries.ts)는 로그인·로그아웃 시 웹 토큰과 네이티브 세션을 동기화하고 Query 캐시 및 옷장·룩북 Store를 초기화한다. 추천 기록·생성 요청 복원은 각 기능의 사용자별 키를 사용한다. 설정 저장은 시작 계정·인증 토큰을 실제 캐시·로컬 프로필 반영 직전에도 검사해, 로그아웃·다른 계정·같은 계정 재로그인 뒤의 늦은 응답을 적용하지 않는다.

## 기능 진입점

| 기능 | 주요 위치 |
| --- | --- |
| 옷장·옷 등록 | `apps/web/src/features/closet`, 특히 `hooks/useWardrobeImageAnalysis.ts`, `api/saveWardrobeItem.ts` |
| 룩북·코디·미리보기 | `apps/web/src/features/lookbook`, 특히 `api/lookbookQueries.ts`, `api/previewJobQueries.ts` |
| 플래너·오늘 추천 | `apps/web/src/features/plan`, 특히 `api/plannerQueries.ts`, `api/todayOutfitQueries.ts` |
| 설정·스타일·알림 | `apps/web/src/features/settings`의 pages·API·utils |
| 기기 기능 호출 | `apps/web/src/native-bridge` |

옷을 보관 삭제하면 옷장 Store·상세/페이지 캐시와 선택 상태에서 제거한다. 기존 코디 기록은 보존한다. 옷 상세 조회는 일시 오류의 재시도와 삭제·접근 불가 안내를 구분한다.

플래너 조회·배정·착용·체감·이동 응답은 `wardrobeItem` 관계와 `archivedAt`을 함께 읽어 `PlanEntry.outfitItems`에 둔다. [plannerItems.ts](../../apps/web/src/features/plan/utils/plannerItems.ts)는 날짜 코디의 옷 정보를 우선하고 새로 고른 옷만 활성 옷장 목록에서 찾는다. 삭제 옷을 활성 Store에 병합하지 않으며 날짜 이동 때 관계 정보도 함께 옮긴다. 상세·하루·주간·월간에서는 삭제된 옷의 사진을 유지하고 삭제 상태를 표시한다. 관련 회귀는 `tests/planner-archived-items.spec.ts`다.

코디북도 조회·생성·수정 응답의 옷 관계를 `SavedOutfit.outfitItems`에 둔다. [savedOutfitItems.ts](../../apps/web/src/features/lookbook/utils/savedOutfitItems.ts)는 저장된 관계를 우선해 배치 순서대로 옷을 읽으며, 관계가 없는 기존 데이터는 활성 목록에서 찾는다. 코디 목록·상세·주간 편집 표지·포함된 코디 미리보기에서 이 정보를 사용하고 삭제 상태를 표시한다. 코디 조회는 활성 옷장 Store에 옷을 병합하지 않으며 Store도 `archivedAt`이 있는 옷을 제외한다. 옷 삭제 시 코디북 조회를 무효화해 삭제 상태를 갱신한다. 회귀는 `savedOutfitItems.test.ts`와 `tests/lookbook-archived-items.spec.ts`다.

삭제 옷이 포함된 상세는 기존 AI 사진 보기·착용·체감·코디 삭제를 유지하며, 삭제 옷을 교체하기 전에는 새 AI 생성·변경 저장·플래너에서 코디북 복사를 제한한다. 교체창 취소는 기존 구성과 사진을 유지한다.

## 날짜별 코디와 사진

주간 배정은 `SetPlannerEntry`가 반환한 날짜별 복사본을 캐시·Store에 반영한다. 원본 코디북 ID로 덮어쓰지 않으며 선택 표시는 옷 ID 집합으로 비교한다. 날짜 상세의 저장과 코디북 복사는 별도 행동이다. 저장된 날짜 사진과 코디북 사진은 공용 완료 캐시보다 우선하고, 현재 화면에서 사용자가 명시적으로 생성·선택한 결과만 새 사진 초안으로 쓴다. 날짜 이동은 이미지 자산 번호도 함께 옮긴다. 회귀는 `tests/planner-snapshots.spec.ts`와 `tests/planner-preview-progress.spec.ts`다.

## 잊고 있던 옷

옷장 기본 목록의 스크롤 영역 맨 앞에 `WardrobeRediscoverySection`의 ‘잊고 있던 옷 확인하기’ 버튼을 표시한다. 기본은 접힌 상태이며 눌러 펼칠 때 조회·카드 표시를 시작한다. 닫으면 노출 관찰도 멈추고 재열기에서는 같은 날의 선택을 재사용한다. 검색·필터·다중 선택·옷 상세에서는 숨긴다. `useWardrobeRediscovery`는 계정 ID와 한국 날짜로 조회를 구분하고 날짜 전환·앱 복귀 시 날짜를 갱신한다. 후보는 현재 페이지나 Store 목록이 아닌 서버의 전체 활성 옷장에서 선정한다.

`useRediscoveryImpression`은 카드가 절반 이상 보이고 앱이 전면일 때 해당 ID를 확인한다. 가로 영역 밖의 카드와 추천 시트 뒤에서는 기록하지 않는다. 확인 실패는 다음 노출·복귀·재펼침 이벤트에서 다시 시도하며 체류시간 조건은 없다. 후보가 세 벌 이하이면 다음 날에도 같은 옷이 나올 수 있다. 선정 결과는 당일 유지하며 노출 확인으로 재조회하거나 옷 수정 시각을 바꾸지 않는다. `이 옷으로 코디`는 기존 `TodayOutfitRecommendationPopover`의 `baseItem` 진입점을 사용하므로 계절·색감·사용권 확인과 추천 기록을 그대로 거친다.

웹 진입점은 `features/closet/api/wardrobeRediscoveryQueries.ts`, 화면 검사는 `tests/wardrobe-rediscovery.spec.ts`다.

## 관련 검사

웹 타입은 `pnpm --filter @closet/web exec tsc -b`, lint는 `pnpm --filter @closet/web lint`다. 웹에는 전용 `typecheck` 스크립트가 없다.

단위 테스트는 `apps/web/tests/*.test.ts`, 사용자 흐름 검사는 `tests/*.spec.ts`에 있다. 예를 들어 `previewJobRecovery.test.ts`는 작업 복원, `todayOutfitQueries.test.ts`는 추천 기록, `outfitWearSummary.test.ts`는 착용 요약을 검사한다. 단위 테스트 실행과 E2E의 통신 대체 범위는 [개발과 검증](development.md#단위-테스트와-통합-테스트)에 있다.
