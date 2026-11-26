# AI 기능 맥락

## 옷 분석과 등록

웹의 [useWardrobeImageAnalysis.ts](../../apps/web/src/features/closet/hooks/useWardrobeImageAnalysis.ts)는 이미지 분석 흐름의 진입점이다. 분류·배경 제거 결과는 공통 분류 확인 대기열로 이어지고, 사용자 확인·수정 후 업로드·옷장 저장을 수행한다.

[classification.service.ts](../../apps/api/src/features/classification/classification.service.ts)는 이미지 형식·크기를 검증하고 분류·배경 제거·사이즈표 분석을 연결한다. 분류 실패는 오류를 전달하고, 배경 제거만 실패하면 별도 재요청 경로가 있다. 스탠드칼라는 일반 접힌 칼라와 구분해 `necklineStyle: standCollar`로 내려주며, 기존 값과 함께 같은 옷장 형태 필드에 저장한다.

[openAiWardrobeClassifier.ts](../../apps/api/src/features/classification/openAiWardrobeClassifier.ts)는 분류 결과에 `refineGarmentColor.ts`·`refineBlackColor.ts`의 대표색 보정을 연결한다. 그린·올리브 추정은 세 원단 표본에 올리브색이 일치하면 표본 대표색을 저장한다. 배경 제거는 [backgroundRemover.ts](../../apps/api/src/features/classification/backgroundRemover.ts)의 로컬 Transformers 모델을 별도로 사용한다. 모델 로드·캐시와 사진 처리 대기열이 있어 분류 API 응답과 모델 준비 실패는 별개다.

업로드와 이미지 보관 단계는 [이미지와 생성 작업](media-jobs.md#옷-이미지-업로드)에 있다.

## 추천과 캐시

| 기능 | API 진입점 |
| --- | --- |
| 선택한 옷의 컬러·후보 추천 | [outfit-recommendation.service.ts](../../apps/api/src/features/outfit/outfit-recommendation.service.ts) |
| 오늘의 코디 추천 | [today-outfit-recommendation.service.ts](../../apps/api/src/features/outfit/today-outfit-recommendation.service.ts) |
| 완성 코디·기준 옷·계절·날씨 | [outfit-style-rules.ts](../../apps/api/src/features/outfit/outfit-style-rules.ts) |
| 색상 관계·추천 규칙 | [outfit-color-rules.ts](../../apps/api/src/features/outfit/outfit-color-rules.ts) |
| 후보 매칭·설명 근거 | `outfit-recommendation-matching.ts`, `recommendation-evidence.ts`, `recommendation-text.ts` |

마지막 행의 파일은 `apps/api/src/features/outfit`에 있다. 추천 엔진이 조합·색 관계·설명 근거를 계산하고, AI는 제공된 후보나 검증된 설명 중에서 선택한다. 현재 추천은 저장된 선호 스타일·핏을 새 추천 조건으로 사용하지 않는다. 구버전 입력·과거 기록과의 호환 경로는 남아 있다.

오늘·내일 추천 카드는 실제로 고른 옷 이름으로 제목과 조합 요약을 만든다. 색감을 직접 선택한 경우 추천 응답의 제목 앞에 적용된 색감 이름을 붙인다. 맞는 조합이 없으면 ‘기본 추천’을 붙인다. 전체 설명에서는 실제 색 차이와 실루엣 균형, 추운 날 겉옷을 포함한 이유를 근거가 있는 경우에 표시한다. 코디 구성이나 같은 핏의 이름을 설명에 반복하지 않는다. 서버는 조건을 통과한 조합에서 주요 옷과 신발이 다른 후보를 최대 6개 고른다. OpenAI에 옷 설명을 중복 없이 한 번씩 보내고, 모델은 전체 착장의 스타일을 비교해 후보 번호만 반환한다. 서버는 번호가 실제 후보인지 검증하고 선택된 옷으로 제목·요약·이유를 만든다. 같은 추천을 재사용할 때는 저장한 후보 번호로 현재 옷을 붙인다. 제공자 호출은 5초 안에 한 번만 시도하며, 실패하면 서버 순위의 조합을 보여주고 예약한 사용권을 반환한다. 이 기한은 옷장 조회나 사용권 처리 시간을 포함하지 않는다.

톤온톤과 톤인톤은 상의·하의·원피스·아우터·중간 아우터의 주요 색에서 먼저 성립해야 한다. 신발과 액세서리의 색은 조합을 깨뜨리는지 확인할 때 반영한다. 톤인톤은 거의 회색인 미세한 색 틀어짐을 별도 색 계열로 잡지 않으며, 주요 옷 두 벌의 구분되는 색과 비슷한 밝기·채도를 확인한다. 결과 설명에 해당 옷을 표시한다. 공용 색상 규칙 버전은 `packages/types/src/outfitColors.js`와 웹의 [queryKeys.ts](../../apps/web/src/lib/queryKeys.ts)로 연결된다. [todayOutfitQueries.ts](../../apps/web/src/features/plan/api/todayOutfitQueries.ts)는 기준 옷이 실제 결과에 포함됐는지 검증하고, [todayRecommendationHistory.ts](../../apps/web/src/features/plan/utils/todayRecommendationHistory.ts)는 이전 기록을 보존해 날짜별 중복 판정과 기록 열기에 사용한다.

플래너의 ‘오늘 날씨로 바로 추천’은 사용권을 확인하고 위치 기반 예보로 추천을 시작한다. 예보가 없으면 재시도와 ‘조건 바꾸기’를 안내한다. 직접 조건을 고르면 계절을 고르는 즉시 추천하며, 열어 둔 추천은 선택 당시 예보를 유지한다. 옷 상세의 ‘이 옷으로 코디 추천’은 기준 옷의 등록 계절 중 현재와 가까운 것을 사용해 바로 결과를 준비한다. 새 추천의 색감은 자동으로 처리하고, 이전 기록의 색감은 기록에 보존한다. 화면 복귀 시 플래너 예보가 갱신돼도 추천을 자동으로 실행하지 않는다. 추천 응답 연결이 실패하면 같은 입력으로 한 번만 다시 요청해 서버에 저장된 결과를 복구한다.

플래너의 ‘내일 코디 추천’은 해당 날짜의 유효한 예보를 받아 기존 추천 경로를 사용한다. 추천·예보 응답은 선택한 날짜가 일치할 때만 사용하고 캐시와 기록도 날짜별로 나눈다. 플래너 배정 후에는 해당 일정과 착용 관련 조회를 갱신하되 열어 둔 추천을 다시 실행하지 않는다.

오늘·내일 추천을 열 때 직전 날짜의 플래너와 이 기기에 저장된 추천 기록에서 핵심 옷 ID를 읽는다. 웹은 이 목록을 쿼리 키에 포함하고 겹치는 초기 기록은 복원하지 않는다. 서버는 신발·액세서리를 뺀 옷 구성이 같은 후보를 순위·색감 선택 전에 제외한다. 남은 후보가 없으면 사용권 차감 없이 안내하고, 사용자가 전날 플래너나 추천 기록을 열 수 있다. 이미 열어 둔 화면에서 일정이 갱신돼도 제외 목록은 그 화면에서 다시 추천하는 동안 유지한다.

계절을 직접 골랐거나 날씨로 추천받는 경우 모두 이 기기에 남아 있는 대상 날짜의 코디를 제외한다. 결과 화면의 ‘다른 추천’도 본 핵심 조합을 누적해 제외한다. 서버는 조건이 맞는 후보에서 덜 추천한 상의·하의를 우선하고, 그중 최근에 덜 나온 신발을 고른다. 신발·소품만 바뀐 구성은 후보 개수에도 한 벌로 센다. 해당 날짜에 이미 본 코디 때문에 직접 고른 색감만 소진된 경우 새 기본 추천을 차감하는 대신 색감 후보 소진을 안내한다. 본 조합이 모두 제외되면 사용권을 차감하지 않고 이전 추천을 열 수 있게 한다. 같은 요청의 연결 오류 재시도는 제외 목록과 신발 순서를 유지한다.

공용 사용권을 모두 쓰면 생성·추천 버튼에서 ‘광고 보고 충전’을 안내한다. 광고 1편의 서버 보상 확인 뒤 잔액을 갱신한다. 로컬 개발 API와 테스트 광고 모드의 개발 Cloud Run이 허용하면 플래너 상단에 테스트 충전 버튼을 표시한다.

스타일 제안의 [outfitRecommendationQueries.ts](../../apps/web/src/features/lookbook/api/outfitRecommendationQueries.ts)는 계정·선택 옷·대상 종류·옷장 변경 revision별로 결과를 보관한다. 옷 생성·수정·보관·브랜드 삭제 성공은 `outfitRecommendationCache.ts`의 번호만 증가시키며 이전 결과와 진행 응답을 분리한다. 조회는 비활성 상태로 두고 사용권 확인 뒤 명시적 클릭에서만 시작해, 수정·포커스 복귀·결과 재열기가 유료 요청을 자동 실행하지 않게 한다.

추천 후보의 보류 판정은 `@closet/types/wardrobe-preferences`의 런타임 `.js`와 `.d.ts`를 웹·API가 공유한다. 사이즈 문제는 해제 전까지, 일시 보류는 재개일 전까지 재발견·오늘/내일 조합·스타일 추천의 자동 후보에서 제외한다. 사용자가 직접 고른 기준 옷과 수동 코디는 허용하며, 일반 옷장 조회나 과거 착용 기록은 제거하지 않는다. 날짜가 있는 추천은 대상 날짜를, 날짜 없는 스타일 추천은 한국 오늘을 사용한다.

오늘 추천 결과 Hook은 진입 시 무료 옷장 조회를 새로 완료한 뒤 현재 설정으로 이전 데이터와 새 응답을 검증한다. 옷 ID와 보류 설정을 쿼리 키로 구분하고, 열어 둔 화면에서 설정이 바뀌면 재시도를 요구한다. 설정 변경의 invalidate 자체는 유료 추천을 실행하지 않는다. 과거 추천은 기록에서 열 수 있다. 새 추천은 그날 본 조합을 제외하고 현재 보류 설정으로 조회한다. 스타일 추천의 키에는 한국 날짜도 포함해 보류 만료 뒤 이전 날짜 캐시를 현재 결과로 쓰지 않는다. `useKoreaDay`는 날짜 전환·앱 복귀만 추적하며 AI를 실행하지 않는다.

## 개인 체감과 날씨 추천

`thermal-recommendation.service.ts`는 본인의 확인된 지난 착용 중 체감·실제 일평균 기온이 있는 기록을 읽는다. 최근 180일·예보 일평균과 ±4°C·최신 30건을 사용하고, 가까운 기온과 최근 기록에 무게를 둔다. 추웠다는 기록은 보온성 방향, 더웠다는 기록은 가벼운 방향으로 보정하며 적당했다는 기록은 중립 근거로 반영한다. 한 번의 기록은 약하게 반영하고 강도에 상한을 둔다.

`WeatherSnapshot.meanTemperatureC`는 예보의 하루 평균이다. 오늘의 `temperatureC`는 현재 순간 기온일 수 있으므로 과거 일평균과 직접 비교하지 않는다. 일평균 예보나 사용 가능한 착용 근거가 없으면 기존 순위를 유지한다. 실제 예보·체감 기온과 기존 날씨별 후보 제외, 기준 옷·색감 조건은 유지한 채 `outfit-style-rules.ts`에서 후보·조합의 보온성 순위만 보조 보정한다. 설명에는 실제로 사용한 체감 근거를 포함한다. 체감 영하 10도 이하는 보온성 있는 겉옷과 이너를 갖춘 조합을 색감이나 재추천보다 먼저 고려한다. 옷장에서 가능한 가장 높은 보온 단계의 후보를 모두 봤으면 더 얇은 후보로 내려가지 않는다.

웹은 무료 `thermalRecommendationContext` 조회로 최신 근거 revision을 확인한 뒤 추천을 요청한다. revision은 근거·날짜·일평균·규칙 버전의 해시이며 사용자 기록 ID를 노출하지 않는다. 추천·AI 설명·사용권 재사용 입력과 웹 쿼리 키에 반영한다. 오래된 revision은 사용권 예약 전에 `THERMAL_CONTEXT_CHANGED`로 거절하고 웹은 근거만 갱신해 다시 조회한다. 로컬 추천 기록은 보존하고, 쿼리의 날씨·revision이 일치하는 응답만 화면에서 재사용한다. 보정·순위 규칙이 바뀌면 `THERMAL_RECOMMENDATION_RULES_VERSION`도 갱신한다.

관련 검사는 `apps/api/src/features/outfit`의 `thermal-recommendation.*.test.ts`, `outfit-thermal-ranking.test.ts`, `today-outfit-recommendation.service.test.ts`, `apps/web/tests/thermalRecommendationContext.test.ts`와 `tests/thermal-recommendation.spec.ts`다.

## 미리보기 작업과 사용권

미리보기는 영속 작업을 등록한 뒤 worker에서 실행한다. AI 실행기의 캐시·실행량 제한, 사용자가 쓰는 공통 사용권 지갑, 이미지 보관 기한은 별개다. 자세한 생명주기와 진입점은 [이미지와 생성 작업](media-jobs.md)에 있다.

## 관련 검사

분류·대표색 보정·추천·조합·설명 테스트는 해당 구현 옆에 있다. 웹은 `apps/web/tests/todayOutfitQueries.test.ts`, `tests/color-recommendation-history.test.ts`, `tests/registration.spec.ts`, `tests/recommendation-color.spec.ts` 등이 관련된다.

`pnpm test:ai:rules`는 API의 `test:colors`에 연결된 일부 단위 테스트 묶음이며 조합·기록·사용권 검사를 모두 포함하지 않는다. `pnpm test:ai:api`는 별도 설정에서 실제 유료 AI를 호출한다. 구성과 색상 평가 CLI는 [개발과 검증](development.md#실제-ai-검사)에 있다.
