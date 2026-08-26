import { useMemo } from 'react'
import {
  formatRecentWearLabel,
  formatWearDate,
} from '../../../utils/wearDate'
import { useOutfitWearHistoryQuery } from '../../plan/api/plannerQueries'
import { formatDateOnly } from '../../plan/data/weeklyPlan'

export interface OutfitWearSummary {
  label: string
  title: string
}

function createWearSummary(
  dates: string[],
  today: string,
): OutfitWearSummary | null {
  const uniqueDates = [...new Set(dates)].sort()
  const wornDates = uniqueDates.filter((date) => date <= today)

  if (wornDates.length > 0) {
    const latestDate = wornDates.at(-1) as string
    const dateLabel =
      formatRecentWearLabel(latestDate, today) ??
      `최근 착용 · ${formatWearDate(latestDate)}`

    return {
      label:
        wornDates.length > 1
          ? `${dateLabel} · ${wornDates.length}회`
          : dateLabel,
      title: `착용 기록: ${wornDates.map(formatWearDate).join(', ')}`,
    }
  }

  const nextDate = uniqueDates.find((date) => date > today)
  if (!nextDate) return null

  return {
    label: `착용 예정 · ${formatWearDate(nextDate)}`,
    title: `다음 착용 예정일: ${formatWearDate(nextDate)}`,
  }
}

export function useOutfitWearSummaries(outfitIds: string[]) {
  const persistedOutfitIds = [...new Set(outfitIds)]
    .filter((id) => /^[a-f\d]{24}$/i.test(id))
    .sort()
  const outfitWearHistoryQuery = useOutfitWearHistoryQuery(persistedOutfitIds)
  const today = formatDateOnly(new Date())

  return useMemo(() => {
    const datesByOutfitId = new Map<string, string[]>()

    for (const record of outfitWearHistoryQuery.data ?? []) {
      const dates = datesByOutfitId.get(record.outfitId) ?? []
      dates.push(record.date)
      datesByOutfitId.set(record.outfitId, dates)
    }

    const summaries = new Map<string, OutfitWearSummary>()
    for (const [outfitId, dates] of datesByOutfitId) {
      const summary = createWearSummary(dates, today)
      if (summary) summaries.set(outfitId, summary)
    }

    return summaries
  }, [outfitWearHistoryQuery.data, today])
}
