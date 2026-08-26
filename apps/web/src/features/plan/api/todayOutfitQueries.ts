import { useQuery } from '@tanstack/react-query'
import type { Season, TodayOutfitRecommendation } from '@closet/types'
import type { OutfitStyle } from '../../../constants/styleOptions'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import {
  toWardrobeItem,
  wardrobeItemFields,
  type WardrobeItemPayload,
} from '../../closet/api/wardrobeQueries'
import { storeTodayRecommendation } from '../utils/todayRecommendationHistory'

export {
  getTodayRecommendationItemKey,
  readRecentTodayRecommendationHistory,
  readTodayRecommendationHistory,
  type TodayRecommendationHistoryEntry,
} from '../utils/todayRecommendationHistory'

interface TodayOutfitRecommendationPayload
  extends Omit<TodayOutfitRecommendation, 'items'> {
  items: WardrobeItemPayload[]
}

export function useTodayOutfitRecommendationQuery(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle,
  variation: number,
  excludedOuterItemIds: string[],
  initialData?: TodayOutfitRecommendation,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.planner.todayRecommendation(
      viewerId,
      date,
      season,
      style,
      variation,
      excludedOuterItemIds,
    ),
    enabled: enabled && Boolean(viewerId) && Boolean(date),
    initialData,
    placeholderData: (previousData) => previousData,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }): Promise<TodayOutfitRecommendation> => {
      const data = await graphqlRequest<
        { todayOutfitRecommendation: TodayOutfitRecommendationPayload },
        {
          input: {
            date: string
            season: Season
            style: OutfitStyle
            variation: number
            excludedOuterItemIds: string[]
          }
        }
      >(
        `
          query TodayOutfitRecommendation(
            $input: TodayOutfitRecommendationInput!
          ) {
            todayOutfitRecommendation(input: $input) {
              date season ready headline summary style reasons
              profileSummary model source
              items { ${wardrobeItemFields} }
            }
          }
        `,
        {
          input: {
            date,
            season,
            style,
            variation,
            excludedOuterItemIds,
          },
        },
        signal,
      )

      const recommendation = {
        ...data.todayOutfitRecommendation,
        items: data.todayOutfitRecommendation.items.map(toWardrobeItem),
      }
      if (recommendation.ready && recommendation.items.length > 0) {
        storeTodayRecommendation(
          viewerId,
          date,
          season,
          style,
          variation,
          recommendation,
        )
      }
      return recommendation
    },
  })
}
