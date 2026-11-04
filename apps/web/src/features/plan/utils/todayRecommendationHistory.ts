import type { Season, TodayOutfitRecommendation } from '@closet/types'
import type { OutfitStyle } from '../../../constants/styleOptions'
import { isColorScheme, type ColorScheme } from '../data/colorSchemes'
import { normalizeRecommendationText } from './recommendationText'
import { OUTFIT_COLOR_RULES_VERSION } from '@closet/types/outfit-colors'
import { isThermalRecommendationContext, matchesThermalRecommendationContext } from './thermalRecommendationContext'

export interface TodayRecommendationHistoryEntry {
  id: string
  createdAt: string
  date: string
  season: Season
  /** 새 추천은 null이며, 이전 기록의 스타일 이름은 표시·룩북 재열기·일정 저장에 보존하고 새 추천 조건에는 사용하지 않는다. */
  style: OutfitStyle | null
  /** 계절 다음에 선택한 색 조합. 필드가 없는 이전 기록은 자동으로 취급한다. */
  colorScheme?: ColorScheme
  /** 이전 결과는 기록으로 보존하되 새 추천의 초기 캐시로 재사용하지 않는다. */
  colorRulesVersion?: string
  variation: number
  baseItemId?: string
  recommendation: TodayOutfitRecommendation
}

const MAX_TODAY_RECOMMENDATION_HISTORY = 10
const TODAY_RECOMMENDATION_STORAGE_PREFIX =
  'closet:today-outfit-recommendation:v8'

/** 날짜·색감·기준 옷·판정 버전으로 키를 나눈다. null 버전은 보존된 이전 기록을 조회할 때만 사용한다. */
function getStorageKey(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle | null,
  colorScheme: ColorScheme,
  baseItemId?: string,
  colorRulesVersion: string | null = OUTFIT_COLOR_RULES_VERSION,
) {
  const colorScope = colorScheme === 'auto' ? '' : `:scheme:${colorScheme}`
  const scope = baseItemId !== undefined
    ? `:base:${encodeURIComponent(baseItemId)}`
    : ''
  const versionScope = colorRulesVersion ? `:color-rules:${colorRulesVersion}` : ''
  return `${TODAY_RECOMMENDATION_STORAGE_PREFIX}:${viewerId}:${date}:${season}:${style ?? 'wardrobe'}${colorScope}${scope}${versionScope}`
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
    (entry.recommendation.thermalContext == null || isThermalRecommendationContext(entry.recommendation.thermalContext)) &&
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

/** 같은 날짜·조건과 현재 색 판정 버전의 추천을 읽는다. 체감 버전을 전달하면 해당 근거의 결과만 반환하며 이전 기록 원본은 보존한다. */
export function readTodayRecommendationHistory(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle | null,
  baseItemId?: string,
  colorScheme: ColorScheme = 'auto',
  thermalContextRevision?: string,
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
        isHistoryEntry(entry, date, season, style, colorScheme, baseItemId) &&
        entry.colorRulesVersion === OUTFIT_COLOR_RULES_VERSION &&
        (thermalContextRevision === undefined || matchesThermalRecommendationContext(entry.recommendation, thermalContextRevision)),
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
            entry.colorRulesVersion ?? null,
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

/** 추천 조합과 체감 근거를 색감별 최근 기록에 저장한다. 같은 아이템·체감 버전은 최신 설명으로 교체하며 다른 버전의 결과는 과거 기록으로 남긴다. */
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
    (recommendation.thermalContext != null && !isThermalRecommendationContext(recommendation.thermalContext)) ||
    !matchesTodayRecommendationBaseItem(recommendation, baseItemId)
  ) {
    return history
  }
  const itemKey = getTodayRecommendationItemKey(recommendation)
  const thermalRevision = recommendation.thermalContext?.revision
  const isSameResult = (entry: TodayRecommendationHistoryEntry) =>
    getTodayRecommendationItemKey(entry.recommendation) === itemKey &&
    entry.recommendation.thermalContext?.revision === thermalRevision
  const existingEntry = history.find(
    isSameResult,
  )
  const entry: TodayRecommendationHistoryEntry = {
    id:
      existingEntry?.id ??
      `${Date.now()}:${variation}:${itemKey || 'empty-recommendation'}${thermalRevision ? `:thermal:${encodeURIComponent(thermalRevision)}` : ''}`,
    createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
    date,
    season,
    style,
    ...(colorScheme !== 'auto' ? { colorScheme } : {}),
    variation,
    colorRulesVersion: OUTFIT_COLOR_RULES_VERSION,
    ...(baseItemId !== undefined ? { baseItemId } : {}),
    recommendation: normalizeRecommendationText(recommendation),
  }
  const nextHistory = [
    entry,
    ...history.filter(
      (historyEntry) =>
        !isSameResult(historyEntry),
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
