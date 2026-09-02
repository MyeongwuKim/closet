/**
 * 용도:
 * 코디 저장 동작에서 최근 착용 확인과 사용자 재확인을 한 번에 처리한다.
 *
 * 동작 방식:
 * 계정 설정이 켜진 경우에만 최근 기록을 조회하고,
 * 충돌이 있으면 전역 확인창의 응답을 기다린 뒤 저장 가능 여부를 반환한다.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useUiStore } from '../../../stores/useUiStore'
import { useMeQuery } from '../../settings/api/profileQueries'
import { fetchRecentWearConflict } from '../api/recentWearQueries'

interface ConfirmRecentWearOptions {
  itemIds: string[]
  targetDate: string
  includeTargetDate?: boolean
  confirmLabel?: string
  cancelLabel?: string
}

export function useRecentWearReminder() {
  const queryClient = useQueryClient()
  const meQuery = useMeQuery()
  const requestRecentWearConfirmation = useUiStore(
    (state) => state.requestRecentWearConfirmation,
  )
  const cancelRecentWearConfirmation = useUiStore(
    (state) => state.cancelRecentWearConfirmation,
  )
  const pushToast = useUiStore((state) => state.pushToast)
  const [isChecking, setIsChecking] = useState(false)
  const isCheckingRef = useRef(false)
  const isMountedRef = useRef(true)
  const ownerId = useId()
  const preferences = meQuery.data?.wearReminderPreferences
  const refetchPreferences = meQuery.refetch

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      cancelRecentWearConfirmation(ownerId)
    }
  }, [cancelRecentWearConfirmation, ownerId])

  const confirmRecentWear = useCallback(
    async ({
      itemIds,
      targetDate,
      includeTargetDate = false,
      confirmLabel = '그래도 추가',
      cancelLabel = '다시 고르기',
    }: ConfirmRecentWearOptions) => {
      const uniqueItemIds = [...new Set(itemIds)]
      if (uniqueItemIds.length === 0) {
        return true
      }
      if (
        preferences &&
        (!preferences.enabled ||
          (!preferences.combinationReminderEnabled &&
            !preferences.itemReminderEnabled))
      ) {
        return true
      }
      if (isCheckingRef.current) return false

      isCheckingRef.current = true
      setIsChecking(true)
      try {
        const activePreferences =
          preferences ??
          (await refetchPreferences()).data?.wearReminderPreferences
        if (!isMountedRef.current) return false

        if (!activePreferences) {
          pushToast(
            '최근 착용 설정은 확인하지 못했지만 저장은 계속할 수 있어요.',
          )
          return true
        }
        if (
          !activePreferences.enabled ||
          (!activePreferences.combinationReminderEnabled &&
            !activePreferences.itemReminderEnabled)
        ) {
          return true
        }

        const variables = {
          itemIds: uniqueItemIds,
          targetDate,
          includeTargetDate,
          intervalDays: activePreferences.intervalDays,
          combinationReminderEnabled:
            activePreferences.combinationReminderEnabled,
          itemReminderEnabled: activePreferences.itemReminderEnabled,
        }
        const conflict = await queryClient.fetchQuery({
          queryKey: ['planner', 'recent-wear-conflict', variables],
          queryFn: () => fetchRecentWearConflict(variables),
          staleTime: 0,
        })
        if (!isMountedRef.current) return false

        if (!conflict) return true
        const confirmed = await requestRecentWearConfirmation(
          {
            ...conflict,
            targetDate,
            intervalDays: activePreferences.intervalDays,
            confirmLabel,
            cancelLabel,
          },
          ownerId,
        )
        return isMountedRef.current ? confirmed : false
      } catch {
        if (!isMountedRef.current) return false
        pushToast(
          '최근 착용 기록은 확인하지 못했지만 저장은 계속할 수 있어요.',
        )
        return true
      } finally {
        isCheckingRef.current = false
        if (isMountedRef.current) setIsChecking(false)
      }
    },
    [
      ownerId,
      preferences,
      pushToast,
      queryClient,
      refetchPreferences,
      requestRecentWearConfirmation,
    ],
  )

  return { confirmRecentWear, isCheckingRecentWear: isChecking }
}
