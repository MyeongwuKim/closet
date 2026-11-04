# 추천 변경의 조건별 확인

## 입력과 조합

- 수동 매칭은 선택한 ID를 중복 제거한 뒤 공용 `MAX_OUTFIT_ITEMS` 제한과 내 활성·분류 완료 아이템 여부를 확인한다. 후보 조회의 소유권·활성 상태 필터와 선택한 옷 제외를 유지한다.
- 오늘 추천은 날짜·지원 색감·날씨 수치를 검증한다. 날씨 날짜는 추천 날짜와 같아야 하며, 기온 범위·강수확률·출처를 검증한 뒤 날씨 설명과 권장 계절을 정규화한다.
- 기준 옷은 후보 수·조합 수 제한 전에 고정한다. 기준 옷의 계절이 맞지 않거나 함께 입을 구성이 없으면 기준을 빼고 다른 코디로 대체하지 않는다.
- 기본 구성은 이너 상의와 하의 또는 원피스다. 추가 카테고리·레이어 역할도 반영하며, 아우터를 이너로 쓰거나 이너 없이 추천하지 않는다.
- 체감 기온에 따른 보온성·레이어 조건과 사용자가 고른 기준 옷의 예외를 함께 확인한다. 재추천의 제외 목록은 아우터에 적용하고 기준 옷은 유지한다.
- 요청한 색감의 조합이 있으면 우선하고 없으면 기존 일반 추천으로 돌아간다. `colorSchemeApplied`는 실제 선택된 구성의 판정값이며 억지로 true로 바꾸지 않는다. 완성 조합이 없으면 `ready: false`, 빈 아이템과 후보 수를 반환하고 사용권을 예약하지 않는다.
- 현재 추천은 저장된 선호 스타일·핏을 조건으로 조회하지 않는다. 구버전 `style`·`mode` 입력을 받는 호환 경로와 새 추천 조건을 구분한다.

근거: [today-outfit-recommendation.service.ts](../../../../apps/api/src/features/outfit/today-outfit-recommendation.service.ts), [outfit-style-rules.ts](../../../../apps/api/src/features/outfit/outfit-style-rules.ts), [outfit-recommendation.service.ts](../../../../apps/api/src/features/outfit/outfit-recommendation.service.ts). 조합 검사는 [outfit-style-rules.test.ts](../../../../apps/api/src/features/outfit/outfit-style-rules.test.ts), API 계약·fallback 검사는 [today-outfit-recommendation.service.test.ts](../../../../apps/api/src/features/outfit/today-outfit-recommendation.service.test.ts)에 있다.

## 설명과 응답

- 실제 HEX가 유효하면 넓은 색상명보다 우선하는 색 판정 경로를 유지한다. 패턴·다색·미확인 색을 단색 관계로 확정하지 않는다. 상세 판정은 공용 색상 규칙과 기존 회귀 사례를 기준으로 한다.
- 조합 계산용 보조 추정 속성과 AI 설명에 넘길 관찰 속성을 구분한다. 저장된 분석·충분한 확신도가 없는 핏·소재를 관찰값처럼 보내지 않는다.
- 수동 매칭 AI는 제공된 후보 안에서 선택하고 서버가 계산한 제목·요약·컬러 및 후보별 관계·이유를 유지한다. 오늘 추천 AI는 이미 선택된 코디를 바꾸지 않고 제공된 이유 중에서 선택한다.
- JSON 스키마 통과만으로 성공 처리하지 않는다. 외부·중복 후보, 다른 후보의 이유를 바꿔 붙인 응답, 계산과 모순되는 색 관계, 근거 없는 착용 효과, 내부 코드가 드러난 문장을 확인한다. 잘못된 AI 설명은 기존 검증된 결과로 대체하고 실제 출처·모델 표시를 유지한다.

근거: [recommendation-evidence.ts](../../../../apps/api/src/features/outfit/recommendation-evidence.ts), [recommendation-text.ts](../../../../apps/api/src/features/outfit/recommendation-text.ts), 위의 두 추천 service. 관련 검사는 `recommendation-evidence.test.ts`, `recommendation-text.test.ts`, `today-outfit-recommendation.service.test.ts`다.

## 캐시와 추천 기록

- [queryKeys.ts](../../../../apps/web/src/lib/queryKeys.ts)의 사용자·규칙 버전·선택 조건 구분을 유지한다. 오늘 추천 쿼리는 날짜·계절·색감·재추천 순서·아우터 제외·기준 옷·날씨·개인 체감 근거 revision을 구분한다. 서버 실행기·사용권 입력 키와 브라우저 저장 기록은 각각 역할에 맞는 키를 사용하므로 동일한 형태로 억지로 합치지 않는다.
- 스타일 제안의 [outfitRecommendationCache.ts](../../../../apps/web/src/features/lookbook/api/outfitRecommendationCache.ts)는 옷장 생성·수정·보관·브랜드 삭제 이후 결과를 revision으로 분리한다. 조회는 명시적 사용권 확인 뒤에만 실행한다. 수정이나 invalidate가 유료 요청을 자동 실행하거나 옛 진행 응답이 새 revision의 결과가 되지 않게 한다.
- [todayOutfitQueries.ts](../../../../apps/web/src/features/plan/api/todayOutfitQueries.ts)의 초기 데이터·이전 데이터 표시·응답 검증에서 기준 옷이 실제 아이템에 포함되는지 확인한다. 준비되지 않은 결과나 기준 옷이 빠진 결과를 새 추천 기록으로 저장하지 않는다.
- [todayRecommendationHistory.ts](../../../../apps/web/src/features/plan/utils/todayRecommendationHistory.ts)는 이전 스타일·이전 규칙 버전 기록을 보존하되 현재 추천의 초기 캐시와 분리한다. 규칙 변경을 이유로 과거 기록 전체를 지우지 않는다. 손상된 기록은 유효한 다른 범위의 기록까지 막지 않도록 처리한다.
- 서버가 저장한 설명을 재사용할 때도 아이템은 현재 옷장 데이터에서 붙이는 경로를 유지한다. 옷의 색·속성·수정 시각 등 현재 입력 근거가 바뀌면 이전 AI 결과가 재사용되지 않는지 확인한다.

관련 검사: [outfitRecommendationCache.test.ts](../../../../apps/web/tests/outfitRecommendationCache.test.ts), [todayOutfitQueries.test.ts](../../../../apps/web/tests/todayOutfitQueries.test.ts), [todayOutfitRecommendation.test.ts](../../../../apps/web/tests/todayOutfitRecommendation.test.ts), [color-recommendation-history.test.ts](../../../../tests/color-recommendation-history.test.ts).

## 개인 체감과 날씨 추천

- `thermal-recommendation.service.ts`·`.rules.ts`와 `outfit-style-rules.ts`의 보온성 순위 보정을 확인한다. 실제 착용 확인·체감·실제 일평균이 있는 과거 기록만 근거로 쓰며, 현재 순간 기온을 예보·과거 일평균과 섞지 않는다. 기간·표본·강도와 상세 진입점은 [개인 체감 맥락](../../../../docs/ai-context/ai.md#개인-체감과-날씨-추천)을 따른다.
- 근거가 없으면 기존 순위를 유지한다. 보정은 기존 후보·기준 옷·색감 조건 안에서 수행하고 예보 수치를 바꿔 설명하지 않는다. 보정 규칙을 바꾸면 `THERMAL_RECOMMENDATION_RULES_VERSION`과 결과·설명 근거를 함께 확인한다.
- `thermalContextRevision`을 추천·AI 설명·사용권 재사용 입력·웹 쿼리·로컬 기록의 현재 캐시에 함께 반영한다. 과거 기록을 지우지 않고 현재 날씨·revision과 일치하는 결과만 초기 캐시로 사용한다.
- 오래된 근거는 사용권 예약 전에 `THERMAL_CONTEXT_CHANGED`로 거절한다. 웹의 `thermalRecommendationQueries.ts`에서 무료 근거 조회를 갱신한 뒤 최신 조건으로 사용권을 확인하는 경로를 유지하며, 이 오류를 제공자 실패 fallback으로 우회하지 않는다.

관련 검사: API `thermal-recommendation.rules.test.ts`, `thermal-recommendation.service.test.ts`, `outfit-thermal-ranking.test.ts`, 웹 `thermalRecommendationContext.test.ts`, E2E `tests/thermal-recommendation.spec.ts`.

## 사용권과 실행 조건

- 입력 거절·사용권 부족은 제공자 실패와 구분한다. 사용권을 예약하지 못한 요청을 기본 추천으로 우회하지 않는다. 제공자 실패로 기본 결과를 반환하는 경우에는 해당 서비스의 기존 null·정산 경로를 유지한다.
- 같은 입력의 진행 중 요청은 기존 결과를 기다리고, 성공 결과는 추가 실행·정산 없이 재사용한다. 정산은 현재 사용자·예약 토큰·상태·만료를 확인하며, 실패·만료 반환을 중복 적용하지 않는다.
- API 키 미설정 시 수동 매칭과 오늘 추천의 분기·예약 위치가 같다고 가정하지 않는다. 이 동작을 바꾸는 요청이면 서비스별 사용권 결과를 따로 확인한다.
- [useAiCreditAction.ts](../../../../apps/web/src/features/lookbook/hooks/useAiCreditAction.ts)와 [requireAiCredit.ts](../../../../apps/web/src/features/lookbook/api/requireAiCredit.ts)는 중복 클릭·화면 종료·계정 전환 뒤 이전 작업 시작을 막는다. 광고 안내 후에는 원래 버튼을 다시 눌러 시작하는 흐름을 유지한다. 기존 결과 보기와 새 추천의 사용권 확인을 구분하고, 클라이언트에서 잔액을 직접 차감하지 않는다.

근거: [recommendation-credit.service.ts](../../../../apps/api/src/features/preview-credits/recommendation-credit.service.ts), [recommendation-credit.repository.ts](../../../../apps/api/src/features/preview-credits/recommendation-credit.repository.ts). 서비스 검사는 [recommendation-credit.service.test.ts](../../../../apps/api/src/features/preview-credits/recommendation-credit.service.test.ts), 사용자 흐름 검사는 `tests/recommendation-credits.spec.ts`, `tests/style-recommendation-credits.spec.ts`다.

저장소의 잠금·정산까지 확인하는 통합 테스트는 각 파일의 테스트 DB 조건을 확인한 뒤 별도로 선택한다. 서비스 메서드를 대체한 단위 테스트 통과를 실제 DB 동시성 검증으로 보고하지 않는다.
