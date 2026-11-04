import type { QueryClient } from '@tanstack/react-query'

/** 옷장 편집 이후의 추천을 이전 결과·진행 중 응답과 분리하는, 현재 QueryClient의 변경 번호다. */
export const outfitRecommendationRevisionKey = ['outfits', 'recommendation-revision'] as const

/** 옷 추가·수정·보관 성공 후 호출한다. 번호만 바꾸며 새 AI 요청은 시작하지 않는다. */
export function advanceOutfitRecommendationRevision(client: QueryClient) {
  // 조회 화면이 닫혀 있어도 번호가 GC되어 예전 0번 결과로 돌아가지 않게 한다. 계정 전환의 clear에서는 함께 비워진다.
  client.setQueryDefaults(outfitRecommendationRevisionKey, { gcTime: Infinity })
  client.setQueryData<number>(outfitRecommendationRevisionKey, (revision = 0) => revision + 1)
}
