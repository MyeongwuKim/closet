import { useQuery } from '@tanstack/react-query'
import type { WardrobeRediscovery } from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { toWardrobeItem, wardrobeItemFields, type WardrobeItemPayload } from './wardrobeQueries'

/** 한국 날짜·사용자별로 오늘의 하이라이트를 캐시한다. 전체 옷장의 후보 선정과 당일 고정은 서버가 담당한다. */
export function useWardrobeRediscoveryQuery(viewerId: string | null, day: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.wardrobe.rediscovery(viewerId, day),
    enabled: Boolean(viewerId) && enabled,
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<WardrobeRediscovery> => {
      const data = await graphqlRequest<{ wardrobeRediscovery: {
        day: string
        items: Array<Omit<WardrobeRediscovery['items'][number], 'item'> & { item: WardrobeItemPayload }>
      } }>(`query WardrobeRediscovery {
        wardrobeRediscovery { day items { reason daysSinceLastWorn item { ${wardrobeItemFields} } } }
      }`, undefined, signal)
      return { ...data.wardrobeRediscovery, items: data.wardrobeRediscovery.items.map((entry) => ({ ...entry, item: toWardrobeItem(entry.item) })) }
    },
  })
}

/** 실제 보인 카드의 ID와 선정일을 서버에 확인한다. 옷 정보와 착용 기록은 변경하지 않는다. */
export async function markWardrobeRediscoverySeen(day: string, itemIds: string[], signal: AbortSignal) {
  await graphqlRequest(`mutation MarkWardrobeRediscoverySeen($day: String!, $itemIds: [ID!]!) {
    markWardrobeRediscoverySeen(day: $day, itemIds: $itemIds)
  }`, { day, itemIds }, signal)
}
