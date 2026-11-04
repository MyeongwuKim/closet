import { formatRecentWearLabel, formatWearDate } from '../../../utils/wearDate'

export interface OutfitWearSummary {
  label: string
  title: string
  temperatureLabel?: string
  temperatureTitle?: string
}

/**
 * 오늘까지의 배정 중 wornAt으로 착용을 확인한 날짜만 중복 없이 횟수·기온 범위에 포함한다.
 * 확인하지 않은 지난 배정과 wornAt이 없는 이전 응답은 착용으로 계산하지 않고, 오늘 이후 배정은 예정으로 표시한다.
 */
export function createOutfitWearSummary(records: Array<{ date: string; wornAt?: string | null; temperatureC?: number | null }>, today: string): OutfitWearSummary | null {
  const dates = [...new Set(records.map((record) => record.date))].sort()
  const completedRecords = records.filter((record) => record.date <= today
    && typeof record.wornAt === 'string' && Number.isFinite(Date.parse(record.wornAt)))
  const wornDates = [...new Set(completedRecords.map((record) => record.date))].sort()
  if (wornDates.length > 0) {
    const latestDate = wornDates.at(-1) as string
    const dateLabel = formatRecentWearLabel(latestDate, today) ?? `최근 착용 · ${formatWearDate(latestDate)}`
    const temperatures = completedRecords.filter((record) => typeof record.temperatureC === 'number' && Number.isFinite(record.temperatureC)).map((record) => record.temperatureC as number)
    let temperatureLabel: string | undefined
    if (temperatures.length) {
      const min = Math.round(Math.min(...temperatures))
      const max = Math.round(Math.max(...temperatures))
      temperatureLabel = `${min === max ? min : `${min}~${max}`}℃에 입었어요`
    }
    return {
      label: wornDates.length > 1 ? `${dateLabel} · ${wornDates.length}회` : dateLabel,
      title: `착용 기록: ${wornDates.map(formatWearDate).join(', ')}`,
      temperatureLabel,
      temperatureTitle: temperatureLabel ? 'Open-Meteo 자료로 기록한 지난 착용일의 하루 평균 기온 범위예요. 기온이 없는 날은 제외했어요.' : undefined,
    }
  }
  const nextDate = dates.find((date) => date >= today)
  return nextDate ? { label: `착용 예정 · ${formatWearDate(nextDate)}`, title: `다음 착용 예정일: ${formatWearDate(nextDate)}` } : null
}
