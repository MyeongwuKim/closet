---
name: closet-recommendation-change
description: "closet의 코디·컬러·오늘 추천 로직, 추천 설명의 근거, 결과 캐시나 추천 사용권 연동을 변경·수정할 때 사용한다. 추천 화면의 단순 문구·스타일 수정이나 코드 검토만 하는 요청에는 사용하지 않는다."
---

# 코디 추천 변경

## 영향 경로 찾기

- [AI 맥락의 추천과 캐시](../../../docs/ai-context/ai.md#추천과-캐시)에서 해당 추천의 진입점을 찾는다. 이미지 분류·미리보기 문서는 그 흐름까지 바뀔 때만 읽는다.
- 원인에 따라 `outfit-color-rules.ts`, `outfit-recommendation-matching.ts`, `outfit-recommendation.service.ts`, `today-outfit-recommendation.service.ts` 중 대상과 직접 호출부부터 확인한다. 완성 코디·기준 옷·계절·날씨 조건은 `outfit-style-rules.ts`의 조합 생성도 확인한다. 모두 `apps/api/src/features/outfit`에 있다.
- 버그 수정은 사용자 입력이나 기존 실패 사례로 기대 결과를 먼저 구체화한다. 색상 관계·후보 선택·AI 설명 중 어느 단계의 문제인지 구분한다.

## 규칙과 설명 맞추기

- 선택한 ID의 개수·소유권·활성 상태·분류 완료 여부와 입력 날짜·색감·날씨 검증을 유지한다. 후보는 현재 사용자의 옷장에서 가져오고 선택한 옷을 후보로 다시 반환하지 않는다.
- 선택한 옷 전체와 후보의 등록된 색·속성을 기준으로 판단한다. 알 수 없는 색·다색·패턴을 확정된 단색처럼 처리하거나, 등록되지 않은 디자인·실측 정보를 추천 근거로 만들지 않는다.
- 후보 선택과 컬러 관계, 사용자에게 보여주는 설명이 같은 계산 근거를 사용하도록 확인한다. AI는 서버가 제공한 후보·검증된 설명 범위 안에서 선택한다. JSON 형식뿐 아니라 후보 ID·관계·이유의 대응과 중복도 검사하고, 검증 실패 시 기존 fallback과 `source`·`model` 표시를 유지한다.
- 바뀐 결과가 이전 캐시와 충돌하는지 확인한다. 필요한 경우 `packages/types/src/outfitColors.js`의 규칙 버전, 웹 `apps/web/src/lib/queryKeys.ts`, 서비스의 입력 키·결과 캐시를 함께 조정한다.
- 추천 사용권에 영향이 있으면 `apps/api/src/features/preview-credits/recommendation-credit.service.ts`와 직접 저장소를 확인한다. 같은 입력의 결과 재사용·중복 예약 방지·실패 시 정산 경로를 유지한다. 입력 거절·사용권 부족·예약 만료를 AI 제공자 실패와 같은 fallback으로 우회하지 않는다.

## 해당 조건을 바꿀 때만 추가 확인

| 변경 대상 | 추가 기준 |
| --- | --- |
| 기준 옷·계절·레이어·날씨·색감·재추천 | [입력과 조합](references/recommendation-cases.md#입력과-조합) |
| 개인 체감·착용 기온·보온성 보정·체감 근거 revision | [개인 체감과 날씨 추천](references/recommendation-cases.md#개인-체감과-날씨-추천) |
| 프롬프트·설명·응답 검증·fallback | [설명과 응답](references/recommendation-cases.md#설명과-응답) |
| 쿼리 키·저장 기록·규칙 버전 | [캐시와 추천 기록](references/recommendation-cases.md#캐시와-추천-기록) |
| 추천 사용권·광고 후 실행·계정 전환 | [사용권과 실행 조건](references/recommendation-cases.md#사용권과-실행-조건) |

## 검증 선택

| 변경 영역 | 관련 테스트 |
| --- | --- |
| 색상 관계·팔레트 | `apps/api/src/features/outfit/outfit-color-rules.test.ts` |
| 후보 순위·매칭 | `apps/api/src/features/outfit/outfit-recommendation-matching.test.ts` |
| 조합·레이어·기준 옷·날씨 | `apps/api/src/features/outfit/outfit-style-rules.test.ts` |
| 오늘의 코디·수동 매칭·fallback | `apps/api/src/features/outfit/today-outfit-recommendation.service.test.ts` |
| 개인 체감·보온성 순위·근거 캐시 | 같은 API 폴더의 `thermal-recommendation.rules.test.ts`, `thermal-recommendation.service.test.ts`, `outfit-thermal-ranking.test.ts`, 웹 `thermalRecommendationContext.test.ts`, `tests/thermal-recommendation.spec.ts` |
| 설명 근거·형식 | 같은 폴더의 `recommendation-evidence.test.ts`, `recommendation-text.test.ts` |
| 추천 사용권 | `apps/api/src/features/preview-credits/recommendation-credit.service.test.ts` |
| 웹 쿼리·기록 | `apps/web/tests/outfitRecommendationCache.test.ts`, `apps/web/tests/todayOutfitQueries.test.ts`, `apps/web/tests/todayOutfitRecommendation.test.ts`, `tests/color-recommendation-history.test.ts` |
| 추천 화면·사용권 버튼 | `tests/recommendation-color.spec.ts`, `tests/recommendation-credits.spec.ts`, `tests/style-recommendation-credits.spec.ts` |

가장 가까운 테스트부터 실행하고 영향이 여러 규칙으로 이어질 때 `pnpm test:ai:rules`로 넓힌다. 이 묶음에는 조합·설명·웹 기록·사용권 테스트가 모두 들어 있지 않으므로, 변경한 영역의 파일은 표에서 별도로 선택한다. 명령은 저장소 루트 기준이며 개별 API 테스트 실행 예시는 다음과 같다.

```sh
pnpm --filter @closet/api exec node --import tsx --test src/features/outfit/outfit-color-rules.test.ts
```

수정한 패키지의 타입 검사와 사용 가능한 lint를 추가한다. 웹 상태나 사용자 흐름이 바뀌면 해당 웹 테스트를 선택한다. 실제 AI 응답 확인은 사용자가 요청한 경우에만 `pnpm test:ai:api`로 수행하며, 단위 테스트나 fallback 성공을 실제 AI 응답 검증으로 보고하지 않는다.
