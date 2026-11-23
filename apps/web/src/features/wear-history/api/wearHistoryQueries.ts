import { useInfiniteQuery } from '@tanstack/react-query'
import type { TemperatureWearHistoryInput, TemperatureWearRecord } from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { wardrobeItemFields } from '../../closet/api/wardrobeQueries'
import { toSavedOutfit, type OutfitPayload } from '../../lookbook/api/lookbookQueries'
import { useMeQuery } from '../../settings/api/profileQueries'

interface WearHistoryPagePayload {
  items: Array<{ id: string; matchingDate: string; outfit: OutfitPayload; records: TemperatureWearRecord[] }>
  totalCount: number
  hasNextPage: boolean
  nextCursor: string | null
}

/** 계정·기온·체감별 착용을 페이지로 읽는다. planner 키 아래 두어 착용 확인·취소·체감 변경 시 함께 갱신한다. */
export function useTemperatureWearHistory(input: Omit<TemperatureWearHistoryInput, 'cursor'>) {
  const me = useMeQuery()
  return useInfiniteQuery({
    queryKey: ['planner', 'temperature-wear-history', me.data?.id, input],
    enabled: Boolean(me.data?.id),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const data = await graphqlRequest<{ temperatureWearHistory: WearHistoryPagePayload }>(`
        query TemperatureWearHistory($input: TemperatureWearHistoryInput) {
          temperatureWearHistory(input: $input) {
            totalCount hasNextPage nextCursor
            items {
              id matchingDate records { date temperatureC feeling }
              outfit {
                id name style seasons createdAt
                items { wardrobeItemId layerOrder slot isBaseLayer wardrobeItem { ${wardrobeItemFields} } }
                generations { status imageAsset { deliveryUrl } }
              }
            }
          }
        }
      `, { input: { ...input, cursor: pageParam } }, signal)
      return { ...data.temperatureWearHistory, items: data.temperatureWearHistory.items.map(group => ({ ...group, outfit: toSavedOutfit(group.outfit) })) }
    },
    getNextPageParam: page => page.hasNextPage ? page.nextCursor : null,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}
