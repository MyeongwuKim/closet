import { useState } from 'react'
import type { OutfitPreview, WardrobeItem } from '@closet/types'
import { GraphqlRequestError } from '../../../lib/graphql'
import { useUiStore } from '../../../stores/useUiStore'
import { useWardrobeItemsQuery } from '../../closet/api/wardrobeQueries'
import { useMeQuery } from '../../settings/api/profileQueries'
import {
  usePlannerWeekQuery,
  useSetDirectPlannerEntryMutation,
} from '../api/plannerQueries'
import {
  readAllRecentTodayRecommendationHistory,
  readRecentTodayRecommendationHistory,
  type TodayRecommendationHistoryEntry,
} from '../api/todayOutfitQueries'
import { getCurrentWeekStart } from '../data/weeklyPlan'
import { usePlanStore } from '../stores/usePlanStore'
import { useRecentWearReminder } from './useRecentWearReminder'

interface RecommendationHistoryOptions {
  date: string
  baseItemId?: string
  scope?: 'all' | 'current'
}

function getHistoryEntryKey(entry: TodayRecommendationHistoryEntry) {
  return `${entry.baseItemId ?? 'all'}:${entry.season}:${entry.style}:${entry.id}`
}

export function useRecommendationHistory({
  date,
  baseItemId,
  scope = 'current',
}: RecommendationHistoryOptions) {
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null)
  const meQuery = useMeQuery()
  const wardrobeQuery = useWardrobeItemsQuery()
  const weekStartsOn = getCurrentWeekStart(new Date(`${date}T00:00:00`))
  const plannerWeekQuery = usePlannerWeekQuery(weekStartsOn)
  const pushToast = useUiStore((state) => state.pushToast)
  const hydrateEntries = usePlanStore((state) => state.hydrateEntries)
  const setDirectPlannerEntry = useSetDirectPlannerEntryMutation()
  const { confirmRecentWear, isCheckingRecentWear } =
    useRecentWearReminder()
  const hasTodayOutfit = Boolean(
    plannerWeekQuery.data?.find((entry) => entry.date === date)?.itemIds.length,
  )
  const closetItems = wardrobeQuery.data ?? []
  const currentItemIds = new Set(closetItems.map((item) => item.id))
  const storedEntries = meQuery.data
    ? scope === 'all'
      ? readAllRecentTodayRecommendationHistory(meQuery.data.id, date)
      : readRecentTodayRecommendationHistory(meQuery.data.id, date, baseItemId)
    : []
  const entries = wardrobeQuery.data
    ? storedEntries.filter((entry) =>
        entry.recommendation.items.every((item) => currentItemIds.has(item.id)),
      )
    : []
  const selectedEntry =
    entries.find((entry) => getHistoryEntryKey(entry) === selectedEntryKey) ?? null
  const isFetching =
    meQuery.isFetching || wardrobeQuery.isFetching || plannerWeekQuery.isFetching
  const isLoading =
    meQuery.isPending ||
    wardrobeQuery.isPending ||
    plannerWeekQuery.isPending ||
    (entries.length === 0 && isFetching)
  const error = meQuery.error ?? wardrobeQuery.error ?? plannerWeekQuery.error
  const errorMessage = error
    ? error instanceof GraphqlRequestError
      ? error.message
      : '추천 기록을 확인하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.'
    : !isLoading && (!meQuery.data || !wardrobeQuery.data || !plannerWeekQuery.data)
      ? '추천 기록을 확인하는 데 필요한 정보를 불러오지 못했어요.'
      : null

  const applyRecommendation = async (
    selectedItems: WardrobeItem[],
    previewImage?: OutfitPreview,
  ) => {
    if (
      !selectedEntry?.recommendation.ready ||
      !plannerWeekQuery.data ||
      isLoading ||
      errorMessage
    ) {
      return false
    }

    const confirmed = await confirmRecentWear({
      itemIds: selectedItems.map((item) => item.id),
      targetDate: date,
      confirmLabel: hasTodayOutfit ? '그래도 변경' : '그래도 추가',
      cancelLabel: '추천 기록으로 돌아가기',
    })
    if (!confirmed) return false

    try {
      const nextEntries = await setDirectPlannerEntry.mutateAsync({
        weekStartsOn,
        date,
        itemIds: selectedItems.map((item) => item.id),
        previewImage,
        recommendationName: selectedEntry.recommendation.headline,
        recommendationStyle: selectedEntry.style,
        weatherSummary: selectedEntry.recommendation.weather?.summary,
        temperatureC: selectedEntry.recommendation.weather?.temperatureC,
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
    viewerId: meQuery.data?.id ?? null,
    entries,
    selectedEntry,
    closetItems,
    hasTodayOutfit,
    isLoading,
    errorMessage,
    isRetrying: isFetching,
    isSaving: isCheckingRecentWear || setDirectPlannerEntry.isPending,
    actions: {
      selectEntry: (entry: TodayRecommendationHistoryEntry) => {
        setSelectedEntryKey(getHistoryEntryKey(entry))
      },
      showList: () => setSelectedEntryKey(null),
      retry: () => {
        void Promise.all([
          meQuery.refetch(),
          wardrobeQuery.refetch(),
          plannerWeekQuery.refetch(),
        ])
      },
      applyRecommendation,
    },
  }
}
