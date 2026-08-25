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

export interface TodayRecommendationHistoryEntry {
  id: string
  createdAt: string
  date: string
  season: Season
  style: OutfitStyle
  variation: number
  recommendation: TodayOutfitRecommendation
}

const MAX_TODAY_RECOMMENDATION_HISTORY = 10
const TODAY_RECOMMENDATION_STORAGE_PREFIX =
  'closet:today-outfit-recommendation:v7'

function getStorageKey(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle,
) {
  return `${TODAY_RECOMMENDATION_STORAGE_PREFIX}:${viewerId}:${date}:${season}:${style}`
}

export function getTodayRecommendationItemKey(
  recommendation: TodayOutfitRecommendation,
) {
  return recommendation.items
    .map((item) => item.id)
    .sort()
    .join(':')
}

function isHistoryEntry(
  value: unknown,
  date: string,
  season: Season,
  style: OutfitStyle,
): value is TodayRecommendationHistoryEntry {
  if (!value || typeof value !== 'object') return false

  const entry = value as Partial<TodayRecommendationHistoryEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.createdAt === 'string' &&
    entry.date === date &&
    entry.season === season &&
    entry.style === style &&
    Number.isInteger(entry.variation) &&
    Boolean(entry.recommendation) &&
    entry.recommendation?.date === date &&
    entry.recommendation.season === season &&
    Array.isArray(entry.recommendation.items)
  )
}

export function readTodayRecommendationHistory(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle,
): TodayRecommendationHistoryEntry[] {
  try {
    const rawValue = window.localStorage.getItem(
      getStorageKey(viewerId, date, season, style),
    )
    if (!rawValue) return []

    const stored: unknown = JSON.parse(rawValue)
    if (!Array.isArray(stored)) return []

    return stored
      .filter((entry) => isHistoryEntry(entry, date, season, style))
      .slice(0, MAX_TODAY_RECOMMENDATION_HISTORY)
  } catch {
    return []
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
  const history = readTodayRecommendationHistory(
    viewerId,
    date,
    season,
    style,
  )
  const itemKey = getTodayRecommendationItemKey(recommendation)
  const existingEntry = history.find(
    (entry) => getTodayRecommendationItemKey(entry.recommendation) === itemKey,
  )
  const entry: TodayRecommendationHistoryEntry = {
    id:
      existingEntry?.id ??
      `${Date.now()}:${variation}:${itemKey || 'empty-recommendation'}`,
    createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
    date,
    season,
    style,
    variation,
    recommendation,
  }
  const nextHistory = [
    entry,
    ...history.filter(
      (historyEntry) =>
        getTodayRecommendationItemKey(historyEntry.recommendation) !== itemKey,
    ),
  ].slice(0, MAX_TODAY_RECOMMENDATION_HISTORY)

  try {
    window.localStorage.setItem(
      getStorageKey(viewerId, date, season, style),
      JSON.stringify(nextHistory),
    )
    return nextHistory
  } catch {
    return history
  }
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
