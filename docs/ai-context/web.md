# 웹 맥락

## 화면과 라우팅

`apps/web`은 React·Vite·Tailwind 기반이다. [router.tsx](../../apps/web/src/app/router.tsx)의 주요 경로는 `/plan`, `/closet`, `/lookbook`, `/settings`다. `/recommend`와 `/profile`에는 호환용 이동 경로가 남아 있다. 브라우저에서는 browser router, 네이티브 런타임에서는 hash router를 사용한다.

로그인 경로 바깥의 주요 화면은 `RequireAuth`와 [AppLayout.tsx](../../apps/web/src/components/layout/AppLayout.tsx)를 거친다. AppLayout은 헤더·탭·화면 Outlet·스크롤 복원과 날씨 지역 동기화를 연결한다. 상세·작성·설정 하위 경로에서는 하단 탭이 숨겨진다.

화면은 `apps/web/src/features/*/pages`, 관련 UI·Hook·API 함수는 같은 기능 폴더에 있다. 공통 스타일은 `apps/web/src/index.css`, 공통 레이아웃은 `apps/web/src/components/layout`에 있다.

화면의 안내·완료·오류는 해요체, 사용자에게 필요한 조작은 `골라주세요`·`입력해주세요`처럼 짧은 요청으로 쓴다. 버튼은 대상과 동작을 짧게 표시한다. 옷 조합은 `코디`, 저장 목록은 `코디북`, 생성 사진은 `AI 룩북`, 공통 잔액은 `AI 사용권`으로 통일한다. 표지 번호의 `LOOK` 같은 시각 요소는 유지하되 조작 안내에는 영어 `Look`을 섞지 않는다. 로딩 문구는 실제로 확인할 수 있는 작업만 설명하며 임의로 조명·실루엣 등을 처리 중이라고 표시하지 않는다. 화면에 전달하는 API·네이티브 오류 문구도 같은 기준을 따른다. 팝업 배경과 오류색은 `ink`·`danger` 토큰을 사용하고 주요 제목은 공통 제목과 같은 600 굵기를 따른다.

옷장의 계절·카테고리는 상단에 유지하고 필터 버튼은 제목 옆 검색·추가 도구와 함께 둔다. `ClosetFilters`는 정렬을 한 줄에, 색상·브랜드·태그를 탭 하나의 영역에 표시해 직접 복수 선택한다. 브랜드 관리·삭제는 기존 관리 Hook과 확인창을 재사용한다. 같은 항목의 여러 값은 OR, 다른 항목은 AND로 API에 전달하며 브랜드를 선택하지 않으면 브랜드에 관계없이 조회한다. 기존 URL의 미지정 조건은 해제할 수 있다.

옷장 필터 서랍은 화면 높이에 맞춘 고정 높이를 사용하고, 선택한 조건이 있을 때만 하단 버튼 위에 칩을 표시한다. 탭·선택·검색 결과에 따라 서랍과 탭·하단 버튼이 움직이지 않으며 긴 선택지 영역만 내부에서 스크롤한다. 코디북도 제목 옆 검색·필터·추가 순서로 배치하며 `LookbookFilters`에서 AI 룩북 보기·정렬·단일 색상을 고른다. 계절·스타일은 본문에 유지한다. 보기 옵션은 URL에 유지하며 필터 초기화로 바꾸지 않는다. `OutfitFilterControls`는 표시할 세부 도구가 없으면 빈 도구 행을 만들지 않으며 플래너의 코디 선택에서도 사용한다. 위치·선택·초기화 회귀 검사는 `tests/lookbook-filters.spec.ts`다.

옷장·코디북·플래너 코디 선택은 공통 검색 버튼과 필터 버튼·서랍·정렬 UI를 사용한다. 코디 선택은 코디북과 같은 `LookbookFilters`의 정렬·색상 조건을 목록에 적용한다. 옷장의 다중 조건과 브랜드 관리, 코디북의 보기 설정은 각각 해당 화면이 관리한다.

세부 선택은 `color`·`brand`·`tag` 반복 URL 파라미터와 `unbranded=1`로 순서를 보존한다. `wardrobeFilters.ts`는 기존 단일 값 URL도 읽고, `ClosetFilterSelection`은 고른 순서대로 칩을 한 줄에 쌓아 가로 스크롤한다. 새 조건은 오른쪽 끝에 붙이고 칩을 다시 누르면 그 조건만 해제한다. 서랍 초기화는 계절·카테고리·검색어를 유지한다.

옷장·코디북의 상단 조작부는 목록 개수를 받기 전부터 표시한다. `TabRouteSkeleton`은 실제 필터 높이와 `WardrobeCabinet`을 재사용해 코드 로딩 → 필터 조회 → 목록 조회 사이에도 카드 위치를 유지한다. 선택 칩·옷장 검색·태그 결과 안내와 재발견 진입 버튼 공간도 로딩 때 확보한다. 회귀 검사는 `tests/catalog-loading.spec.ts`, 서랍 조건·초점·복원 검사는 `tests/closet-filters.spec.ts`, 복수 선택·칩 순서·가로 스크롤·브랜드 삭제 검사는 `tests/closet-multifilters.spec.ts`다.

코디 만들기와 오늘 추천은 코디북 저장 화면을 공유한다. AI 추천은 선택한 날짜를 먼저 저장한 뒤 같은 옷 조합이 코디북에 없을 때만 추가 여부를 묻는다. 추가를 고르면 이름과 추천 계절을 미리 채운 코디 정보 입력창을 열며, 여기서 수정한 정보는 새 코디북 기록에만 적용한다. 일반 코디 만들기에서 같은 옷 조합을 찾으면 `/lookbook?outfit=<id>`의 기존 코디 상세로 연결한다. 코디북은 목록에 없을 때도 해당 ID를 조회한다. 코디 상세에서 옷을 추가·교체한 뒤 변경사항을 저장하면 기존 코디에 반영할지 새 코디로 저장할지 고른다. 이름·스타일·계절만 바꾸면 기존 코디에 반영한다. 플래너에서 직접 구성할 때도 `스타일 · 계절 설정`으로 같은 입력 화면을 연다.

`OutfitDetailModal`은 기본 보기와 편집을 구분한다. `OutfitReadView`는 저장된 옷만 사진·이름으로 표시하고, `OutfitDetailHeader`는 보기의 삭제와 편집의 취소·정보 수정을 나눈다. `코디 수정`을 눌러야 슬롯을 교체할 수 있으며, 취소하면 구성·이름·스타일·계절 초안을 버리고 저장하면 보기로 돌아간다. AI 이미지 보기·생성은 기본 보기에서 기존 사용권·복원 경로를 사용한다. 관련 회귀는 `tests/lookbook.spec.ts`, 삭제 옷과 과거 날짜 보존은 `tests/lookbook-archived-items.spec.ts`다.

월간 달력은 모바일에도 12px 코디명과 전체 아이템 수를 표시한다. 6주 달력이 들어가는 높이를 유지하고 짧은 영역에서는 달력 안을 스크롤한다. 긴 코디명은 모바일에서 줄이고 전체 이름은 날짜 링크의 접근성 이름과 상세에 유지한다. `tests/planner-month-outfit.spec.ts`가 날짜 배정·복귀와 캡션·개수를 확인한다.

스타일 프로필은 성별·체형을 필수, 키·몸무게·상세 치수·선호 핏 입력을 선택으로 표시한다. 상세 치수는 기본으로 접고 입력한 항목 수를 알려준다. 접어도 값을 지우지 않으며, 숫자 범위 검증에 실패하면 해당 영역을 펼친다. 저장 입력과 세션 변경 방어는 기존 경로를 유지한다. 회귀는 `tests/account-settings.spec.ts`다.

설정 목록은 옷장 관리·앱 설정으로 묶고 ‘계정 관리’(`/settings/account`)에서 로그인 정보·로그아웃·회원탈퇴를 제공한다. `useAccountInfoQuery`는 `myAccount`로 본인의 이름·로그인 ID·이메일을 읽는다. 회원탈퇴는 `AccountDeletionDialog`에서 삭제 범위·복구 불가를 확인한 뒤 `useDeleteAccountMutation`으로 서버에 요청한다. 성공한 현재 세션만 토큰·네이티브 인증·Query·옷장·코디북·플래너·스타일 프로필을 비우고 로그인으로 이동한다. 실패 시 계정·인증을 유지하며 재시도할 수 있고, 계정이 바뀐 늦은 응답은 새 세션을 지우지 않는다. 확인창은 초점 순환·Escape·초점 복귀·처리 중 중복 방지를 자체 처리한다. 하단 탭이 있는 설정 목록은 마지막 메뉴를 탭 위까지 스크롤할 수 있는 여백을 확보한다. 계정 상세는 `SettingsDetailLayout`의 복귀·초점 순환을 공유하고 권한 새로고침은 표시하지 않는다. 화면·긴 계정 정보·작은 높이·로그아웃 검사는 `tests/account-management.spec.ts`, 탈퇴는 `tests/account-deletion.spec.ts`와 `apps/web/tests/accountDeletionSession.test.ts`다.

여러 사진을 함께 고르면 `WardrobeBatchRegistrationDialog`에서 확인 결과를 목록으로 표시한다. `useWardrobeRegistration`은 후보 ID별 초안·선택·공통 계절·부분 실패만 관리하고 분석 사진은 기존 확인 대기열을 참조한다. 저장 클릭 시 대상 ID를 고정해 기존 한 벌 저장 함수를 순서대로 호출하며 성공한 항목만 제거한다. 분석이 진행 중이면 목록이 잠시 비어도 창과 공통 계절을 유지한다. 세부 수정·유사도 비교는 `ClassificationConfirmModal`을 입력 확인 모드로 재사용하며, 이 모드에서는 서버 저장이나 후보 제거를 하지 않는다. 한 장 등록은 기존 확인 화면을 사용한다. 검사는 `tests/wardrobe-batch-registration.spec.ts`, `tests/registration.spec.ts`다.

옷 등록·정보 수정은 선택적인 `storageLocation`을 저장하고 상세·간단 상세에서 표시한다. 서버 목록 검색과 `wardrobeItemMatchesSearch`에 보관 위치를 함께 포함한다. 태그와 장소는 별개이며 장소 관리 테이블이나 필터 탭은 추가하지 않는다. `WardrobeWearPreferenceSheet`는 재발견 카드와 옷 상세에서 최신 미착용 사유·재개일을 수정한다. 보류 설정 저장은 기존 옷 수정 mutation을 사용하고, 보류 해제도 이 창에서 한다. 검사는 `tests/wardrobe-preferences.spec.ts`다.

## 공통 팝업과 상태

플래너 하루 보기와 코디북에서 `/wear-history`의 온도별 착용 기록을 공유한다. `features/wear-history`가 기온·체감 필터, 같은 조합의 날짜별 기록, 새 날짜에 그대로 또는 옷을 바꿔 담기를 담당한다. 과거 기록은 읽기만 하며 배정은 기존 플래너 mutation과 최근 착용 확인을 사용한다. 코디북 코드 로딩에도 같은 입구 공간을 확보한다. 조회·복사 조건과 검사는 [온도별 착용 기록과 다시 담기](planner-weather.md#온도별-착용-기록과-다시-담기)에 있다.

[GlobalUi.tsx](../../apps/web/src/components/GlobalUi.tsx)는 분류 확인·최근 착용 안내·사용권 안내·생성 완료 안내·토스트를 연결한다. 분류 확인은 `useUiStore`의 대기열을 사용한다. 저장 중에는 취소를 막고 완료는 후보 ID로 처리해 다음 사진을 제거하지 않는다.

서버 상태는 TanStack Query, UI 공통 상태는 [useUiStore.ts](../../apps/web/src/stores/useUiStore.ts), 기능별 편집 상태는 각 `features/*/stores`에 있다. 플래너·코디 작성에 필요한 옷장·룩북 데이터는 GlobalUi에서 Query 결과를 Store에 채우는 경로도 있다. 모든 화면이 전체 옷장·룩북을 항상 조회하는 구조는 아니다.

옷 등록의 유사도 비교는 전체 옷장 조회가 성공한 뒤 같은 세부 종류의 옷을 대상으로 실행한다. 기존 세부 종류가 `팬츠`인 하의는 새 옷이 `일반 긴바지`나 `와이드 팬츠`일 때 형태 점수가 기준을 넘으면 후보에 포함한다. 조회 중과 실패는 각각 안내하며 실패 시 다시 확인할 수 있다. [유사도 계산](../../apps/web/src/features/closet/utils/similarWardrobeItems.ts)은 색과 형태 점수를 분리하고, 패턴·다색 옷은 대표색을 비교한다. 화면은 일치한 전체 개수와 유사도가 높은 카드 최대 네 장을 표시한다.

형태 정보가 부족한 기존 옷은 [옷 정보 수정](../../apps/web/src/features/closet/components/ClosetItemEditModal.tsx)에서 저장된 사진을 다시 분석할 수 있다. 분석으로 얻은 형태 정보는 수정 화면에 두고, 저장한 뒤부터 새 옷의 유사도 비교에 사용한다.

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

플래너와 코디북 상세가 공유하는 `OutfitWardrobePicker`는 슬롯에 맞는 활성 옷을 세부 카테고리·검색어·계절·색상으로 거른다. 룩북 만들기와 공유하는 필터 패널에서 최근 착용 옷도 숨길 수 있다. 숨기기는 기본으로 꺼져 있으며, 저장 직전의 리마인드 사용 여부와 별개로 설정 기간을 사용한다. 한국의 오늘부터 설정 일수 전까지 착용을 확인한 옷을 숨기며, 필터는 보이는 목록에만 적용하고 이미 고른 옷은 유지한다.

## 날짜별 코디와 사진

주간 배정은 `SetPlannerEntry`가 반환한 날짜별 복사본을 캐시·Store에 반영한다. 원본 코디북 ID로 덮어쓰지 않으며 선택 표시는 옷 ID 집합으로 비교한다. 날짜 상세의 저장과 코디북 복사는 별도 행동이다. 저장된 날짜 사진과 코디북 사진은 공용 완료 캐시보다 우선하고, 현재 화면에서 사용자가 명시적으로 생성·선택한 결과만 새 사진 초안으로 쓴다. 날짜 이동은 이미지 자산 번호도 함께 옮긴다. 회귀는 `tests/planner-snapshots.spec.ts`와 `tests/planner-preview-progress.spec.ts`다.

## 잊고 있던 옷

옷장 기본 목록에서 `WardrobeRediscoveryButton`을 하단 탭 위에 고정한다. 목록은 마지막 아이템이 버튼 아래 가려지지 않도록 하단 공간을 둔다. 버튼이나 재발견 푸시에서 `/closet/rediscovery`의 `WardrobeRediscoveryPage` 전체 화면 목록을 연다. 검색·필터·다중 선택·옷 상세에서는 입구 버튼을 숨긴다. `useWardrobeRediscovery`는 화면을 연 동안 계정 ID와 한국 날짜로 조회를 구분하고 재진입·날짜 전환·앱 복귀 시 현재 후보를 확인한다. 후보는 서버의 전체 활성 옷장에서 선정한다.

`WardrobeRediscoveryCarousel`은 한 벌의 큰 사진과 다음 카드 일부를 보여주며 직접 스와이프·버튼·방향키로만 이동한다. 한 벌이면 넘김 조작을 숨긴다. 마지막 착용 기록의 경과일과 `lastWornTemperatureC`(그날 하루 평균)를 표시하고, 기록이 없으면 경과일·기온을 만들지 않는다. 옷 상세의 `from` 경로에 현재 카드 ID를 담아 돌아오면 해당 카드로 복원한다. 로딩·오류 재시도·후보 소멸의 빈 상태를 제공한다.

`useRediscoveryImpression`은 현재 카드가 절반 이상 보이고 앱이 전면일 때만 해당 ID를 확인한다. 가로 영역 밖의 카드와 추천 시트 뒤에서는 기록하지 않는다. 확인 실패는 다음 노출·복귀·재진입 이벤트에서 다시 시도하며 체류시간 조건은 없다. 후보가 세 벌 이하이면 다음 날에도 같은 옷이 나올 수 있다. 선정 결과는 당일 유지하며 노출 확인으로 재조회하거나 옷 수정 시각을 바꾸지 않는다. `이 옷으로 코디 만들기`는 기존 `TodayOutfitRecommendationPopover`의 `baseItem` 진입점을 사용하므로 계절·색감·사용권 확인과 추천 기록을 그대로 거친다. `당분간 안 보기`는 기존 사유·재개일 설정 창을 연다.

설정 → 알림(`/settings/notifications`)의 `RediscoveryPushSetting`은 ‘잊고 있던 옷 알림’으로 계정별 `rediscoveryPushEnabled`를 표시하고 `setWardrobeRediscoveryPushEnabled`로 저장한다. 기본 OFF이며 기기 알림 권한이 없으면 저장된 수신 선택을 유지한 채 비활성화한다. 권한을 허용하면 기존 선택을 변경할 수 있다. 프로필 저장과 같은 세션 보호 경로를 사용하며 웹에서는 앱 전용으로 비활성화한다. 재발견 목록의 `RediscoveryNotificationLink`에서도 같은 화면으로 이동하고, `from=rediscovery`와 현재 `item`을 전달해 닫기·Escape 시 보던 옷으로 복원한다.

알림은 수신 종류·기기 알림 권한·접힌 테스트 전송 안내를, 날씨 및 위치(`/settings/weather-location`)는 날씨 사용·위치 권한·위치 사용 안내를 관리한다. 기존 `/settings/notifications-weather`는 알림 화면으로 교체 이동한다. 두 화면은 `SettingsDetailLayout`과 `useSettingsDetailFocus`의 헤더·복귀 경로·Tab 순환·Escape 닫기를 공유하고, `useSettingsPermission`은 해당 종류의 권한만 읽는다. `useWeatherLocationSettings`만 기존 날씨 저장 키와 변경 이벤트를 갱신한다. 기기 권한은 요청 또는 설정 이동 행으로, 수신 동의·웹 날씨 사용은 스위치로 표시한다. 기존 최근 착용 리마인드는 앱 안에서 재선택을 확인하는 별도 기능으로 유지한다. 화면 흐름 검사는 `tests/notification-weather.spec.ts`다.

알림 화면은 수신에 먼저 필요한 기기 권한을 위에 표시한다. 기기 권한이 없으면 ‘받을 알림’ 전체를 `disabled` fieldset으로 흐리게 표시하고 허용 필요 안내를 한 줄로 제공한다. 저장된 ON/OFF 선택은 바꾸지 않으며 권한 허용 후에만 두 스위치를 조작할 수 있다. 항목 요약은 짧게 표시하고 발송 조건·테스트 전송은 접힌 ‘알림 안내’에 모은다.

‘작업 완료 알림’은 계정별 `completionPushEnabled`를 `setCompletionPushEnabled`로 저장한다. 기본 ON을 유지하며 끄면 서버의 AI 완료·실패 기기 알림을 생략한다. `PushPreferenceSetting`이 두 알림의 권한별 비활성화·저장 결과 표시를 공유하고, mutation이 본인 세션을 보호한다. 계정 설정 조회 실패의 재시도는 화면에서 한 번만 표시하며 두 수신 선택은 독립적이다. 앱 안에서 보는 결과와 완료 팝업은 이 설정으로 끄지 않는다.

웹 진입점은 `features/closet/api/wardrobeRediscoveryQueries.ts`, 화면 검사는 `tests/wardrobe-rediscovery.spec.ts`다.

## 관련 검사

웹 타입은 `pnpm --filter @closet/web exec tsc -b`, lint는 `pnpm --filter @closet/web lint`다. 웹에는 전용 `typecheck` 스크립트가 없다.

단위 테스트는 `apps/web/tests/*.test.ts`, 사용자 흐름 검사는 `tests/*.spec.ts`에 있다. 예를 들어 `previewJobRecovery.test.ts`는 작업 복원, `todayOutfitQueries.test.ts`는 추천 기록, `outfitWearSummary.test.ts`는 착용 요약을 검사한다. 단위 테스트 실행과 E2E의 통신 대체 범위는 [개발과 검증](development.md#단위-테스트와-통합-테스트)에 있다.
