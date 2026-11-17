import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '../../../lib/auth'
import { queryKeys } from '../../../lib/queryKeys'
import { useUiStore } from '../../../stores/useUiStore'
import { useMeQuery, type ViewerProfile } from '../../settings/api/profileQueries'
import { subscribeWeatherReturn } from '../../weather/utils/weatherRefresh'
import { usePlannerEntriesQuery, useSetPlannerEntryWornMutation } from '../api/plannerQueries'
import { getCurrentWeekStart } from '../data/weeklyPlan'
import { findWearReviewEntry, parseWearReviewState, wearReviewEntryKey, wearReviewRange, type WearReviewState } from '../utils/plannerWearReview'

/** 최근 미확인 코디를 한 번에 한 건만 제안한다. 넘김은 계정별 로컬 기록으로 하루 동안 숨기고, 실제 착용은 명시적 확인 성공 때만 저장한다. */
export function usePlannerWearReview(today: string) {
  const me = useMeQuery()
  const ownerId = me.data?.id ?? null
  const queryClient = useQueryClient()
  const range = wearReviewRange(today)
  const history = usePlannerEntriesQuery(range.from, range.to, Boolean(ownerId))
  const { refetch } = history
  const mutation = useSetPlannerEntryWornMutation()
  const pushToast = useUiStore(state => state.pushToast)
  const [localState, setLocalState] = useState<{ ownerId: string; state: WearReviewState } | null>(null)
  const storageKey = ownerId ? `closet:planner-wear-review:v1:${ownerId}` : null
  let state = localState?.ownerId === ownerId ? localState.state : null
  if (!state) {
    let raw: string | null = null
    try { if (storageKey) raw = localStorage.getItem(storageKey) } catch { /* 저장이 제한된 환경은 현재 화면의 메모리만 사용한다. */ }
    state = parseWearReviewState(raw, today)
  }
  const reviewState = state
  const entry = ownerId && reviewState.day !== today && !history.isError ? findWearReviewEntry(history.data ?? [], today, reviewState.dismissed) : undefined

  useEffect(() => {
    if (!ownerId) return
    return subscribeWeatherReturn(() => { void refetch() })
  }, [ownerId, today, refetch])

  /** 확인하거나 넘긴 제안은 오늘 다시 제시하지 않는다. 계정·코디별 구분은 유지하고 API의 착용 여부를 대신하지 않는다. */
  const dismiss = () => {
    if (!ownerId || !storageKey || !entry) return
    const next = { day: today, dismissed: [...reviewState.dismissed, wearReviewEntryKey(entry)].slice(-14) }
    setLocalState({ ownerId, state: next })
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* 저장 실패도 넘기기와 실제 착용 확인을 막지 않는다. */ }
  }

  /** 표시 중인 날짜·코디만 확인한다. 계정이 바뀐 응답은 안내·로컬 넘김에 반영하지 않으며 실패한 기록은 다시 확인할 수 있다. */
  const confirm = async () => {
    if (!entry?.outfitId || !ownerId || mutation.isPending) return
    const token = getAccessToken()
    const isCurrent = () => token === getAccessToken() && queryClient.getQueryData<ViewerProfile>(queryKeys.me)?.id === ownerId
    try {
      await mutation.mutateAsync({ weekStartsOn: getCurrentWeekStart(new Date(`${entry.date}T00:00:00`)), date: entry.date, outfitId: entry.outfitId, worn: true })
      if (!isCurrent()) return
      dismiss()
      pushToast('착용 기록을 남겼어요.', 'success')
    } catch (error) {
      if (!isCurrent()) return
      pushToast(error instanceof Error ? error.message : '착용 기록을 저장하지 못했어요.', 'error')
      void refetch()
    }
  }

  return { entry, isSaving: mutation.isPending, confirm, dismiss }
}
