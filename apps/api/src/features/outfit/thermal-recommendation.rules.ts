import { createHash } from 'node:crypto'
import type { ThermalRecommendationContext, WearFeeling } from '@closet/types'

/** 체감 근거의 범위·가중치·보정 상한이 바뀌면 revision도 달라지도록 갱신한다. */
export const THERMAL_RECOMMENDATION_RULES_VERSION = 'thermal-recommendation-v1'
/** 비슷한 날씨의 개인 체감을 계산할 때 조회·사용하는 최대 착용 기록 수. */
export const THERMAL_RECOMMENDATION_SAMPLE_LIMIT = 30
/** 비교할 과거 착용 기록의 최대 경과일. */
export const THERMAL_RECOMMENDATION_HISTORY_DAYS = 180
/** 예보 일평균과 실제 착용일 평균 기온의 허용 차이(섭씨). */
export const THERMAL_RECOMMENDATION_TEMPERATURE_WINDOW_C = 4

const DAY_MS = 86_400_000
const feelings: readonly string[] = ['cold', 'comfortable', 'hot']

/** 저장소에서 읽은 실제 착용 근거. 누락·미확정·유효하지 않은 값은 계산에서 다시 제외한다. */
export interface ThermalRecommendationEvidence {
  id: string
  date: Date
  wornAt: Date | null
  wearFeeling: WearFeeling | null
  wearTemperatureC: number | null
}

/**
 * 오늘·추천일 이전 180일간의 확인된 착용 중 일평균이 ±4°C인 최신 30개로 보정 방향을 계산한다.
 * 가까운 기온과 최근 기록에 무게를 두되 두 건의 중립 근거만큼 수축하고 ±0.6으로 제한한다.
 * 일평균이 없으면 근거를 사용하지 않는다. revision에는 계산에 사용한 근거만 해시하고 원본 ID는 노출하지 않는다.
 */
export function calculateThermalRecommendationContext(
  targetDate: Date,
  meanTemperatureC: number | null,
  evidence: ThermalRecommendationEvidence[],
  today: Date,
): ThermalRecommendationContext {
  const cutoff = today.getTime() - THERMAL_RECOMMENDATION_HISTORY_DAYS * DAY_MS
  const selected = meanTemperatureC === null ? [] : evidence.filter((entry) =>
    entry.wornAt instanceof Date && Number.isFinite(entry.wornAt.getTime())
    && entry.date instanceof Date && Number.isFinite(entry.date.getTime())
    && entry.date.getTime() >= cutoff && entry.date < today && entry.date < targetDate
    && feelings.includes(entry.wearFeeling ?? '')
    && typeof entry.wearTemperatureC === 'number' && Number.isFinite(entry.wearTemperatureC)
    && Math.abs(entry.wearTemperatureC - meanTemperatureC) <= THERMAL_RECOMMENDATION_TEMPERATURE_WINDOW_C,
  ).sort((left, right) => right.date.getTime() - left.date.getTime() || right.id.localeCompare(left.id))
    .slice(0, THERMAL_RECOMMENDATION_SAMPLE_LIMIT)

  let weightSum = 0
  let signedSum = 0
  for (const entry of selected) {
    const temperatureWeight = 1 - Math.abs(entry.wearTemperatureC! - meanTemperatureC!) / 5
    const ageDays = (today.getTime() - entry.date.getTime()) / DAY_MS
    const recencyWeight = 1 / (1 + ageDays / 60)
    const weight = temperatureWeight * recencyWeight
    weightSum += weight
    signedSum += weight * (entry.wearFeeling === 'cold' ? 1 : entry.wearFeeling === 'hot' ? -1 : 0)
  }
  const preference = Math.max(-0.6, Math.min(0.6, signedSum / (weightSum + 2)))
  const strength = Math.abs(preference)
  const revision = createHash('sha256').update(JSON.stringify({
    version: THERMAL_RECOMMENDATION_RULES_VERSION,
    date: targetDate.toISOString().slice(0, 10),
    today: today.toISOString().slice(0, 10),
    meanTemperatureC,
    evidence: selected.map((entry) => [entry.id, entry.date.toISOString(), entry.wornAt!.toISOString(), entry.wearFeeling, entry.wearTemperatureC]),
  })).digest('hex')
  return {
    revision,
    direction: strength < 0.1 ? 'neutral' : preference > 0 ? 'warmer' : 'cooler',
    strength,
    sampleCount: selected.length,
  }
}
