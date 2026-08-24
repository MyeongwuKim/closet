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

interface TodayOutfitRecommendationPayload
  extends Omit<TodayOutfitRecommendation, 'items'> {
  items: WardrobeItemPayload[]
}

interface StoredTodayRecommendation {
  date: string
  season: Season
  style: OutfitStyle
  variation: number
  recommendation: TodayOutfitRecommendation
}

const TODAY_RECOMMENDATION_STORAGE_PREFIX =
  'closet:today-outfit-recommendation:v4'

function getStorageKey(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle,
) {
  return `${TODAY_RECOMMENDATION_STORAGE_PREFIX}:${viewerId}:${date}:${season}:${style}`
}

export function readStoredTodayRecommendation(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle,
): StoredTodayRecommendation | null {
  try {
    const rawValue = window.localStorage.getItem(
      getStorageKey(viewerId, date, season, style),
    )
    if (!rawValue) return null

    const stored = JSON.parse(rawValue) as Partial<StoredTodayRecommendation>
    if (
      stored.date !== date ||
      stored.season !== season ||
      stored.style !== style ||
      !Number.isInteger(stored.variation) ||
      !stored.recommendation ||
      stored.recommendation.date !== date ||
      stored.recommendation.season !== season
    ) {
      return null
    }
    return stored as StoredTodayRecommendation
  } catch {
    return null
  }
}

export function storeTodayRecommendation(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle,
  variation: number,
  recommendation: TodayOutfitRecommendation,
) {
  window.localStorage.setItem(
    getStorageKey(viewerId, date, season, style),
    JSON.stringify({ date, season, style, variation, recommendation }),
  )
}

export function useTodayOutfitRecommendationQuery(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle,
  variation: number,
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
        { input: { date, season, style, variation } },
        signal,
      )

      return {
        ...data.todayOutfitRecommendation,
        items: data.todayOutfitRecommendation.items.map(toWardrobeItem),
      }
    },
  })
}
