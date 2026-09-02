import type { Season, TodayOutfitRecommendation } from '@closet/types'
import type { OutfitStyle } from '../../../constants/styleOptions'

export interface TodayRecommendationHistoryEntry {
  id: string
  createdAt: string
  date: string
  season: Season
  style: OutfitStyle
  variation: number
  baseItemId?: string
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
  baseItemId?: string,
) {
  const scope = baseItemId !== undefined
    ? `:base:${encodeURIComponent(baseItemId)}`
    : ''
  return `${TODAY_RECOMMENDATION_STORAGE_PREFIX}:${viewerId}:${date}:${season}:${style}${scope}`
}

export function matchesTodayRecommendationBaseItem(
  recommendation: TodayOutfitRecommendation,
  baseItemId?: string,
) {
  return (
    baseItemId === undefined ||
    (Array.isArray(recommendation.items) &&
      recommendation.items.some((item) => item?.id === baseItemId))
  )
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
  baseItemId?: string,
): value is TodayRecommendationHistoryEntry {
  if (!value || typeof value !== 'object') return false

  const entry = value as Partial<TodayRecommendationHistoryEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.createdAt === 'string' &&
    entry.date === date &&
    entry.season === season &&
    entry.style === style &&
    entry.baseItemId === baseItemId &&
    Number.isInteger(entry.variation) &&
    Boolean(entry.recommendation) &&
    entry.recommendation?.date === date &&
    entry.recommendation.season === season &&
    entry.recommendation.style === style &&
    entry.recommendation.ready === true &&
    typeof entry.recommendation.headline === 'string' &&
    typeof entry.recommendation.summary === 'string' &&
    Array.isArray(entry.recommendation.reasons) &&
    entry.recommendation.reasons.every(
      (reason) => typeof reason === 'string',
    ) &&
    Array.isArray(entry.recommendation.items) &&
    entry.recommendation.items.length > 0 &&
    entry.recommendation.items.every(
      (item) => item && typeof item.id === 'string',
    ) &&
    matchesTodayRecommendationBaseItem(entry.recommendation, baseItemId)
  )
}

export function readTodayRecommendationHistory(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle,
  baseItemId?: string,
): TodayRecommendationHistoryEntry[] {
  try {
    const rawValue = window.localStorage.getItem(
      getStorageKey(viewerId, date, season, style, baseItemId),
    )
    if (!rawValue) return []

    const stored: unknown = JSON.parse(rawValue)
    if (!Array.isArray(stored)) return []

    return stored
      .filter((entry) =>
        isHistoryEntry(entry, date, season, style, baseItemId),
      )
      .slice(0, MAX_TODAY_RECOMMENDATION_HISTORY)
  } catch {
    return []
  }
}

function readRecentRecommendationHistory(
  viewerId: string,
  date: string,
  scope?: { baseItemId?: string },
): TodayRecommendationHistoryEntry[] {
  const storageKeyPrefix = `${TODAY_RECOMMENDATION_STORAGE_PREFIX}:${viewerId}:${date}:`
  const entries: TodayRecommendationHistoryEntry[] = []

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith(storageKeyPrefix)) continue

      let stored: unknown
      try {
        stored = JSON.parse(window.localStorage.getItem(key) ?? '')
      } catch {
        continue
      }
      if (!Array.isArray(stored)) continue

      stored.forEach((value) => {
        if (!value || typeof value !== 'object') return

        const entry = value as Partial<TodayRecommendationHistoryEntry>
        if (
          typeof entry.season !== 'string' ||
          typeof entry.style !== 'string' ||
          (entry.baseItemId !== undefined && typeof entry.baseItemId !== 'string') ||
          (scope !== undefined && entry.baseItemId !== scope.baseItemId) ||
          !isHistoryEntry(
            value,
            date,
            entry.season as Season,
            entry.style as OutfitStyle,
            entry.baseItemId,
          )
        ) {
          return
        }

        try {
          const expectedKey = getStorageKey(
            viewerId,
            date,
            value.season,
            value.style,
            value.baseItemId,
          )
          if (key !== expectedKey) return
        } catch {
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

export function readRecentTodayRecommendationHistory(
  viewerId: string,
  date: string,
  baseItemId?: string,
): TodayRecommendationHistoryEntry[] {
  return readRecentRecommendationHistory(viewerId, date, { baseItemId })
}

export function readAllRecentTodayRecommendationHistory(
  viewerId: string,
  date: string,
): TodayRecommendationHistoryEntry[] {
  return readRecentRecommendationHistory(viewerId, date)
}

export function storeTodayRecommendation(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle,
  variation: number,
  recommendation: TodayOutfitRecommendation,
  baseItemId?: string,
) {
  const history = readTodayRecommendationHistory(
    viewerId,
    date,
    season,
    style,
    baseItemId,
  )
  if (
    !recommendation.ready ||
    !Array.isArray(recommendation.items) ||
    recommendation.items.length === 0 ||
    !recommendation.items.every(
      (item) => item && typeof item.id === 'string',
    ) ||
    !matchesTodayRecommendationBaseItem(recommendation, baseItemId)
  ) {
    return history
  }
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
    ...(baseItemId !== undefined ? { baseItemId } : {}),
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
      getStorageKey(viewerId, date, season, style, baseItemId),
      JSON.stringify(nextHistory),
    )
    return nextHistory
  } catch {
    return history
  }
}
