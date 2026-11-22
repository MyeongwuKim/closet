/**
 * 용도:
 * 오늘·내일의 코디 추천 조회, 재추천, 최근 착용 확인과 플래너 저장을 관리한다.
 *
 * 동작 방식:
 * 계절·색감·날씨를 포함해 추천을 요청하고 사용자가 확정하면
 * 선택한 아이템과 추천 당시 기온을 플래너에 함께 저장한다.
 */
import { useState } from 'react'
import { canReuseWardrobeRecommendation } from '@closet/types/wardrobe-preferences'
import { useWardrobeItemsQuery } from '../../closet/api/wardrobeQueries'
import { getWardrobePreferenceKey } from '../../closet/utils/wardrobePreferences'
import type {
  OutfitPreview,
  Season,
  WardrobeItem,
  WeatherSnapshot,
} from '@closet/types'
import { useUiStore } from '../../../stores/useUiStore'
import { usePlannerWeekQuery, useSetDirectPlannerEntryMutation } from '../api/plannerQueries'
import {
  readAllRecentTodayRecommendationHistory,
  readTodayRecommendationHistory,
  useTodayOutfitRecommendationQuery,
} from '../api/todayOutfitQueries'
import { formatDateOnly, getCurrentWeekStart } from '../data/weeklyPlan'
import { usePlanStore } from '../stores/usePlanStore'
import type { ColorScheme } from '../data/colorSchemes'
import { useRecentWearReminder } from './useRecentWearReminder'
import { useThermalRecommendationContextQuery } from '../api/thermalRecommendationQueries'
import { recommendationDayLabels, type RecommendationMode } from '../components/today-outfit-recommendation/recommendationFlow'
import { getThermalRecommendationMean, matchesThermalRecommendationContext, matchesTodayRecommendationWeather } from '../utils/thermalRecommendationContext'
import {
  formatRecommendationHeadline,
  getRecommendationCoreItemIds,
  getRefreshExcludedOuterItemIds,
} from '../utils/todayOutfitRecommendation'

interface UseTodayOutfitRecommendationResultOptions {
  viewerId: string
  date: string
  season: Season
  colorScheme: ColorScheme
  baseItemId?: string
  hasScheduledOutfit: boolean
  mode: RecommendationMode
  weather?: WeatherSnapshot | null
  onApplied?: () => void
}

export function useTodayOutfitRecommendationResult({
  viewerId,
  date,
  season,
  colorScheme,
  baseItemId,
  hasScheduledOutfit,
  mode,
  weather,
  onApplied,
}: UseTodayOutfitRecommendationResultOptions) {
  const pushToast = useUiStore((state) => state.pushToast)
  const hydrateEntries = usePlanStore((state) => state.hydrateEntries)
  const [initialHistory] = useState(() =>
    readTodayRecommendationHistory(viewerId, date, season, null, baseItemId, colorScheme),
  )
  const wardrobeQuery = useWardrobeItemsQuery(true, { refetchOnMount: 'always' })
  const preferenceKey = getWardrobePreferenceKey(wardrobeQuery.data ?? [])
  const wardrobeReady = wardrobeQuery.isSuccess && wardrobeQuery.isFetchedAfterMount && !wardrobeQuery.isFetching
  // 이 화면을 연 클릭이 허용한 최초 설정만 자동 실행한다. 이후 설정 변경은 재시도 버튼으로 승인한다.
  const [allowedPreferenceKey, setAllowedPreferenceKey] = useState<string | null>(null)
  if (wardrobeReady && allowedPreferenceKey === null) setAllowedPreferenceKey(preferenceKey)
  const preferencesChanged = allowedPreferenceKey !== null && allowedPreferenceKey !== preferenceKey
  // 최초 무료 확인 뒤의 같은 설정 재조회는 추천을 disable→enable 하지 않는다.
  // stale인 유료 쿼리가 재활성화되거나 상세 편집 상태가 사라지는 것을 막는다.
  const hasWardrobeContext = allowedPreferenceKey !== null
  const thermalQuery = useThermalRecommendationContextQuery(viewerId, date, weather)
  const requiresThermalContext = getThermalRecommendationMean(weather) !== null
  const isThermalContextReady = !requiresThermalContext ||
    (thermalQuery.isSuccess && thermalQuery.isFetchedAfterMount && !thermalQuery.isFetching)
  const thermalContext = requiresThermalContext ? thermalQuery.data : undefined
  const thermalRevision = thermalContext?.revision
  const previousDay = new Date(`${date}T00:00:00`)
  previousDay.setDate(previousDay.getDate() - 1)
  const previousDate = formatDateOnly(previousDay)
  const previousWeekQuery = usePlannerWeekQuery(getCurrentWeekStart(previousDay), Boolean(viewerId))
  const previousDayScope = JSON.stringify([viewerId, previousDate])
  const [previousDaySnapshot, setPreviousDaySnapshot] = useState<{ scope: string; outfits: string[][]; hasPlan: boolean } | null>(null)
  const previousDayContext = previousDaySnapshot?.scope === previousDayScope ? previousDaySnapshot : null
  const previousDayOutfits = previousDayContext?.outfits ?? null
  // 새로 연 추천에서 전날 플래너와 이 기기의 기록을 한 번 확인한다. 이후 일정 갱신이 유료 추천을 다시 시작하지 않는다.
  if (!previousDayOutfits && previousWeekQuery.isSuccess && !previousWeekQuery.isFetching && hasWardrobeContext) {
    const planned = previousWeekQuery.data.find((entry) => entry.date === previousDate)
    const recorded = readAllRecentTodayRecommendationHistory(viewerId, previousDate)
    const outfits = recorded.map((entry) => getRecommendationCoreItemIds(entry.recommendation.items))
    const hasPlan = Boolean(planned?.itemIds.length)
    if (planned && hasPlan) {
      const items = planned.outfitItems?.length ? planned.outfitItems : (wardrobeQuery.data ?? []).filter((item) => planned.itemIds.includes(item.id))
      outfits.unshift(getRecommendationCoreItemIds(items))
    }
    const uniqueOutfits = new Map(outfits.filter((ids) => ids.length > 0).map((ids) => [JSON.stringify(ids), ids]))
    setPreviousDaySnapshot({ scope: previousDayScope, outfits: [...uniqueOutfits.keys()].sort().map((key) => uniqueOutfits.get(key)!), hasPlan })
  }
  const storedRecommendation = isThermalContextReady && hasWardrobeContext && !preferencesChanged && previousDayOutfits ? initialHistory.find((entry) =>
    !previousDayOutfits.some((ids) => JSON.stringify(ids) === JSON.stringify(getRecommendationCoreItemIds(entry.recommendation.items))) &&
    matchesTodayRecommendationWeather(entry.recommendation, weather) &&
    matchesThermalRecommendationContext(entry.recommendation, thermalRevision) &&
    canReuseWardrobeRecommendation(entry.recommendation.items, wardrobeQuery.data ?? [], date, baseItemId ? [baseItemId] : []),
  ) ?? null : null
  const scope = JSON.stringify([date, season, colorScheme, baseItemId, weather, thermalRevision, preferenceKey])
  /** 재추천 조건은 체감 근거별로 구분하며 새 근거에는 이전 아우터 제외 조건을 이어 붙이지 않는다. */
  const [refresh, setRefresh] = useState<{
    scope: string; variation: number; excludedOuterItemIds: string[]; sourceItems: WardrobeItem[]
  } | null>(null)
  const variation = refresh?.scope === scope ? refresh.variation : storedRecommendation?.variation ?? 0
  const excludedOuterItemIds = refresh?.scope === scope ? refresh.excludedOuterItemIds : []
  const refreshSourceItems = refresh?.scope === scope ? refresh.sourceItems : []
  const query = useTodayOutfitRecommendationQuery(
    viewerId,
    date,
    season,
    colorScheme,
    variation,
    excludedOuterItemIds,
    {
      baseItemId,
      weather,
      thermalContext,
      enabled: isThermalContextReady && hasWardrobeContext && !preferencesChanged && previousDayOutfits !== null,
      previousDayOutfits: previousDayOutfits ?? undefined,
      wardrobe: wardrobeQuery.data,
      preferenceKey,
      initialData:
        storedRecommendation?.variation === variation &&
        matchesTodayRecommendationWeather(storedRecommendation.recommendation, weather)
          ? storedRecommendation.recommendation
          : undefined,
    },
  )
  const hasContextError = (requiresThermalContext && thermalQuery.isError) || wardrobeQuery.isError || preferencesChanged || (previousDayOutfits === null && previousWeekQuery.isError)
  const isWaitingForContext = (!hasWardrobeContext || (requiresThermalContext && !isThermalContextReady) || previousDayOutfits === null) && !hasContextError
  // 무료 근거 확인 중에는 이전 추천을 숨기고 기존 화면의 로딩·재시도 표시를 사용한다.
  const recommendationQuery = {
    ...query,
    data: !hasContextError && !isWaitingForContext ? query.data : undefined,
    error: preferencesChanged ? new Error('옷장 설정이 바뀌었어요. 다시 추천받아주세요.') : wardrobeQuery.error ?? (previousDayOutfits === null ? previousWeekQuery.error : null) ?? (hasContextError ? thermalQuery.error : query.error),
    isError: hasContextError || (!isWaitingForContext && query.isError),
    isPending: hasContextError ? false : isWaitingForContext || query.isPending,
    isLoading: !hasContextError && (isWaitingForContext || query.isLoading),
    isFetching: wardrobeQuery.isFetching || (previousDayOutfits === null && previousWeekQuery.isFetching) || (requiresThermalContext && thermalQuery.isFetching) || query.isFetching,
    isSuccess: !hasContextError && !isWaitingForContext && query.isSuccess,
    status: hasContextError ? 'error' as const : isWaitingForContext ? 'pending' as const : query.status,
    /** 재시도에서는 체감 근거부터 다시 읽고, 같은 버전일 때만 현재 추천을 재요청한다. 새 버전은 새 키가 자동 조회한다. */
    refetch: async () => {
      const wardrobe = await wardrobeQuery.refetch()
      if (!wardrobe.data || wardrobe.error) return wardrobe
      if (!previousDayOutfits) return previousWeekQuery.refetch()
      const freshPreferenceKey = getWardrobePreferenceKey(wardrobe.data)
      if (freshPreferenceKey !== allowedPreferenceKey) {
        setAllowedPreferenceKey(freshPreferenceKey)
        return wardrobe
      }
      if (requiresThermalContext) {
        const result = await thermalQuery.refetch()
        if (!result.data || result.error || result.data.revision !== thermalRevision) return result
      }
      return query.refetch()
    },
  }
  const setDirectPlannerEntry = useSetDirectPlannerEntryMutation()
  const { confirmRecentWear, isCheckingRecentWear } =
    useRecentWearReminder()
  const queriedRecommendation = recommendationQuery.data
  const isBaseItemMissing = Boolean(
    baseItemId &&
      queriedRecommendation?.ready &&
      !queriedRecommendation.items.some((item) => item.id === baseItemId),
  )
  const recommendation = isBaseItemMissing || !queriedRecommendation
    ? undefined
    : mode === 'tomorrow' && formatRecommendationHeadline(queriedRecommendation.headline) === '오늘은 이 조합으로 입어보세요'
      ? { ...queriedRecommendation, headline: '이 조합으로 입어보세요' }
      : queriedRecommendation
  const errorMessage =
    recommendationQuery.error instanceof Error
      ? recommendationQuery.error.message
      : isBaseItemMissing
        ? '선택한 옷이 추천에 포함되지 않았어요. 다시 추천받아 주세요.'
        : '잠시 후 다시 시도해주세요. 문제가 계속되면 연결 상태를 확인해주세요.'

  // 이전 아우터를 제외한 결과가 하나여도 제외 조건을 바꾸면 다른 옷을 고를 수 있다.
  // 제외 조건이 없는 전체 후보가 하나일 때만 재추천을 막는다.
  const hasOtherCombination = recommendation?.combinationCount !== 1 || excludedOuterItemIds.length > 0

  /** 다른 후보가 있을 때 직전 아우터를 제외하고 다음 조합을 조회한다. 기준 아이템은 유지한다. */
  const requestAnotherRecommendation = () => {
    if (recommendationQuery.isFetching || !hasOtherCombination) return

    const currentItems = recommendation?.items ?? []
    setRefresh({
      scope, variation: (variation + 1) % 21,
      excludedOuterItemIds: getRefreshExcludedOuterItemIds(currentItems, baseItemId),
      sourceItems: currentItems,
    })
  }

  /** 화면을 열 때 선택한 날짜에 추천을 저장하고, 성공한 경우에만 플래너에 적용 완료를 알린다. */
  const applyRecommendation = async (
    selectedItems: WardrobeItem[] = recommendation?.items ?? [],
    previewImage?: OutfitPreview,
  ) => {
    if (!recommendation?.ready) return false

    const confirmed = await confirmRecentWear({
      itemIds: selectedItems.map((item) => item.id),
      targetDate: date,
      confirmLabel: hasScheduledOutfit ? '그래도 변경' : '그래도 추가',
      cancelLabel: '추천 코디로 돌아가기',
    })
    if (!confirmed) return false

    try {
      const nextEntries = await setDirectPlannerEntry.mutateAsync({
        weekStartsOn: getCurrentWeekStart(new Date(`${date}T00:00:00`)),
        date,
        itemIds: selectedItems.map((item) => item.id),
        previewImage,
        recommendationName: formatRecommendationHeadline(
          recommendation.headline,
        ),
        recommendationStyle: '옷장 추천',
        weatherSummary: recommendation.weather?.summary,
        temperatureC: recommendation.weather?.temperatureC,
      })
      hydrateEntries(nextEntries)
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '추천 코디를 담지 못했어요.',
        'error',
      )
      return false
    }

    const dayLabel = recommendationDayLabels[mode]
    pushToast(
      hasScheduledOutfit
        ? `${dayLabel}의 코디를 추천 조합으로 바꿨어요.`
        : `추천 코디를 ${dayLabel} 일정에 담았어요.`,
      'success',
    )
    onApplied?.()
    return true
  }

  return {
    recommendation,
    previousDate,
    hasPreviousDayPlan: previousDayContext?.hasPlan ?? false,
    recommendationQuery,
    refreshSourceItems,
    hasOtherCombination,
    errorMessage,
    isSaving: isCheckingRecentWear || setDirectPlannerEntry.isPending,
    actions: {
      requestAnotherRecommendation,
      applyRecommendation,
    },
  }
}
