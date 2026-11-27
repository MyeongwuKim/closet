import type { WearFeeling } from '@closet/types'
import { Check, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { getAccessToken } from '../../../lib/auth'
import { useUiStore } from '../../../stores/useUiStore'
import { useSetPlannerEntryWearFeelingMutation, useSetPlannerEntryWornMutation } from '../api/plannerQueries'
import { getCurrentWeekStart, type PlanEntry } from '../data/weeklyPlan'
import { useKoreaPlannerToday } from '../hooks/useKoreaPlannerToday'
import { canConfirmPlannerWear } from '../utils/plannerWear'
import { PlannerWearFeeling, PlannerWearFeelingDialog } from './PlannerWearFeeling'

interface PlannerWearActionProps {
  entry: PlanEntry
  showFeelingEditor?: boolean
}

/** 실제 착용 저장 직후 체감을 묻는다. 날짜 상세에서는 저장된 체감의 변경과 삭제도 제공한다. */
export function PlannerWearAction({ entry, showFeelingEditor = false }: PlannerWearActionProps) {
  const mutation = useSetPlannerEntryWornMutation()
  const feelingMutation = useSetPlannerEntryWearFeelingMutation()
  const pushToast = useUiStore((state) => state.pushToast)
  const today = useKoreaPlannerToday()
  const [prompt, setPrompt] = useState<{ date: string; outfitId: string; wornAt: string } | null>(null)
  const isWorn = Boolean(entry.wornAt)
  const isSaving = mutation.isPending || feelingMutation.isPending
  const showPrompt = Boolean(prompt && prompt.date === entry.date && prompt.outfitId === entry.outfitId && prompt.wornAt === entry.wornAt)

  if (!canConfirmPlannerWear(entry, today)) return null

  /** 현재 화면의 코디 ID와 확인 여부를 전달한다. 실패하면 기존 상태를 유지하고 오류만 알린다. */
  const toggleWear = async () => {
    if (!entry.outfitId || isSaving) return
    const sessionToken = getAccessToken()
    try {
      const entries = await mutation.mutateAsync({
        weekStartsOn: getCurrentWeekStart(new Date(`${entry.date}T00:00:00`)),
        date: entry.date,
        outfitId: entry.outfitId,
        worn: !isWorn,
      })
      if (sessionToken !== getAccessToken()) return
      const saved = entries.find((candidate) => candidate.date === entry.date && candidate.outfitId === entry.outfitId)
      if (!isWorn && saved?.wornAt && !saved.wearFeeling) {
        setPrompt({ date: entry.date, outfitId: entry.outfitId, wornAt: saved.wornAt })
      }
      pushToast(isWorn ? '착용 완료 표시를 취소했어요.' : '착용 기록을 남겼어요.', 'success')
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '착용 기록을 저장하지 못했어요.', 'error')
    }
  }

  /** 현재 확인 시각의 코디에 체감을 저장하거나 지운다. 실패·취소된 착용의 오래된 요청은 선택 상태에 반영하지 않는다. */
  const saveFeeling = async (feeling: WearFeeling | null, manualTemperatureC?: number | null) => {
    const temperatureChanged = manualTemperatureC !== undefined && manualTemperatureC !== (entry.manualWearTemperatureC ?? null)
    if (!entry.outfitId || !entry.wornAt || isSaving || ((entry.wearFeeling ?? null) === feeling && !temperatureChanged)) return
    await feelingMutation.mutateAsync({
      weekStartsOn: getCurrentWeekStart(new Date(`${entry.date}T00:00:00`)),
      date: entry.date,
      outfitId: entry.outfitId,
      wornAt: entry.wornAt,
      feeling,
      manualTemperatureC,
    })
  }

  return (
    <div className="shrink-0 border-t border-line bg-surface px-4 py-3" role="group" aria-label="실제 착용 확인" aria-busy={isSaving}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`flex items-center gap-1 text-xs font-bold ${isWorn ? 'text-accent' : 'text-ink'}`}>
            {isWorn && <Check size={14} aria-hidden="true" />}
            {isWorn ? '착용 완료' : '이 코디를 실제로 입었나요?'}
          </p>
          <p className="mt-1 text-[10px] leading-4 text-muted">{isWorn ? '착용 횟수와 통계에 반영돼요.' : '입었어요를 눌러야 착용 기록에 반영돼요.'}</p>
        </div>
        <button
          type="button"
          onClick={() => void toggleWear()}
          disabled={isSaving}
          className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-wait disabled:opacity-50 ${isWorn ? 'border border-line bg-canvas text-muted hover:text-ink' : 'bg-accent text-white hover:bg-accent/90'}`}
        >
          {mutation.isPending ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : !isWorn && <Check size={14} aria-hidden="true" />}
          {isWorn ? '착용 취소' : '입었어요'}
        </button>
      </div>
      {isWorn && showFeelingEditor && <PlannerWearFeeling value={entry.wearFeeling ?? null} disabled={isSaving} onChange={(feeling) => {
        void saveFeeling(feeling).catch((error: unknown) => {
          pushToast(error instanceof Error ? error.message : '착용 체감을 저장하지 못했어요.', 'error')
        })
      }} />}
      {showPrompt && <PlannerWearFeelingDialog isSaving={isSaving} initialFeeling={entry.wearFeeling}
        automaticTemperatureC={entry.wearTemperatureC} forecastTemperatureC={entry.wearForecastTemperatureC}
        manualTemperatureC={entry.manualWearTemperatureC}
        onSave={saveFeeling} onClose={() => setPrompt(null)} />}
    </div>
  )
}
