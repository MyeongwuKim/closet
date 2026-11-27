import type { TemperatureWearHistoryInput, TemperatureWearRecord } from '@closet/types'
import { getOutfitComposerBackPath } from '../../lookbook/utils/outfitComposerNavigation'
import { formatWearDate } from '../../../utils/wearDate'

export const wearFeelingLabels = { cold: '추웠어요', comfortable: '적당했어요', hot: '더웠어요' }

export const temperatureRanges = [
  { value: 'all', label: '전체', input: {} },
  { value: 'under5', label: '5℃ 미만', input: { maxTemperatureC: 5 } },
  { value: '5to10', label: '5~10℃ 미만', input: { minTemperatureC: 5, maxTemperatureC: 10 } },
  { value: '10to15', label: '10~15℃ 미만', input: { minTemperatureC: 10, maxTemperatureC: 15 } },
  { value: '15to20', label: '15~20℃ 미만', input: { minTemperatureC: 15, maxTemperatureC: 20 } },
  { value: '20to25', label: '20~25℃ 미만', input: { minTemperatureC: 20, maxTemperatureC: 25 } },
  { value: 'over25', label: '25℃ 이상', input: { minTemperatureC: 25 } },
  { value: 'unknown', label: '기온 미기록', input: { unrecordedOnly: true } },
] satisfies Array<{ value: string; label: string; input: TemperatureWearHistoryInput }>

/** 평균 기온을 소수 한 자리까지 표시하며 null을 0℃로 바꾸지 않는다. */
export function formatWearTemperature(value: number | null) {
  return value === null ? '기온 미기록' : `평균 ${Math.round(value * 10) / 10}℃`
}

/** 예보가 표시 기온으로 쓰였을 때는 출처를 함께 보여준다. */
export function formatWearRecordTemperature(record: TemperatureWearRecord) {
  if (record.temperatureC === null) return '기온 미기록'
  const isForecast = record.manualTemperatureC == null && record.automaticTemperatureC == null && record.forecastTemperatureC != null
  const temperature = `${Math.round(record.temperatureC * 10) / 10}℃`
  return isForecast ? `${temperature} · 예보` : temperature
}

/** 여러 해의 착용 기록에서 같은 월·일을 구분하도록 연도를 항상 표시한다. */
export function formatTemperatureWearDate(value: string) {
  return `${value.slice(0, 4)}년 ${formatWearDate(value)}`
}

/** URL의 기온과 구간을 검증한다. 비슷한 기온은 기준 ±3℃ 범위로 조회하고 상한은 제외한다. */
export function readTemperatureFilter(params: URLSearchParams) {
  const raw = params.get('temperature')
  const temperature = raw !== null && raw.trim() !== '' ? Number(raw) : NaN
  if (params.get('range') === 'near' && Number.isFinite(temperature) && temperature >= -97 && temperature <= 97) {
    return { value: 'near', temperature, input: { minTemperatureC: temperature - 3, maxTemperatureC: temperature + 3 } }
  }
  const range = temperatureRanges.find(candidate => candidate.value === params.get('range')) ?? temperatureRanges[0]
  return { value: range.value, temperature: null, input: range.input as TemperatureWearHistoryInput }
}

/** 잘못된 달·일이 자동 보정된 날짜는 버리고, 실제 존재하는 YYYY-MM-DD만 선택 날짜로 사용한다. */
export function readWearHistoryDate(value: string | null, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : fallback
}

/** 입구의 날짜·복귀 경로를 보존한다. 예보 평균이 있으면 비슷한 기온 필터로 바로 연다. */
export function createWearHistoryPath(from: string, date?: string, temperature?: number | null) {
  const params = new URLSearchParams({ from: getOutfitComposerBackPath(from) })
  if (date) params.set('date', date)
  if (temperature != null && Number.isFinite(temperature) && temperature >= -97 && temperature <= 97) {
    params.set('range', 'near')
    params.set('temperature', String(temperature))
  }
  return `/wear-history?${params}`
}
