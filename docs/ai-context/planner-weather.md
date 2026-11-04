# 플래너와 날씨 맥락

## 일정과 착용 데이터

`PlannerWeek`·`PlannerEntry`는 날짜별 코디 배정을, `Outfit`·`OutfitItem`은 코디 구성을 나타낸다. 모델 정의는 [schema.prisma](../../apps/api/prisma/schema.prisma)에 있다. `plannerOnly`는 날짜별 독립 코디 복사본이다. 코디북 배정도 원본을 직접 연결하지 않고 옷·이름·스타일·당시 AI 이미지 번호를 복사한다. 같은 조합을 여러 날짜에 담아도 서로 다른 행이며 코디북 수정·삭제와 다른 날짜의 편집에 영향받지 않는다.

[planner-outfit-snapshot.ts](../../apps/api/src/features/outfit/planner-outfit-snapshot.ts)는 이미지 참조 잠금과 복사를 맡는다. 기존 버전에서 원본에 직접 연결된 날짜는 원본 수정·AI 이미지 교체·삭제 트랜잭션 안에서 먼저 각각 분리하며 착용·체감·기온은 유지한다. 이미 덮어쓴 과거 내용을 추정 복원하지 않고 현재 저장된 상태를 보존한다. 플래너에서 코디북으로 저장할 때도 별도 복사하며, 같은 조합의 코디북이 있으면 기존 사진·내용을 덮거나 날짜 연결을 합치지 않는다.

API 진입점은 [planner.service.ts](../../apps/api/src/features/planner/planner.service.ts), 데이터 접근은 같은 폴더의 `planner.repository.ts`다. 웹은 `apps/web/src/features/plan`이며 [plannerQueries.ts](../../apps/web/src/features/plan/api/plannerQueries.ts)의 일정 변경은 플래너와 옷장·착용 통계 쿼리 갱신으로 이어진다.

옷장 보관 삭제는 날짜 코디·착용·체감·AI 사진 연결을 지우지 않는다. 웹은 응답의 옷 관계를 `PlanEntry.outfitItems`에 유지해 활성 옷장 목록에 없는 옷도 표시하고, `archivedAt`으로 ‘삭제된 옷’을 구분한다. 삭제된 옷은 새 선택 목록에 복구하지 않는다. 날짜 이동·초안 편집·일정 해제의 관계 정보 처리는 `plannerItems.test.ts`와 `weeklyPlan.test.ts`, 화면 복귀·새로고침은 `tests/planner-archived-items.spec.ts`로 확인한다.

원본·AI 사진의 정리 조건과 새 연결의 동시 처리 보호를 바꾸면 [이미지 보관과 정리 배치](media-jobs.md#이미지-보관교체정리-배치)를 함께 확인한다.

플래너 배정과 실제 착용은 별개다. `PlannerEntry.wornAt`은 사용자가 ‘입었어요’로 확인한 시각이며 null·필드 누락은 미확정이다. 기존 일정도 자동 확정하지 않는다. `setPlannerEntryWorn`은 해당 주·날짜·현재 코디 ID를 검증한 뒤 오늘 또는 과거 일정의 확인·취소를 저장한다. 미래 확인은 한국 날짜 기준으로 거절하며 같은 상태의 중복 요청은 확인 시각을 바꾸지 않는다.

하루 카드·날짜 상세의 `PlannerWearAction`에서 확인·취소하고 주간·월간 보기에 완료 배지를 표시한다. 옷 구성이 바뀌거나 날짜가 이동하면 해당 날짜의 확인과 착용 기온을 초기화한다. 같은 옷 조합의 재저장·AI 사진·이름 변경은 확인과 체감·기온을 유지한다. 변경 후 플래너·옷별 착용·통계·룩북 이력·잊고 있던 옷 조회를 갱신한다.

코디북의 착용 이력·순위는 현재 옷 ID 집합과 정확히 같은 날짜 복사본만 연결한다. ABC를 ABD로 수정하면 ABC 착용을 ABD 횟수로 표시하지 않으며 이름·사진만 변경하면 같은 조합의 이력은 유지한다. 옷별 횟수·최근 착용·체감 추천은 날짜 복사본의 실제 구성과 확인 기록을 읽는다.

실제 착용을 확인한 날짜에는 `wearFeeling`으로 체감 기록을 남긴다. 값은 `cold`(추웠어요)·`comfortable`(적당했어요)·`hot`(더웠어요)이며 null·누락은 미기록이다. 하루 카드·날짜 상세에서 선택·변경·지우기를 제공하고, 같은 코디라도 날짜별로 따로 저장한다. 체감은 사용자의 주관적 기록이며 예보나 `wearTemperatureC`에서 추정하지 않는다.

`setPlannerEntryWearFeeling`은 해당 주·날짜·코디 ID와 요청 시점의 `wornAt`을 검증해 지금도 같은 착용 완료 상태일 때만 저장한다. 미확정·미래 일정과 취소 후 다시 확인한 일정의 오래된 요청은 거절한다. 체감만 바꾸면 착용 확인 시각·횟수·기온은 유지한다. 확인 취소·다른 코디 교체·날짜 이동에서는 체감도 초기화하며, 같은 코디 재저장과 중복 착용 확인에서는 유지한다.

실제 일평균 기온이 기록된 지난 착용의 체감은 이후 비슷한 예보 일평균의 날씨 코디 추천에 반영한다. `WeatherSnapshot.meanTemperatureC`는 현재 순간 기온과 별도로 보존한 예보 일평균이며, 기록이 없는 기온은 추정하지 않는다. 개인 보정의 범위·순위·캐시 계약은 [AI 기능](ai.md#개인-체감과-날씨-추천)에 있다.

`planner-wear.ts`의 `confirmedWearWhere`가 옷별 이력·통계·최근 착용·착용 날씨 조회의 공통 조건이다. 옷별 착용 횟수는 [wardrobe.service.ts](../../apps/api/src/features/wardrobe/wardrobe.service.ts)에서 확인된 날짜 중복을 제거해 계산한다. 룩북의 [outfitWearSummary.ts](../../apps/web/src/features/lookbook/utils/outfitWearSummary.ts)는 오늘까지 확인된 날짜만 횟수·기온 범위에 포함한다. 오늘·미래의 미확인 배정은 예정으로 표시하며 과거 미확인 배정은 착용 횟수에 포함하지 않는다. 코디 배정 조회는 예정 표시를 위해 미확인 일정도 `wornAt`과 함께 반환한다.

최근 착용 경고는 `features/planner/recent-wear-conflict.ts`, 웹 조회는 `features/plan/api/recentWearQueries.ts`에 있다. 경고 기간·조합/아이템 알림 설정은 이 경로의 입력에 반영된다.

## 날짜 기준

[date.ts](../../apps/api/src/lib/date.ts)는 `YYYY-MM-DD`를 검증해 UTC 자정의 Date로 표현한다. 오늘의 날짜 경계는 `wardrobe.service.ts`의 `getKoreaTodayUtc`가 한국 시간으로 계산한다. 저장용 날짜 표현과 실제 시각의 시간대를 구분하는 구조다.

## 날씨와 위치

[weather.service.ts](../../apps/api/src/features/weather/weather.service.ts)는 Open-Meteo 예보와 지난 날짜의 하루 평균 기온을 조회한다. 예보 결과는 지역·날짜별 캐시와 `expiresAt`을 갖고, 캐시 재사용은 만료 시각을 연장하지 않는다.

| 필드 | 의미 |
| --- | --- |
| `temperatureC` | 플래너 배정 시 전달받아 저장한 기온 |
| `wearTemperatureC` | 지난 착용일의 하루 평균 기온 |

위치 설정은 웹의 [notificationWeatherPreferences.ts](../../apps/web/src/features/settings/utils/notificationWeatherPreferences.ts)에 로컬 저장된다. [useWearWeatherLocationSync.ts](../../apps/web/src/features/plan/hooks/useWearWeatherLocationSync.ts)는 허용된 위치를 진입·복귀 때 서버로 동기화하며 새 권한 팝업을 요청하지 않는다.

서버는 좌표를 지역 단위로 반올림해 계정과 오늘 이후 일정에 반영한다. 신규 배정·날짜 이동도 오늘 이후에는 저장된 현재 지역을 연결하며, 과거 날짜의 기존 지역은 유지하고 새 과거 일정에 현재 위치를 소급 적용하지 않는다. 사용 해제·권한 거절은 해당 지역을 비우고, 지난 일정의 지역·기온은 새 위치로 덮어쓰지 않는다.

[wear-weather.service.ts](../../apps/api/src/features/planner/wear-weather.service.ts)의 worker는 실제 착용을 확인한 지난 일정 중 코디·지역이 있고 아직 기온이 없는 기록만 처리한다. [wear-weather.repository.ts](../../apps/api/src/features/planner/wear-weather.repository.ts)는 중복 처리와 조회 중 삭제·재배정·지역 변경·확인 취소를 검사한다. 조회 때의 확인 시각이 바뀌어도 이전 결과는 저장하지 않는다. 제공자 오류 시 현재 날씨·예보를 대신 저장하지 않고 재시도한다.

## 관련 검사

`tests/planner-snapshots.spec.ts`, `tests/plan.spec.ts`, `tests/planner-wear-completion.spec.ts`, `tests/planner-wear-feeling.spec.ts`, `tests/lookbook-wear-weather.spec.ts`, `apps/web/tests/plannerWear.test.ts`, `apps/web/tests/outfitWearSummary.test.ts`와 API의 `planner-outfit-wear-history.test.ts`·`planner-move-weather.test.ts`·`planner-wear.service.test.ts`·`planner-wear-feeling.service.test.ts`·`planner-wear-consumers.test.ts`·최근 착용·날씨 테스트가 관련된다.

`wear-weather.integration.test.ts`는 실행 플래그·테스트 DB 이름을 확인하고 종료 시 해당 DB를 삭제한다. 조건과 다른 통합 검사의 차이는 [개발과 검증](development.md#단위-테스트와-통합-테스트)에 있다.
