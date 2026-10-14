import type { Season, TodayOutfitRecommendation } from '@closet/types'
import type { OutfitStyle } from '../../../constants/styleOptions'
import { isColorScheme, type ColorScheme } from '../data/colorSchemes'
import { normalizeRecommendationText } from './recommendationText'

export interface TodayRecommendationHistoryEntry {
  id: string
  createdAt: string
  date: string
  season: Season
  /** 새 추천은 null이며, 이전 기록의 스타일 이름은 표시·룩북 재열기·일정 저장에 보존하고 새 추천 조건에는 사용하지 않는다. */
  style: OutfitStyle | null
  /** 계절 다음에 선택한 색 조합. 필드가 없는 이전 기록은 자동으로 취급한다. */
  colorScheme?: ColorScheme
  variation: number
  baseItemId?: string
  recommendation: TodayOutfitRecommendation
}

const MAX_TODAY_RECOMMENDATION_HISTORY = 10
const TODAY_RECOMMENDATION_STORAGE_PREFIX =
  'closet:today-outfit-recommendation:v8'

/** 자동 색감은 이전 v8 저장 키를 유지하고, 다른 색감은 별도 구간을 붙여 기록을 분리한다. */
function getStorageKey(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle | null,
  colorScheme: ColorScheme,
  baseItemId?: string,
) {
  const colorScope = colorScheme === 'auto' ? '' : `:scheme:${colorScheme}`
  const scope = baseItemId !== undefined
    ? `:base:${encodeURIComponent(baseItemId)}`
    : ''
  return `${TODAY_RECOMMENDATION_STORAGE_PREFIX}:${viewerId}:${date}:${season}:${style ?? 'wardrobe'}${colorScope}${scope}`
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
  style: OutfitStyle | null,
  colorScheme: ColorScheme,
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
    (entry.colorScheme ?? 'auto') === colorScheme &&
    entry.baseItemId === baseItemId &&
    Number.isInteger(entry.variation) &&
    Boolean(entry.recommendation) &&
    entry.recommendation?.date === date &&
    entry.recommendation.season === season &&
    entry.recommendation.style === style &&
    entry.recommendation.ready === true &&
    (colorScheme === 'auto'
      ? entry.recommendation.colorSchemeApplied === undefined ||
        typeof entry.recommendation.colorSchemeApplied === 'boolean'
      : typeof entry.recommendation.colorSchemeApplied === 'boolean') &&
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

/** 같은 날짜·계절·스타일·기준 옷·색감의 유효한 추천을 읽는다. 오래된 자동 기록은 누락된 적용 여부를 true로 보완한다. */
export function readTodayRecommendationHistory(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle | null,
  baseItemId?: string,
  colorScheme: ColorScheme = 'auto',
): TodayRecommendationHistoryEntry[] {
  try {
    const rawValue = window.localStorage.getItem(
      getStorageKey(viewerId, date, season, style, colorScheme, baseItemId),
    )
    if (!rawValue) return []

    const stored: unknown = JSON.parse(rawValue)
    if (!Array.isArray(stored)) return []

    return stored
      .filter((entry) =>
        isHistoryEntry(entry, date, season, style, colorScheme, baseItemId),
      )
      .slice(0, MAX_TODAY_RECOMMENDATION_HISTORY)
      .map((entry) => ({
        ...entry,
        recommendation: normalizeRecommendationText({
          ...entry.recommendation,
          colorSchemeApplied: entry.recommendation.colorSchemeApplied ?? true,
        }),
      }))
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
          (entry.style !== null && typeof entry.style !== 'string') ||
          (entry.colorScheme !== undefined && !isColorScheme(entry.colorScheme)) ||
          (entry.baseItemId !== undefined && typeof entry.baseItemId !== 'string') ||
          (scope !== undefined && entry.baseItemId !== scope.baseItemId) ||
          !isHistoryEntry(
            value,
            date,
            entry.season as Season,
            entry.style as OutfitStyle | null,
            entry.colorScheme ?? 'auto',
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
            value.colorScheme ?? 'auto',
            value.baseItemId,
          )
          if (key !== expectedKey) return
        } catch {
          return
        }

        entries.push({
          ...value,
          recommendation: normalizeRecommendationText({
            ...value.recommendation,
            colorSchemeApplied: value.recommendation.colorSchemeApplied ?? true,
          }),
        })
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

/** 추천 조합을 색감별 최근 기록에 저장하고, 같은 색감의 동일 아이템 조합은 최신 설명으로 교체한다. */
export function storeTodayRecommendation(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle | null,
  variation: number,
  recommendation: TodayOutfitRecommendation,
  baseItemId?: string,
  colorScheme: ColorScheme = 'auto',
) {
  const history = readTodayRecommendationHistory(
    viewerId,
    date,
    season,
    style,
    baseItemId,
    colorScheme,
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
    ...(colorScheme !== 'auto' ? { colorScheme } : {}),
    variation,
    ...(baseItemId !== undefined ? { baseItemId } : {}),
    recommendation: normalizeRecommendationText(recommendation),
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
      getStorageKey(viewerId, date, season, style, colorScheme, baseItemId),
      JSON.stringify(nextHistory),
    )
    return nextHistory
  } catch {
    return history
  }
}
