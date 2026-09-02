/**
 * 용도:
 * 현재 위치 좌표와 날짜를 Open-Meteo 예보로 변환해 코디 추천에 제공한다.
 *
 * 동작 방식:
 * 좌표와 날짜를 검증한 뒤 짧은 시간 동안 지역 단위로 캐시하고,
 * 현재 또는 일별 기온과 WMO 날씨 코드를 앱용 설명으로 정리한다.
 */
import type { Season } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { parseDateOnly } from '../../lib/date.js'

export interface WeatherForecastInput {
  latitude: number
  longitude: number
  date: string
}

export interface WeatherSnapshot {
  date: string
  temperatureC: number
  minTemperatureC: number
  maxTemperatureC: number
  apparentTemperatureC: number
  precipitationProbability: number | null
  weatherCode: number
  summary: string
  recommendedSeason: Season
  source: 'open-meteo'
  attribution: string
  attributionUrl: string
}

interface OpenMeteoResponse {
  current?: {
    time?: unknown
    temperature_2m?: unknown
    apparent_temperature?: unknown
    weather_code?: unknown
  }
  daily?: {
    time?: unknown
    weather_code?: unknown
    temperature_2m_mean?: unknown
    temperature_2m_min?: unknown
    temperature_2m_max?: unknown
    apparent_temperature_mean?: unknown
    precipitation_probability_max?: unknown
  }
}

const WEATHER_CACHE_DURATION_MS = 15 * 60 * 1000
const OPEN_METEO_ATTRIBUTION_URL = 'https://open-meteo.com/'
const weatherCache = new Map<
  string,
  { expiresAt: number; value: WeatherSnapshot }
>()

function validateCoordinates(input: WeatherForecastInput) {
  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    throw new ServiceError(
      '올바른 현재 위치가 필요합니다.',
      'INVALID_WEATHER_LOCATION',
    )
  }
  parseDateOnly(input.date, '날씨 조회일')
}

function getNumberAt(value: unknown, index: number, label: string) {
  if (!Array.isArray(value) || !Number.isFinite(value[index])) {
    throw new ServiceError(
      `${label} 예보를 확인하지 못했습니다.`,
      'WEATHER_PROVIDER_INVALID_RESPONSE',
    )
  }
  return Number(value[index])
}

function getOptionalNumberAt(value: unknown, index: number) {
  if (!Array.isArray(value) || !Number.isFinite(value[index])) return null
  return Number(value[index])
}

function getOptionalCurrentNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function getWeatherSummary(weatherCode: number) {
  if (weatherCode === 0) return '맑음'
  if (weatherCode === 1) return '대체로 맑음'
  if (weatherCode === 2) return '구름 조금'
  if (weatherCode === 3) return '흐림'
  if (weatherCode === 45 || weatherCode === 48) return '안개'
  if (weatherCode >= 51 && weatherCode <= 57) return '이슬비'
  if (weatherCode >= 61 && weatherCode <= 67) return '비'
  if (weatherCode >= 71 && weatherCode <= 77) return '눈'
  if (weatherCode >= 80 && weatherCode <= 82) return '소나기'
  if (weatherCode === 85 || weatherCode === 86) return '눈 소나기'
  if (weatherCode >= 95 && weatherCode <= 99) return '천둥번개'
  return '날씨 변화 있음'
}

export function getRecommendedSeason(
  date: string,
  apparentTemperatureC: number,
): Season {
  if (apparentTemperatureC <= 8) return 'winter'
  if (apparentTemperatureC >= 24) return 'summer'

  const month = Number(date.slice(5, 7))
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 9 && month <= 11) return 'autumn'
  if (month >= 6 && month <= 8) {
    return apparentTemperatureC <= 16 ? 'spring' : 'summer'
  }
  return apparentTemperatureC >= 17 ? 'autumn' : 'winter'
}

function getCacheKey(input: WeatherForecastInput) {
  return [
    input.latitude.toFixed(2),
    input.longitude.toFixed(2),
    input.date,
  ].join(':')
}

function createWeatherUrl(input: WeatherForecastInput) {
  const url = new URL(
    process.env.WEATHER_API_BASE_URL?.trim() ||
      'https://api.open-meteo.com/v1/forecast',
  )
  url.searchParams.set('latitude', input.latitude.toString())
  url.searchParams.set('longitude', input.longitude.toString())
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,weather_code',
  )
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_mean',
      'temperature_2m_min',
      'temperature_2m_max',
      'apparent_temperature_mean',
      'precipitation_probability_max',
    ].join(','),
  )
  url.searchParams.set('temperature_unit', 'celsius')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('start_date', input.date)
  url.searchParams.set('end_date', input.date)
  const apiKey = process.env.WEATHER_API_KEY?.trim()
  if (apiKey) url.searchParams.set('apikey', apiKey)
  return url
}

async function fetchWeatherForecast(
  input: WeatherForecastInput,
): Promise<WeatherSnapshot> {
  let response: Response
  try {
    response = await fetch(createWeatherUrl(input), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ServiceError(
      '날씨 서버에 연결하지 못했습니다.',
      'WEATHER_PROVIDER_UNAVAILABLE',
    )
  }
  if (!response.ok) {
    throw new ServiceError(
      '해당 날짜의 날씨 예보를 불러오지 못했습니다.',
      'WEATHER_FORECAST_UNAVAILABLE',
    )
  }

  const payload = (await response.json()) as OpenMeteoResponse
  const daily = payload.daily
  const dates = Array.isArray(daily?.time) ? daily.time : []
  const dateIndex = dates.indexOf(input.date)
  if (!daily || dateIndex < 0) {
    throw new ServiceError(
      '해당 날짜의 날씨 예보가 아직 제공되지 않습니다.',
      'WEATHER_FORECAST_UNAVAILABLE',
    )
  }

  const dailyTemperature = getNumberAt(
    daily.temperature_2m_mean,
    dateIndex,
    '평균 기온',
  )
  const dailyApparentTemperature = getNumberAt(
    daily.apparent_temperature_mean,
    dateIndex,
    '체감 기온',
  )
  const isCurrentDate =
    typeof payload.current?.time === 'string' &&
    payload.current.time.slice(0, 10) === input.date
  const currentTemperature = getOptionalCurrentNumber(
    payload.current?.temperature_2m,
  )
  const currentApparentTemperature = getOptionalCurrentNumber(
    payload.current?.apparent_temperature,
  )
  const currentWeatherCode = getOptionalCurrentNumber(
    payload.current?.weather_code,
  )
  const temperatureC =
    isCurrentDate && currentTemperature !== null
      ? currentTemperature
      : dailyTemperature
  const apparentTemperatureC =
    isCurrentDate && currentApparentTemperature !== null
      ? currentApparentTemperature
      : dailyApparentTemperature
  const weatherCode =
    isCurrentDate && currentWeatherCode !== null
      ? currentWeatherCode
      : getNumberAt(daily.weather_code, dateIndex, '날씨 상태')

  return {
    date: input.date,
    temperatureC: Math.round(temperatureC * 10) / 10,
    minTemperatureC: getNumberAt(
      daily.temperature_2m_min,
      dateIndex,
      '최저 기온',
    ),
    maxTemperatureC: getNumberAt(
      daily.temperature_2m_max,
      dateIndex,
      '최고 기온',
    ),
    apparentTemperatureC: Math.round(apparentTemperatureC * 10) / 10,
    precipitationProbability: getOptionalNumberAt(
      daily.precipitation_probability_max,
      dateIndex,
    ),
    weatherCode,
    summary: getWeatherSummary(weatherCode),
    recommendedSeason: getRecommendedSeason(
      input.date,
      apparentTemperatureC,
    ),
    source: 'open-meteo',
    attribution: 'Weather data by Open-Meteo.com',
    attributionUrl: OPEN_METEO_ATTRIBUTION_URL,
  }
}

export const weatherService = {
  async getForecast(input: WeatherForecastInput) {
    validateCoordinates(input)
    const cacheKey = getCacheKey(input)
    const cached = weatherCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.value

    const value = await fetchWeatherForecast(input)
    weatherCache.set(cacheKey, {
      expiresAt: Date.now() + WEATHER_CACHE_DURATION_MS,
      value,
    })
    return value
  },

  clearCache() {
    weatherCache.clear()
  },
}
