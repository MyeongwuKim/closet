# AI 기능 맥락

## 옷 분석과 등록

웹의 [useWardrobeImageAnalysis.ts](../../apps/web/src/features/closet/hooks/useWardrobeImageAnalysis.ts)는 이미지 분석 흐름의 진입점이다. 분류·배경 제거 결과는 공통 분류 확인 대기열로 이어지고, 사용자 확인·수정 후 업로드·옷장 저장을 수행한다.

[classification.service.ts](../../apps/api/src/features/classification/classification.service.ts)는 이미지 형식·크기를 검증하고 분류·배경 제거·사이즈표 분석을 연결한다. 분류 실패는 오류를 전달하고, 배경 제거만 실패하면 별도 재요청 경로가 있다.

[openAiWardrobeClassifier.ts](../../apps/api/src/features/classification/openAiWardrobeClassifier.ts)는 분류 결과에 `refineGarmentColor.ts`·`refineBlackColor.ts`의 대표색 보정을 연결한다. 배경 제거는 [backgroundRemover.ts](../../apps/api/src/features/classification/backgroundRemover.ts)의 로컬 Transformers 모델을 별도로 사용한다. 모델 로드·캐시와 사진 처리 대기열이 있어 분류 API 응답과 모델 준비 실패는 별개다.

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

공용 색상 규칙 버전은 `packages/types/src/outfitColors.js`와 웹의 [queryKeys.ts](../../apps/web/src/lib/queryKeys.ts)로 연결된다. [todayOutfitQueries.ts](../../apps/web/src/features/plan/api/todayOutfitQueries.ts)는 기준 옷이 실제 결과에 포함됐는지 검증하고, [todayRecommendationHistory.ts](../../apps/web/src/features/plan/utils/todayRecommendationHistory.ts)는 이전 기록을 보존하면서 현재 버전의 초기 캐시와 분리한다.

일반 추천의 ‘오늘 날씨로 바로 추천’은 사용권을 확인한 뒤 위치 기반 예보와 자동 색감으로 시작한다. 예보가 없으면 재시도와 ‘조건 바꾸기’를 안내한다. ‘조건 바꾸기’에서 계절·날씨와 색감을 직접 고를 수 있으며, 열어 둔 추천은 선택할 때 받은 예보를 유지한다. 화면 복귀 시 플래너 예보가 갱신돼도 추천을 자동으로 실행하지 않는다.

플래너의 ‘내일 코디 추천’은 해당 날짜의 유효한 예보를 받아 기존 추천 경로를 사용한다. 추천·예보 응답은 선택한 날짜가 일치할 때만 사용하고 캐시와 기록도 날짜별로 나눈다. 플래너 배정 후에는 해당 일정과 착용 관련 조회를 갱신하되 열어 둔 추천을 다시 실행하지 않는다.

스타일 제안의 [outfitRecommendationQueries.ts](../../apps/web/src/features/lookbook/api/outfitRecommendationQueries.ts)는 계정·선택 옷·대상 종류·옷장 변경 revision별로 결과를 보관한다. 옷 생성·수정·보관·브랜드 삭제 성공은 `outfitRecommendationCache.ts`의 번호만 증가시키며 이전 결과와 진행 응답을 분리한다. 조회는 비활성 상태로 두고 사용권 확인 뒤 명시적 클릭에서만 시작해, 수정·포커스 복귀·결과 재열기가 유료 요청을 자동 실행하지 않게 한다.

## 개인 체감과 날씨 추천

`thermal-recommendation.service.ts`는 본인의 확인된 지난 착용 중 체감·실제 일평균 기온이 있는 기록을 읽는다. 최근 180일·예보 일평균과 ±4°C·최신 30건을 사용하고, 가까운 기온과 최근 기록에 무게를 둔다. 추웠다는 기록은 보온성 방향, 더웠다는 기록은 가벼운 방향으로 보정하며 적당했다는 기록은 중립 근거로 반영한다. 한 번의 기록은 약하게 반영하고 강도에 상한을 둔다.

`WeatherSnapshot.meanTemperatureC`는 예보의 하루 평균이다. 오늘의 `temperatureC`는 현재 순간 기온일 수 있으므로 과거 일평균과 직접 비교하지 않는다. 일평균 예보나 사용 가능한 착용 근거가 없으면 기존 순위를 유지한다. 실제 예보·체감 기온과 기존 날씨별 후보 제외, 기준 옷·색감 조건은 유지한 채 `outfit-style-rules.ts`에서 후보·조합의 보온성 순위만 보조 보정한다. 설명에는 실제로 사용한 체감 근거를 포함한다.

웹은 무료 `thermalRecommendationContext` 조회로 최신 근거 revision을 확인한 뒤 추천을 요청한다. revision은 근거·날짜·일평균·규칙 버전의 해시이며 사용자 기록 ID를 노출하지 않는다. 추천·AI 설명·사용권 재사용 입력과 웹 쿼리 키에 반영한다. 오래된 revision은 사용권 예약 전에 `THERMAL_CONTEXT_CHANGED`로 거절하고 웹은 근거만 갱신해 다시 조회한다. 로컬 추천 기록은 유지하되 현재 날씨·revision이 같은 결과만 초기 캐시로 사용한다. 보정·순위 규칙이 바뀌면 `THERMAL_RECOMMENDATION_RULES_VERSION`도 갱신한다.

관련 검사는 `apps/api/src/features/outfit`의 `thermal-recommendation.*.test.ts`, `outfit-thermal-ranking.test.ts`, `today-outfit-recommendation.service.test.ts`, `apps/web/tests/thermalRecommendationContext.test.ts`와 `tests/thermal-recommendation.spec.ts`다.

## 미리보기 작업과 사용권

미리보기는 영속 작업을 등록한 뒤 worker에서 실행한다. AI 실행기의 캐시·실행량 제한, 사용자가 쓰는 공통 사용권 지갑, 이미지 보관 기한은 별개다. 자세한 생명주기와 진입점은 [이미지와 생성 작업](media-jobs.md)에 있다.

## 관련 검사

분류·대표색 보정·추천·조합·설명 테스트는 해당 구현 옆에 있다. 웹은 `apps/web/tests/todayOutfitQueries.test.ts`, `tests/color-recommendation-history.test.ts`, `tests/registration.spec.ts`, `tests/recommendation-color.spec.ts` 등이 관련된다.

`pnpm test:ai:rules`는 API의 `test:colors`에 연결된 일부 단위 테스트 묶음이며 조합·기록·사용권 검사를 모두 포함하지 않는다. `pnpm test:ai:api`는 별도 설정에서 실제 유료 AI를 호출한다. 구성과 색상 평가 CLI는 [개발과 검증](development.md#실제-ai-검사)에 있다.
