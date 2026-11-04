import type { ThermalRecommendationContext } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import { parseDateOnly } from '../../lib/date.js'
import { getKoreaTodayUtc } from '../wardrobe/wardrobe.service.js'
import { thermalRecommendationRepository } from './thermal-recommendation.repository.js'
import { calculateThermalRecommendationContext } from './thermal-recommendation.rules.js'

/**
 * 추천 날짜·예보 일평균을 검증한 뒤 현재 계정의 실제 착용 근거로 보정 방향과 revision을 반환한다.
 * 일평균이 없는 계절 추천·이전 날씨 기록은 DB를 조회하지 않고 결정적인 중립 결과를 반환한다.
 */
export async function getThermalRecommendationContext(
  userId: string,
  date: string,
  meanTemperatureC?: number | null,
): Promise<ThermalRecommendationContext> {
  const targetDate = parseDateOnly(date, '추천 날짜')
  if (meanTemperatureC != null && !Number.isFinite(meanTemperatureC)) {
    throw new ServiceError('올바른 하루 평균 기온이 필요합니다.', 'INVALID_THERMAL_TEMPERATURE')
  }
  const today = getKoreaTodayUtc()
  const mean = meanTemperatureC ?? null
  const evidence = mean === null ? [] : await thermalRecommendationRepository.findHistory(userId, targetDate, today, mean)
  return calculateThermalRecommendationContext(targetDate, mean, evidence, today)
}
