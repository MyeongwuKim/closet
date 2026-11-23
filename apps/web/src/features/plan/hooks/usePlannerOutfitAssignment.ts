import { useEffect, useRef, useState } from 'react'
import type { WardrobeItem } from '@closet/types'
import { useNavigate } from 'react-router-dom'
import { getAccessToken } from '../../../lib/auth'
import { useUiStore } from '../../../stores/useUiStore'
import { usePlannerEntriesQuery, useSetDirectPlannerEntryMutation, useSetPlannerEntryMutation } from '../api/plannerQueries'
import { getCurrentWeekStart, type PlanEntry } from '../data/weeklyPlan'
import { useRecentWearReminder } from './useRecentWearReminder'
import type { SavedOutfit } from '../../lookbook/types'

/**
 * 담을 날짜를 재조회해 착용 완료를 보호하고, 기존 코디 교체·최근 착용 확인 후 날짜 복사본을 저장한다.
 * 같은 구성은 과거 사진을 함께 복사하고 바꾼 구성은 새 직접 코디로 저장하며 과거 기록에는 쓰지 않는다.
 */
export function usePlannerOutfitAssignment(outfit: SavedOutfit, date: string, selectedItems: WardrobeItem[], confirmWorn = false) {
  const navigate = useNavigate()
  const pushToast = useUiStore(state => state.pushToast)
  const target = usePlannerEntriesQuery(date, date, Boolean(date))
  const setEntry = useSetPlannerEntryMutation()
  const setDirect = useSetDirectPlannerEntryMutation()
  const { confirmRecentWear } = useRecentWearReminder()
  const [isBusy, setIsBusy] = useState(false)
  const [replacement, setReplacement] = useState<PlanEntry | null>(null)
  const locked = useRef(false)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  /** 대상 날짜를 다시 확인한 뒤 저장한다. 중복 클릭과 화면·로그인 변경 후의 저장 재개를 막는다. */
  const assign = async (confirmedOutfitId?: string) => {
    if (locked.current || !date) return
    locked.current = true
    setIsBusy(true)
    const token = getAccessToken()
    const isCurrent = () => active.current && token === getAccessToken()
    try {
      const result = await target.refetch()
      if (!isCurrent()) return
      if (result.error) throw result.error
      const current = result.data?.find(entry => entry.date === date)
      if (current?.wornAt) {
        pushToast('착용 완료한 날짜예요. 다른 날짜를 골라주세요.', 'error')
        setReplacement(null)
        return
      }
      if (current?.outfitId && current.outfitId !== confirmedOutfitId) {
        setReplacement(current)
        return
      }
      setReplacement(null)
      const itemIds = selectedItems.map(item => item.id)
      if (!await confirmRecentWear({ itemIds, targetDate: date, confirmLabel: '그래도 담기', cancelLabel: '다시 고르기' }) || !isCurrent()) return
      const weekStartsOn = getCurrentWeekStart(new Date(`${date}T00:00:00`))
      const originalIds = outfit.layers.map(layer => layer.wardrobeItemId)
      const unchanged = itemIds.length === originalIds.length && originalIds.every(id => itemIds.includes(id))
      if (unchanged) {
        await setEntry.mutateAsync({ weekStartsOn, date, outfitId: outfit.id, title: outfit.name, activeItemsOnly: true, ...(confirmWorn ? { confirmWorn: true } : {}) })
      } else {
        await setDirect.mutateAsync({ weekStartsOn, date, itemIds, name: outfit.name, style: outfit.style, ...(confirmWorn ? { confirmWorn: true } : {}) })
      }
      if (!isCurrent()) return
      pushToast(confirmWorn ? '착용 기록을 남겼어요.' : '선택한 날짜에 코디를 담았어요.', 'success')
      navigate(`/plan?view=today&date=${date}`)
    } catch (error) {
      if (isCurrent()) pushToast(error instanceof Error ? error.message : '플래너에 코디를 담지 못했어요.', 'error')
    } finally {
      locked.current = false
      if (active.current) setIsBusy(false)
    }
  }

  /** 교체 확인만 닫고 선택한 코디·날짜·편집 초안은 유지한다. */
  const cancelReplacement = () => { if (!locked.current) setReplacement(null) }
  return { target, isBusy, replacement, assign, cancelReplacement }
}
