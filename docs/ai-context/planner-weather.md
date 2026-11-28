# 플래너와 날씨 맥락

## 일정과 착용 데이터

`PlannerWeek`·`PlannerEntry`는 날짜별 코디 배정을, `Outfit`·`OutfitItem`은 코디 구성을 나타낸다. 모델 정의는 [schema.prisma](../../apps/api/prisma/schema.prisma)에 있다. `plannerOnly`는 날짜별 독립 코디 복사본이다. 코디북 배정도 원본을 직접 연결하지 않고 옷·이름·스타일·당시 AI 이미지 번호를 복사한다. 같은 조합을 여러 날짜에 담아도 서로 다른 행이며 코디북 수정·삭제와 다른 날짜의 편집에 영향받지 않는다.

[planner-outfit-snapshot.ts](../../apps/api/src/features/outfit/planner-outfit-snapshot.ts)는 이미지 참조 잠금과 복사를 맡는다. 기존 버전에서 원본에 직접 연결된 날짜는 원본 수정·AI 이미지 교체·삭제 트랜잭션 안에서 먼저 각각 분리하며 착용·체감·기온은 유지한다. 이미 덮어쓴 과거 내용을 추정 복원하지 않고 현재 저장된 상태를 보존한다. 플래너에서 코디북으로 저장할 때도 별도 복사하며, 같은 조합의 코디북이 있으면 기존 사진·내용을 덮거나 날짜 연결을 합치지 않는다.

API 진입점은 [planner.service.ts](../../apps/api/src/features/planner/planner.service.ts), 데이터 접근은 같은 폴더의 `planner.repository.ts`다. 웹은 `apps/web/src/features/plan`이며 [plannerQueries.ts](../../apps/web/src/features/plan/api/plannerQueries.ts)의 일정 변경은 플래너와 옷장·착용 통계 쿼리 갱신으로 이어진다.

하루·월간 보기에서 이미 조회한 같은 주의 주간 보기나 편집으로 이동하면 화면에 반영된 주간 코디를 유지한다. 주가 바뀔 때만 빈 날짜를 준비하고 해당 주의 조회 결과를 적용한다.

플래너 본문을 좌우로 스와이프하거나 이전·다음 버튼을 누르면 일간·주간·월간 단위로 이동한다. ‘오늘’, ‘이번 주’, ‘이번 달’은 한국 날짜 기준의 현재 기간을 연다. 세로 스크롤과 주간 코디 드래그 핸들은 각각의 동작을 유지한다.

하루 보기의 빈 날짜에서 코디북 코디를 배정하고, 코디가 담긴 카드는 눌러서 날짜 상세로 이동해 교체한다. 주간 편집은 주간 탭에서만 열고, 월간은 날짜별 상세로 이동한다. 모두 같은 코디북 선택 화면·최근 착용 확인·날짜별 복사 저장을 사용한다. 단일 날짜 배정이 끝나면 열었던 화면으로 돌아오며, 날짜별 상세에서는 이전 편집의 AI 미리보기 초안을 초기화한다.

주간 편집에서 체크된 코디 카드를 다시 누르거나 비우기 아이콘을 누르면 선택한 요일의 배정을 해제한다. 착용 완료 날짜는 먼저 날짜 상세에서 착용을 취소해야 편집할 수 있다.

하루 보기의 빈 날짜는 옷장·코디북 조회 결과에 따라 첫 사진 추가, 선택한 날짜의 직접 구성, 코디북 배정을 안내한다. 첫 사진 추가는 옷장의 기존 추가창을 바로 연다. 직접 구성은 `planDate`와 복귀 경로를 전달해 코디북과 같은 코디 만들기 화면을 사용한다. 선택 날짜에 먼저 저장한 뒤 같은 옷 조합이 코디북에 없을 때만 별도 복사를 제안한다. 조회 실패에는 재시도를 표시하고, 활성 옷이 없어도 기존 코디가 있으면 보조 버튼으로 배정할 수 있다.

날짜 상세를 열 때 `from`에 원래 보기 경로를 전달한다. 주간에서 열면 상세를 닫은 뒤 주간 탭과 열었던 주를 유지한다.

날짜 상세는 코디북과 같은 보기 화면으로 시작한다. 연필 버튼으로 코디 조합 보드를 열며 초안은 상세 화면에만 둔다. 취소하면 저장된 코디를 다시 보여주고, 저장하면 선택한 날짜의 코디만 갱신한다. 착용 완료한 코디는 착용 취소 뒤에 편집할 수 있다.

플래너는 날짜 코디의 착용 위치와 이너 순서를 `PlanEntry.outfitLayers`에 보관한다. 하루 카드와 날짜 상세는 이너를 ‘받쳐 입는 옷’으로 표시하고, 날짜 상세에서 다른 옷을 교체해 저장할 때도 이너 역할과 순서를 함께 전달한다.

옷장 보관 삭제는 날짜 코디·착용·체감·AI 사진 연결을 지우지 않는다. 웹은 응답의 옷 관계를 `PlanEntry.outfitItems`에 유지해 활성 옷장 목록에 없는 옷도 표시하고, `archivedAt`으로 ‘삭제된 옷’을 구분한다. 삭제된 옷은 새 선택 목록에 복구하지 않는다. 날짜 이동·초안 편집·일정 해제의 관계 정보 처리는 `plannerItems.test.ts`와 `weeklyPlan.test.ts`, 화면 복귀·새로고침은 `tests/planner-archived-items.spec.ts`로 확인한다.

원본·AI 사진의 정리 조건과 새 연결의 동시 처리 보호를 바꾸면 [이미지 보관과 정리 배치](media-jobs.md#이미지-보관교체정리-배치)를 함께 확인한다.

플래너 배정과 실제 착용은 별개다. `PlannerEntry.wornAt`은 사용자가 실제 착용을 확인한 시각이며 null·필드 누락은 미확정이다. 기존 일정도 자동 확정하지 않는다. `setPlannerEntryWorn`은 해당 주·날짜·현재 코디 ID를 검증한 뒤 오늘 또는 과거 일정의 확인·취소를 저장한다. 미래 확인은 한국 날짜 기준으로 거절하며 같은 상태의 중복 요청은 확인 시각을 바꾸지 않는다.

코디북 배정·직접 구성·착용 기록에서 다시 담기는 오늘과 지난 날짜에 ‘입을 예정’과 ‘입은 코디 기록’을 선택할 수 있다. 기본은 예정이며 미래에는 선택을 숨긴다. 명시적 실제 착용 등록만 `setPlannerEntry`·`setDirectPlannerEntry`의 `confirmWorn: true`로 전달한다. 서비스가 날짜를 검증하고 기존 날짜 복사 트랜잭션의 동일 upsert에서 코디와 확인 시각을 함께 저장한다. 날짜 상세에서 편집한 코디는 저장한 뒤 `입었어요`로 착용을 확인한다. 다른 진입점에서 명시적 착용 등록으로 저장할 때는 별도 착용 요청으로 나누지 않으며, 기존 확인 시각·체감·기온과 완료된 다른 구성의 보호는 유지한다. 예정 저장은 열린 추천을 다시 실행하지 않고, 실제 착용 등록은 기존 착용 확인과 같은 조회 갱신을 사용한다. 로그인 세션이 바뀐 저장 응답은 Query·플래너 Store에 반영하지 않는다.

오늘의 하루 보기에는 `PlannerWearReview`가 한국 날짜 기준 이전 7일의 최근 미확인 코디 한 건을 사진과 함께 보여준다. 진입·앱 복귀 시 조회하며 ‘입었어요’는 표시 중인 날짜·코디만 기존 착용 API로 확인한다. 무응답과 ‘넘기기’는 착용 여부를 바꾸지 않는다. 확인 성공 또는 넘김 뒤에는 같은 날 다른 카드를 제시하지 않으며, 계정별 로컬 저장의 날짜·코디 키로 넘긴 대상을 구분한다. 로컬 저장 실패 시 현재 화면의 메모리만 사용하고, 저장 오류는 미확인 상태를 유지해 재시도할 수 있다. 다른 기기의 넘김 상태와는 동기화하지 않는다.

하루 카드·날짜 상세의 `PlannerWearAction`에서 확인·취소하고 주간·월간 보기에 완료 배지를 표시한다. 착용 완료 날짜를 포함하는 주간 이동과 그 날짜의 비우기·다른 옷 조합 배정은 저장 시점에 `PLANNER_WEAR_CONFIRMED`로 거절한다. 정정할 때는 먼저 착용을 취소한다. 같은 옷 조합의 재저장·AI 사진·이름 변경은 확인과 체감·기온을 유지한다. 변경 후 플래너·옷별 착용·통계·룩북 이력·잊고 있던 옷 조회를 갱신한다.

다른 기기에서 먼저 착용을 확정하면 오래 열린 화면의 수정 요청에도 GraphQL 오류 코드가 전달된다. 웹은 해당 코드를 받으면 플래너를 다시 조회해 기존 코디와 착용 상태를 표시한다. API의 `planner-wear.service.test.ts`는 오류 코드와 저장 상태를, `tests/planner-wear-completion.spec.ts`는 실패 안내와 재조회 후 편집 제한을 확인한다.

코디북의 착용 이력·순위는 현재 옷 ID 집합과 정확히 같은 날짜 복사본만 연결한다. ABC를 ABD로 수정하면 ABC 착용을 ABD 횟수로 표시하지 않으며 이름·사진만 변경하면 같은 조합의 이력은 유지한다. 옷별 횟수·최근 착용·체감 추천은 날짜 복사본의 실제 구성과 확인 기록을 읽는다.

실제 착용을 확인한 날짜에는 `wearFeeling`으로 체감을 남긴다. 값은 `cold`(추웠어요)·`comfortable`(적당했어요)·`hot`(더웠어요)이며 null·누락은 미기록이다. 하루 카드와 날짜 상세에서 ‘입었어요’를 저장하면 첫 단계에서 체감을, 둘째 단계에서 선택 기온을 묻는다. 두 번째 단계의 ‘저장’에서 체감과 직접 입력값을 함께 기록하며, 전체를 건너뛰어도 확인한 착용과 자동 기온은 유지한다. 날짜 상세에서는 체감을, 코디북의 온도별 착용 기록에서는 날마다 체감·직접 입력 기온을 수정할 수 있다.

`setPlannerEntryWearFeeling`은 해당 주·날짜·코디 ID와 요청 시점의 `wornAt`을 검증해 지금도 같은 착용 완료 상태일 때만 저장한다. `manualTemperatureC`를 생략하면 직접 입력값을 유지하며 null이면 지운다. 온도별 착용 기록의 표시·필터에는 직접 입력, 실제 일평균, 예보 일평균 순으로 적용한다. AI 날씨 추천은 실제 일평균을 사용한다. 착용을 취소하면 체감과 착용 기온을 초기화한다.

실제 일평균 기온이 기록된 지난 착용의 체감은 이후 비슷한 예보 일평균의 날씨 코디 추천에 반영한다. `WeatherSnapshot.meanTemperatureC`는 현재 순간 기온과 별도로 보존한 예보 일평균이며, 기록이 없는 기온은 추정하지 않는다. 개인 보정의 범위·순위·캐시 계약은 [AI 기능](ai.md#개인-체감과-날씨-추천)에 있다.

`planner-wear.ts`의 `confirmedWearWhere`가 옷별 이력·통계·최근 착용·착용 날씨 조회의 공통 조건이다. 옷별 착용 횟수는 [wardrobe.service.ts](../../apps/api/src/features/wardrobe/wardrobe.service.ts)에서 확인된 날짜 중복을 제거해 계산한다. 룩북의 [outfitWearSummary.ts](../../apps/web/src/features/lookbook/utils/outfitWearSummary.ts)는 오늘까지 확인된 날짜만 횟수·기온 범위에 포함한다. 오늘·미래의 미확인 배정은 예정으로 표시하며 과거 미확인 배정은 착용 횟수에 포함하지 않는다. 코디 배정 조회는 예정 표시를 위해 미확인 일정도 `wornAt`과 함께 반환한다.

최근 착용 경고는 `features/planner/recent-wear-conflict.ts`, 웹 조회는 `features/plan/api/recentWearQueries.ts`에 있다. 경고 기간·조합/아이템 알림 설정은 이 경로의 입력에 반영된다.

리마인드 설정은 계정별 `UserSettings`에 저장하며 기본값은 꺼짐이다. 전체 스위치·기간 칩·확인 기준은 바꾸는 즉시 적용한다. 새 기간은 3·7·14·30일 중에서 고른다. 이전에 저장한 다른 기간은 새 기간을 고를 때까지 유지하고 표시한다. 계정 설정을 조회하는 동안에는 스위치를 표시하지 않는다.

## 온도별 착용 기록과 다시 담기

코디북 필터의 ‘착용 기온’을 선택하면 플래너에만 저장된 조합까지 포함해 실제로 입은 코디를 코디북 목록에서 조회한다. 기온 조건은 계절·스타일·색상·아이템·검색과 함께 적용하며 선택한 구간은 `wearTemperature` 쿼리에 보존한다. 플래너의 날씨 팝업과 미래 날짜 예보 말풍선에서는 그 날짜에 다시 담을 수 있는 `/wear-history`를 연다. 선택 날짜와 복귀 경로는 URL에 보존한다. 오늘이나 미래 선택일의 예보가 있으면 `meanTemperatureC` 주변 ±3℃ 범위(상한 제외)를 기본 조회한다. 예보 평균이 없으면 전체 기록으로 연다.

플래너에서 오늘 코디를 고를 때 예보 일평균이 있으면 오늘 기온 필터를 표시한다. 코디북의 코디 중 해당 평균 ±3℃ 범위(상한 제외)에 실제 착용 기록이 있는 코디를 보여주며, 검색·계절·스타일·색상 조건과 함께 적용한다. 과거·미래 날짜에는 오늘 기온 필터를 표시하지 않는다.

`temperatureWearHistory(input)`은 `features/planner/temperature-history.service.ts` → 같은 이름의 repository에서 본인 계정의 오늘까지 확인된 착용만 읽는다. 예정·확인 취소·미래 날짜는 제외하며 기온 미기록은 null로 보존한다. 기온 하한은 포함, 상한은 제외하며 체감과 기온은 같은 날짜에서 일치해야 한다. 같은 옷 ID 집합의 날짜 복사본을 한 조합으로 묶고, 조건에 맞는 최근 날짜의 코디·사진을 대표로 사용한다. 상세에는 필터 밖의 날짜까지 포함한 해당 조합의 전체 기온·체감 기록을 유지한다. 대표 날짜·코디 ID순 커서를 사용하고 사진 관계는 현재 페이지에서만 읽는다.

저장 코디와 착용 기록은 공통 코디 상세에서 옷 구성과 AI 룩북을 보여준다. `이 코디를 입었던 날`은 옷 구성 아래에서 함께 스크롤하며 날짜별 기온·체감을 수정한다. 저장 코디의 착용 목록은 동일한 옷 ID 집합을 조회하고, 과거 날짜 복사본을 열면 당시 구성과 이미지를 표시한다. 저장 코디 상세의 ‘플래너에 담기’는 `PlanMonthCalendar`에서 빈 날짜와 코디가 있는 날짜를 표시한다. 월 이동 후에는 날짜를 다시 고른다. 착용 기록 상세에서는 플래너에서 들어왔을 때만 날짜 배정을 표시한다. 두 배정 경로는 대상 날짜를 재조회하고 기존 코디 교체 및 최근 착용 확인을 거치며 착용 완료 날짜는 배정하지 않는다. 착용 기록 Query는 계정·조건별 `planner` 키 아래에서 저장 뒤 갱신하며 목록은 기존 `CatalogScrollRegion`과 `InfiniteScrollFooter`를 사용한다.

그대로 담기는 기존 `setPlannerEntry`에 `activeItemsOnly: true`를 보내 원본 날짜 코디·사진을 독립 복사한다. 이 옵션은 저장 트랜잭션의 기존 옷 참조 잠금에서 활성 옷만 허용하고 DB 필드로 쓰지 않는다. 삭제된 옷은 과거 기록에서 계속 표시하지만 새 날짜에는 교체해야 한다. 옷을 바꿔 담기는 `setDirectPlannerEntry`의 일반 `name`·`style`과 활성 옷 ID를 보내 새 직접 코디로 저장하며, 과거 AI 사진은 다른 구성에 연결하지 않는다. 기존 `recommendationName`·`recommendationStyle` 호출은 유지한다. 과거 착용·기온·체감은 새 날짜에 복사하지 않으며 ‘입은 코디 기록’을 선택했을 때만 새 날짜의 착용을 별도로 확인한다. 저장 뒤 대상 날짜의 하루 보기로 이동한다.

검사는 `temperature-history.service.test.ts`(기온·체감·그룹·페이지·인증), `planner-image-reference.test.ts`(활성 옷 잠금·독립 복사), `apps/web/tests/temperatureHistory.test.ts`(기온·날짜·경로), `tests/temperature-wear-history.spec.ts`(두 입구·필터·교체·보호·오류·페이지·예보 평균)다.

## 날짜 기준

[date.ts](../../apps/api/src/lib/date.ts)는 `YYYY-MM-DD`를 검증해 UTC 자정의 Date로 표현한다. 오늘의 날짜 경계는 `wardrobe.service.ts`의 `getKoreaTodayUtc`가 한국 시간으로 계산한다. 저장용 날짜 표현과 실제 시각의 시간대를 구분하는 구조다.

## 날씨와 위치

[weather.service.ts](../../apps/api/src/features/weather/weather.service.ts)는 Open-Meteo 예보와 지난 날짜의 하루 평균 기온을 조회한다. 예보 결과는 지역·날짜별 캐시와 `expiresAt`을 갖고, 캐시 재사용은 만료 시각을 연장하지 않는다.

하루 보기에서 한국 시간 기준 미래 날짜를 선택하면 코디 카드 위에 접힌 예보 버튼을 표시한다. 열면 선택일 예보와 온도별 기록 입구를 보여주며 카드 배치는 유지한다. 모션 감소 설정에서는 열기 애니메이션을 생략한다. 날짜 상세는 코디 정보와 착용 기록을 보여주며 예보는 하루 보기에서 확인한다. ‘내일 코디 추천’은 해당 날짜의 예보와 자동 색감으로 추천을 시작한다. ‘내일 일정에 담기’는 그 날짜와 해당 주에만 배정하고, 화면에는 저장 응답의 코디를 재조회 전에 반영한다.

| 필드 | 의미 |
| --- | --- |
| `temperatureC` | 플래너 배정 시 전달받아 저장한 기온 |
| `wearTemperatureC` | 지난 착용일의 하루 평균 기온 |
| `wearForecastTemperatureC` | 오늘 실제 착용을 확인할 때 가져온 해당 지역의 하루 평균 예보 |
| `manualWearTemperatureC` | 직접 입력한 해당 날짜의 착용 기온 |

위치 설정은 웹의 [notificationWeatherPreferences.ts](../../apps/web/src/features/settings/utils/notificationWeatherPreferences.ts)에 로컬 저장된다. [useWearWeatherLocationSync.ts](../../apps/web/src/features/plan/hooks/useWearWeatherLocationSync.ts)는 허용된 위치를 진입·복귀 때 서버로 동기화하며 새 권한 팝업을 요청하지 않는다.

서버는 좌표를 지역 단위로 반올림해 계정과 오늘 이후 일정에 반영한다. 신규 배정·날짜 이동도 오늘 이후에는 저장된 현재 지역을 연결하며, 과거 날짜의 기존 지역은 유지하고 새 과거 일정에 현재 위치를 소급 적용하지 않는다. 사용 해제·권한 거절은 해당 지역을 비우고, 지난 일정의 지역·기온은 새 위치로 덮어쓰지 않는다.

[wear-weather.service.ts](../../apps/api/src/features/planner/wear-weather.service.ts)는 오늘 착용을 확인하거나 수정할 때 연결된 지역에서 그날의 `meanTemperatureC`를 가져온다. 예보를 저장하면 확인 응답과 착용 기록에서 바로 사용하고, 지역이나 예보가 없어도 착용 확인은 유지한다. worker는 실제 착용을 확인한 지난 일정 중 코디·지역이 있고 실제 평균이 없는 기록을 처리한다. [wear-weather.repository.ts](../../apps/api/src/features/planner/wear-weather.repository.ts)는 중복 처리와 조회 중 삭제·재배정·지역 변경·확인 취소를 검사한다. 조회 때의 확인 시각이 바뀌면 이전 결과는 저장하지 않는다. 과거 실제 평균의 제공자 오류는 재시도한다.

## 관련 검사

`tests/planner-tomorrow-recommendation.spec.ts`, `tests/planner-snapshots.spec.ts`, `tests/plan.spec.ts`, `tests/planner-wear-completion.spec.ts`, `tests/planner-wear-registration.spec.ts`, `tests/planner-wear-feeling.spec.ts`, `tests/lookbook-wear-weather.spec.ts`, `apps/web/tests/plannerWear.test.ts`, `apps/web/tests/plannerWearReview.test.ts`, `apps/web/tests/plannerMutationSession.test.ts`, `apps/web/tests/outfitWearSummary.test.ts`와 API의 `planner-outfit-wear-history.test.ts`·`planner-move-weather.test.ts`·`planner-wear.service.test.ts`·`planner-wear-feeling.service.test.ts`·`planner-wear-consumers.test.ts`·최근 착용·날씨 테스트가 관련된다.

`wear-weather.integration.test.ts`는 실행 플래그·테스트 DB 이름을 확인하고 종료 시 해당 DB를 삭제한다. 조건과 다른 통합 검사의 차이는 [개발과 검증](development.md#단위-테스트와-통합-테스트)에 있다.
