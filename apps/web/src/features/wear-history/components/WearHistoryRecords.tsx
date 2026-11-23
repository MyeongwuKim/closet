import { useState } from 'react'
import type { TemperatureWearRecord, WearFeeling } from '@closet/types'
import { getAccessToken } from '../../../lib/auth'
import { useSetPlannerEntryWearFeelingMutation } from '../../plan/api/plannerQueries'
import { PlannerWearFeelingDialog } from '../../plan/components/PlannerWearFeeling'
import { getCurrentWeekStart } from '../../plan/data/weeklyPlan'
import { formatTemperatureWearDate, formatWearRecordTemperature, wearFeelingLabels } from '../utils/temperatureHistory'

/** 코디 상세 아래에 날짜별 기록을 표시한다. 수정은 선택한 날짜의 착용 확인 시각을 기준으로 저장한다. */
export function WearHistoryRecords({ records }: { records: TemperatureWearRecord[] }) {
  const [updatedRecords, setUpdatedRecords] = useState<Record<string, TemperatureWearRecord>>({})
  const [editingRecord, setEditingRecord] = useState<TemperatureWearRecord | null>(null)
  const recordMutation = useSetPlannerEntryWearFeelingMutation()

  const saveRecord = async (feeling: WearFeeling | null, manualTemperatureC: number | null) => {
    if (!editingRecord) return
    const { date, outfitId, wornAt } = editingRecord
    const sessionToken = getAccessToken()
    const entries = await recordMutation.mutateAsync({
      weekStartsOn: getCurrentWeekStart(new Date(`${date}T00:00:00`)),
      date, outfitId, wornAt, feeling, manualTemperatureC,
    })
    if (sessionToken !== getAccessToken()) return
    const saved = entries.find((entry) => entry.date === date && entry.outfitId === outfitId && entry.wornAt === wornAt)
    if (!saved) throw new Error('착용 기록을 다시 확인해주세요.')
    const automaticTemperatureC = saved.wearTemperatureC ?? null
    const manual = saved.manualWearTemperatureC ?? null
    setUpdatedRecords((previous) => ({ ...previous, [wornAt + date]: {
      ...editingRecord, feeling: saved.wearFeeling ?? null, automaticTemperatureC,
      manualTemperatureC: manual, temperatureC: manual ?? automaticTemperatureC,
    } }))
  }


  if (!records.length) return null

  const displayedRecords = records.map((record) => updatedRecords[record.wornAt + record.date] ?? record)
  return (<>
    <section aria-label="날짜별 착용 기록" className="mx-auto mt-6 w-full max-w-xl pb-4">
      <h2 className="text-base font-semibold">이 코디를 입었던 날</h2>
      <ol className="mt-3 divide-y divide-line">
        {displayedRecords.map(record => <li key={record.date} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <time dateTime={record.date} className="text-muted">{formatTemperatureWearDate(record.date)}</time>
          <span className="ml-auto text-right"><strong className="block font-semibold">{formatWearRecordTemperature(record.temperatureC)}</strong><span className="mt-0.5 block text-xs text-muted">{record.feeling ? wearFeelingLabels[record.feeling] : '체감 미기록'}</span></span>
          {record.outfitId && record.wornAt && <button type="button" onClick={() => setEditingRecord(record)}
            aria-label={`${formatTemperatureWearDate(record.date)} 착용 기록 수정`}
            className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-semibold text-accent hover:bg-sage disabled:opacity-50">수정</button>}
        </li>)}
      </ol>
    </section>
      {editingRecord && <PlannerWearFeelingDialog isEditing isSaving={recordMutation.isPending}
        initialFeeling={editingRecord.feeling} automaticTemperatureC={editingRecord.automaticTemperatureC}
        manualTemperatureC={editingRecord.manualTemperatureC} onSave={saveRecord} onClose={() => setEditingRecord(null)} />}
  </>)
}
