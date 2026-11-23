import { useRef, useState } from 'react'
import { getAccessToken } from '../../../lib/auth'
import { useUiStore } from '../../../stores/useUiStore'
import { useOutfitsQuery, type CreateOutfitVariables } from '../../lookbook/api/lookbookQueries'
import { findDuplicateOutfit } from '../../lookbook/utils/outfitComposition'
import type { OutfitPreviewImageInput } from '../../lookbook/utils/outfitPreviewInput'
import { useSavePlannerOutfitToLookbookMutation, useSetDirectPlannerEntryMutation } from '../api/plannerQueries'
import { getCurrentWeekStart } from '../data/weeklyPlan'
import { useKoreaPlannerToday } from './useKoreaPlannerToday'
import { useRecentWearReminder } from './useRecentWearReminder'

/** 코디 만들기에서 날짜 배정을 먼저 완료하고, 코디북에 없는 경우에만 저장한 날짜 코디의 복사를 제안한다. */
export function usePlannerComposerSave(date: string | null, onFinish: () => void) {
  const today = useKoreaPlannerToday()
  const [confirmWorn, setConfirmWorn] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copyTarget, setCopyTarget] = useState<{ id: string; token: string | null } | null>(null)
  const isWorking = useRef(false)
  const pushToast = useUiStore((state) => state.pushToast)
  const { confirmRecentWear } = useRecentWearReminder()
  const setEntry = useSetDirectPlannerEntryMutation()
  const copyOutfit = useSavePlannerOutfitToLookbookMutation()
  const lookbook = useOutfitsQuery(Boolean(date))

  async function save(input: {
    items: CreateOutfitVariables['items']
    seasons?: CreateOutfitVariables['seasons']
    name?: string
    style?: string
    previewImage?: OutfitPreviewImageInput
  }) {
    if (!date || isWorking.current || copyTarget) return
    const token = getAccessToken()
    const itemIds = input.items.map((item) => item.wardrobeItemId)
    isWorking.current = true
    setIsSaving(true)

    try {
      const confirmed = await confirmRecentWear({
        itemIds, targetDate: date, confirmLabel: '그래도 저장', cancelLabel: '계속 편집',
      })
      if (!confirmed || getAccessToken() !== token) return

      const worn = confirmWorn && date <= today
      const entries = await setEntry.mutateAsync({
        ...input,
        itemIds,
        date,
        weekStartsOn: getCurrentWeekStart(new Date(`${date}T00:00:00`)),
        ...(worn ? { confirmWorn: true } : {}),
      })
      const id = entries.find((entry) => entry.date === date)?.outfitId
      if (getAccessToken() !== token) return
      if (!id) throw new Error('저장한 날짜의 코디를 찾지 못했어요.')
      const result = await lookbook.refetch()
      if (getAccessToken() !== token) return
      if (result.isSuccess && !findDuplicateOutfit(result.data, itemIds)) {
        setCopyTarget({ id, token })
      } else {
        pushToast(worn ? '입은 코디로 기록했어요.' : '플래너에 코디를 추가했어요.', 'success')
        onFinish()
      }
    } catch (error) {
      if (getAccessToken() === token) {
        pushToast(error instanceof Error ? error.message : '플래너에 코디를 추가하지 못했어요.', 'error')
      }
    } finally {
      isWorking.current = false
      setIsSaving(false)
    }
  }

  async function saveCopy() {
    if (!copyTarget || isWorking.current || getAccessToken() !== copyTarget.token) return
    isWorking.current = true
    try {
      await copyOutfit.mutateAsync({ outfitId: copyTarget.id })
      if (getAccessToken() !== copyTarget.token) return
      pushToast('코디북에도 추가했어요.', 'success')
      onFinish()
    } catch (error) {
      if (getAccessToken() === copyTarget.token) {
        pushToast(error instanceof Error ? error.message : '코디북에 추가하지 못했어요.', 'error')
      }
    } finally {
      isWorking.current = false
    }
  }

  return { today, confirmWorn, setConfirmWorn, save, saveCopy, isSaving, showCopyPrompt: Boolean(copyTarget), isCopying: copyOutfit.isPending }
}
