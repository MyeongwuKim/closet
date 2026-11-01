import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClothingCategory, OutfitRecommendation } from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { useMeQuery } from '../../settings/api/profileQueries'
import { toWardrobeItem, wardrobeItemFields, type WardrobeItemPayload } from '../../closet/api/wardrobeQueries'
import { previewCreditKeys } from './previewCreditQueries'

type RecommendationPayload = Omit<OutfitRecommendation, 'candidates'> & {
  candidates: Array<Omit<OutfitRecommendation['candidates'][number], 'item'> & { item: WardrobeItemPayload }>
}

/**
 * 사용자가 시작한 추천에서 컬러와 옷 후보를 함께 받고 계정·선택 옷별로 보관한다.
 * 표시 탭은 조회 키에 포함하지 않는다. 같은 결과 재열기·포커스 복귀는 유료 요청을 재실행하지 않는다.
 * 화면을 닫아도 진행 중인 응답을 보관하고, 완료·실패 후 공통 사용권 잔액을 갱신한다.
 */
export function useOutfitRecommendationQuery(selectedItemIds: string[], targetCategory: ClothingCategory | null, enabled: boolean) {
  const me = useMeQuery()
  const client = useQueryClient()
  const ownerId = me.data?.id ?? null
  return useQuery({
    queryKey: queryKeys.outfits.recommendation(ownerId, selectedItemIds, targetCategory),
    enabled: enabled && Boolean(ownerId) && selectedItemIds.length > 0 && targetCategory !== null,
    staleTime: 'static',
    gcTime: 24 * 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<OutfitRecommendation> => {
      if (!targetCategory || !ownerId || client.getQueryData<{ id: string }>(queryKeys.me)?.id !== ownerId) {
        throw new Error('로그인 상태와 추천할 옷을 확인해주세요.')
      }
      try {
        const data = await graphqlRequest<{ outfitRecommendation: RecommendationPayload }, {
          input: { selectedItemIds: string[]; targetCategory: ClothingCategory }
        }>(`
          query OutfitRecommendation($input: OutfitRecommendationInput!) {
            outfitRecommendation(input: $input) {
              targetCategory headline summary model source
              recommendedColors { name hex reason role }
              candidates { reason relation item { ${wardrobeItemFields} } }
            }
          }
        `, { input: { selectedItemIds, targetCategory } })
        return {
          ...data.outfitRecommendation,
          candidates: data.outfitRecommendation.candidates.map((candidate) => ({ ...candidate, item: toWardrobeItem(candidate.item) })),
        }
      } finally {
        void client.invalidateQueries({ queryKey: previewCreditKeys.all })
      }
    },
  })
}
