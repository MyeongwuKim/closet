import type { ThermalRecommendationContext, TodayOutfitRecommendation, WeatherSnapshot } from '@closet/types'

/** 실제 착용일의 평균 기온과 비교할 예보 평균만 사용한다. 현재 기온으로 일평균을 대체하지 않는다. */
export function getThermalRecommendationMean(weather?: WeatherSnapshot | null) {
  return typeof weather?.meanTemperatureC === 'number' && Number.isFinite(weather.meanTemperatureC)
    ? weather.meanTemperatureC : null
}

/** 서버·로컬 기록의 개인 체감 근거 메타데이터를 검증한다. 보정이 없는 이전 기록은 호출부에서 별도로 허용한다. */
export function isThermalRecommendationContext(value: unknown): value is ThermalRecommendationContext {
  if (!value || typeof value !== 'object') return false
  const context = value as Partial<ThermalRecommendationContext>
  return typeof context.revision === 'string' && context.revision.length > 0
    && ['warmer', 'cooler', 'neutral'].includes(context.direction ?? '')
    && typeof context.strength === 'number' && Number.isFinite(context.strength) && context.strength >= 0
    && typeof context.sampleCount === 'number' && Number.isInteger(context.sampleCount) && context.sampleCount >= 0
}

/** 최신 체감 근거와 같은 결과만 날씨 추천의 초기 캐시로 허용한다. 체감을 사용하지 않는 요청에는 일반 추천만 재사용한다. */
export function matchesThermalRecommendationContext(recommendation: TodayOutfitRecommendation, revision?: string) {
  if (revision === undefined) return recommendation.thermalContext == null
  return isThermalRecommendationContext(recommendation.thermalContext)
    && recommendation.thermalContext.revision === revision
}

/** 추천 당시의 날짜·현재/체감 기온·일평균·날씨 코드가 같은지 확인한다. 계절 추천은 날씨가 없는 결과만 재사용한다. */
export function matchesTodayRecommendationWeather(recommendation: TodayOutfitRecommendation, weather?: WeatherSnapshot | null) {
  if (!weather) return !recommendation.weather
  const previous = recommendation.weather
  return previous?.date === weather.date && previous.temperatureC === weather.temperatureC
    && previous.apparentTemperatureC === weather.apparentTemperatureC && previous.weatherCode === weather.weatherCode
    && getThermalRecommendationMean(previous) === getThermalRecommendationMean(weather)
}
