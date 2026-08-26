import type { Season, TodayOutfitRecommendation } from '@closet/types'
import type { OutfitStyle } from '../../../constants/styleOptions'

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

export function readRecentTodayRecommendationHistory(
  viewerId: string,
  date: string,
): TodayRecommendationHistoryEntry[] {
  const storageKeyPrefix = `${TODAY_RECOMMENDATION_STORAGE_PREFIX}:${viewerId}:${date}:`
  const entries: TodayRecommendationHistoryEntry[] = []

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith(storageKeyPrefix)) continue

      const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? '')
      if (!Array.isArray(stored)) continue

      stored.forEach((value) => {
        if (!value || typeof value !== 'object') return

        const entry = value as Partial<TodayRecommendationHistoryEntry>
        if (
          typeof entry.season !== 'string' ||
          typeof entry.style !== 'string' ||
          !isHistoryEntry(
            value,
            date,
            entry.season as Season,
            entry.style as OutfitStyle,
          )
        ) {
          return
        }

        entries.push(value)
      })
    }
  } catch {
    return []
  }

  return entries
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, MAX_TODAY_RECOMMENDATION_HISTORY)
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
