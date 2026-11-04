import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { ClothingCategory, OutfitRecommendation } from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { useMeQuery } from '../../settings/api/profileQueries'
import { toWardrobeItem, wardrobeItemFields, type WardrobeItemPayload } from '../../closet/api/wardrobeQueries'
import { previewCreditKeys } from './previewCreditQueries'
import { outfitRecommendationRevisionKey } from './outfitRecommendationCache'

type RecommendationPayload = Omit<OutfitRecommendation, 'candidates'> & {
  candidates: Array<Omit<OutfitRecommendation['candidates'][number], 'item'> & { item: WardrobeItemPayload }>
}

/**
 * 사용자가 시작한 추천에서 컬러와 옷 후보를 함께 받고 계정·선택 옷·옷장 변경 번호별로 보관한다.
 * 표시 탭은 조회 키에 포함하지 않는다. 같은 결과 재열기·포커스 복귀는 유료 요청을 재실행하지 않는다.
 * 옷장 변경은 이전 결과를 분리할 뿐 자동 조회하지 않는다. 사용권 확인 뒤 loadRecommendation을 눌러 시작한다.
 * 화면을 닫아도 진행 중인 응답은 해당 변경 번호에 보관하고, 완료·실패 후 공통 사용권 잔액을 갱신한다.
 */
export function useOutfitRecommendationQuery(selectedItemIds: string[], targetCategory: ClothingCategory | null) {
  const me = useMeQuery()
  const client = useQueryClient()
  const ownerId = me.data?.id ?? null
  const readRevision = () => client.getQueryData<number>(outfitRecommendationRevisionKey) ?? 0
  const revision = useSyncExternalStore(
    (listener) => client.getQueryCache().subscribe(listener),
    readRevision,
    readRevision,
  )
  const query = useQuery({
    queryKey: [...queryKeys.outfits.recommendation(ownerId, selectedItemIds, targetCategory), revision],
    enabled: false,
    staleTime: 'static',
    gcTime: 24 * 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<OutfitRecommendation> => {
      if (readRevision() !== revision) throw new Error('옷장 정보가 변경됐어요. 다시 추천받아주세요.')
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

  /** 같은 결과·진행 요청은 재사용하고 새 조건만 조회한다. 계정·옷장이 바뀐 이전 버튼이면 false로 실행을 거절한다. */
  const loadRecommendation = () => {
    if (readRevision() !== revision || !ownerId || client.getQueryData<{ id: string }>(queryKeys.me)?.id !== ownerId
      || selectedItemIds.length === 0 || !targetCategory) return false
    if (!query.data && !query.isFetching) void query.refetch()
    return true
  }

  return { ...query, revision, loadRecommendation }
}
