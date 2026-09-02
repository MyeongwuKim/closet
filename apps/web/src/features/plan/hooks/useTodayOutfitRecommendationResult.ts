/**
 * 용도:
 * 오늘의 코디 추천 조회, 재추천, 최근 착용 확인과 플래너 저장을 관리한다.
 *
 * 동작 방식:
 * 날씨를 포함해 추천을 요청하고 사용자가 확정하면
 * 선택한 아이템과 추천 당시 기온을 플래너에 함께 저장한다.
 */
import { useState } from 'react'
import type {
  OutfitPreview,
  Season,
  WardrobeItem,
  WeatherSnapshot,
} from '@closet/types'
import type { OutfitStyle } from '../../../constants/styleOptions'
import { GraphqlRequestError } from '../../../lib/graphql'
import { useUiStore } from '../../../stores/useUiStore'
import { useSetDirectPlannerEntryMutation } from '../api/plannerQueries'
import {
  readTodayRecommendationHistory,
  useTodayOutfitRecommendationQuery,
} from '../api/todayOutfitQueries'
import { getCurrentWeekStart } from '../data/weeklyPlan'
import { usePlanStore } from '../stores/usePlanStore'
import { useRecentWearReminder } from './useRecentWearReminder'
import {
  formatRecommendationHeadline,
  getRefreshExcludedOuterItemIds,
} from '../utils/todayOutfitRecommendation'

interface UseTodayOutfitRecommendationResultOptions {
  viewerId: string
  date: string
  season: Season
  style: OutfitStyle
  baseItemId?: string
  hasTodayOutfit: boolean
  weather?: WeatherSnapshot | null
}

export function useTodayOutfitRecommendationResult({
  viewerId,
  date,
  season,
  style,
  baseItemId,
  hasTodayOutfit,
  weather,
}: UseTodayOutfitRecommendationResultOptions) {
  const pushToast = useUiStore((state) => state.pushToast)
  const hydrateEntries = usePlanStore((state) => state.hydrateEntries)
  const [initialHistory] = useState(() =>
    readTodayRecommendationHistory(viewerId, date, season, style, baseItemId),
  )
  const storedRecommendation = initialHistory[0] ?? null
  const [variation, setVariation] = useState(
    storedRecommendation?.variation ?? 0,
  )
  const [excludedOuterItemIds, setExcludedOuterItemIds] = useState<string[]>([])
  const [refreshSourceItems, setRefreshSourceItems] = useState<WardrobeItem[]>([])
  const recommendationQuery = useTodayOutfitRecommendationQuery(
    viewerId,
    date,
    season,
    style,
    variation,
    excludedOuterItemIds,
    {
      baseItemId,
      weather,
      initialData:
        storedRecommendation?.variation === variation &&
        (weather
          ? storedRecommendation.recommendation.weather?.date === weather.date &&
            storedRecommendation.recommendation.weather.temperatureC ===
              weather.temperatureC &&
            storedRecommendation.recommendation.weather.weatherCode ===
              weather.weatherCode
          : !storedRecommendation?.recommendation.weather)
          ? storedRecommendation.recommendation
          : undefined,
    },
  )
  const setDirectPlannerEntry = useSetDirectPlannerEntryMutation()
  const { confirmRecentWear, isCheckingRecentWear } =
    useRecentWearReminder()
  const queriedRecommendation = recommendationQuery.data
  const isBaseItemMissing = Boolean(
    baseItemId &&
      queriedRecommendation?.ready &&
      !queriedRecommendation.items.some((item) => item.id === baseItemId),
  )
  const recommendation = isBaseItemMissing ? undefined : queriedRecommendation
  const errorMessage =
    recommendationQuery.error instanceof GraphqlRequestError
      ? recommendationQuery.error.message
      : isBaseItemMissing
        ? '선택한 옷이 추천에 포함되지 않았어요. 다시 추천받아 주세요.'
        : '잠시 후 다시 시도해 주세요. 문제가 계속되면 연결 상태를 확인해 주세요.'

  const requestAnotherRecommendation = () => {
    if (recommendationQuery.isFetching) return

    const currentItems = recommendation?.items ?? []
    setExcludedOuterItemIds(
      getRefreshExcludedOuterItemIds(currentItems, baseItemId),
    )
    setRefreshSourceItems(currentItems)
    setVariation((current) => (current + 1) % 21)
  }

  const applyTodayOutfit = async (
    selectedItems: WardrobeItem[] = recommendation?.items ?? [],
    previewImage?: OutfitPreview,
  ) => {
    if (!recommendation?.ready) return false

    const confirmed = await confirmRecentWear({
      itemIds: selectedItems.map((item) => item.id),
      targetDate: date,
      confirmLabel: hasTodayOutfit ? '그래도 변경' : '그래도 추가',
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
        recommendationStyle: style,
        weatherSummary: recommendation.weather?.summary,
        temperatureC: recommendation.weather?.temperatureC,
      })
      hydrateEntries(nextEntries)
      pushToast(
        hasTodayOutfit
          ? '오늘의 코디를 추천 조합으로 바꿨어요.'
          : '추천 코디를 오늘 일정에 담았어요.',
        'success',
      )
      return true
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '추천 코디를 담지 못했어요.',
        'error',
      )
      return false
    }
  }

  return {
    recommendation,
    recommendationQuery,
    refreshSourceItems,
    errorMessage,
    isSaving: isCheckingRecentWear || setDirectPlannerEntry.isPending,
    actions: {
      requestAnotherRecommendation,
      applyTodayOutfit,
    },
  }
}
