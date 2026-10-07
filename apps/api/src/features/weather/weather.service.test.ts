import assert from 'node:assert/strict'
import test from 'node:test'
import { ServiceError } from '../../graphql/errors.js'
import { getRecommendedSeason, weatherService } from './weather.service.js'

function createProviderResponse(currentDate = '2026-09-02') {
  return {
    current: {
      time: `${currentDate}T12:00`,
      temperature_2m: 27.4,
      apparent_temperature: 29.1,
      weather_code: 2,
    },
    daily: {
      time: ['2026-09-02', '2026-09-03'],
      weather_code: [3, 61],
      temperature_2m_mean: [25, 19.2],
      temperature_2m_min: [21, 16],
      temperature_2m_max: [29, 22],
      apparent_temperature_mean: [26, 18.1],
      precipitation_probability_max: [30, 80],
    },
  }
}

test('오늘 날짜에는 현재 기온을 사용하고 출처를 함께 반환한다', async (t) => {
  weatherService.clearCache()
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify(createProviderResponse()), { status: 200 }),
  )

  const weather = await weatherService.getForecast({
    latitude: 37.5665,
    longitude: 126.978,
    date: '2026-09-02',
  })

  assert.equal(weather.temperatureC, 27.4)
  assert.equal(weather.apparentTemperatureC, 29.1)
  assert.equal(weather.summary, '구름 조금')
  assert.equal(weather.recommendedSeason, 'summer')
  assert.equal(weather.source, 'open-meteo')
  assert.match(weather.attributionUrl, /open-meteo\.com/)
})

test('다른 날짜에는 일별 예보의 평균 기온과 날씨를 사용한다', async (t) => {
  weatherService.clearCache()
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify(createProviderResponse()), { status: 200 }),
  )

  const weather = await weatherService.getForecast({
    latitude: 37.5665,
    longitude: 126.978,
    date: '2026-09-03',
  })

  assert.equal(weather.temperatureC, 19.2)
  assert.equal(weather.apparentTemperatureC, 18.1)
  assert.equal(weather.summary, '비')
  assert.equal(weather.precipitationProbability, 80)
  assert.equal(weather.recommendedSeason, 'autumn')
})

test('체감 23도부터는 달력상 가을이어도 여름 옷을 추천한다', () => {
  assert.equal(getRecommendedSeason('2026-09-15', 23), 'summer')
  assert.equal(getRecommendedSeason('2026-09-15', 22), 'autumn')
})

test('같은 지역과 날짜의 예보는 캐시해 중복 호출하지 않는다', async (t) => {
  weatherService.clearCache()
  let requestCount = 0
  t.mock.method(globalThis, 'fetch', async () => {
    requestCount += 1
    return new Response(JSON.stringify(createProviderResponse()), {
      status: 200,
    })
  })

  const input = {
    latitude: 37.5665,
    longitude: 126.978,
    date: '2026-09-02',
  }
  await weatherService.getForecast(input)
  await weatherService.getForecast(input)

  assert.equal(requestCount, 1)
})

test('캐시는 30분 경계에서 만료되며 재사용으로 만료 시각이 연장되지 않는다', async (t) => {
  weatherService.clearCache()
  const startedAt = Date.parse('2026-09-02T03:00:00Z')
  let now = startedAt
  let requestCount = 0
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async () => {
    requestCount += 1
    return new Response(JSON.stringify(createProviderResponse()), { status: 200 })
  })
  const input = { latitude: 37.5, longitude: 126.9, date: '2026-09-02' }
  const first = await weatherService.getForecast(input)
  assert.equal(Date.parse(first.expiresAt), startedAt + 30 * 60 * 1000)

  now += 30 * 60 * 1000 - 1
  const cached = await weatherService.getForecast(input)
  assert.equal(requestCount, 1)
  assert.equal(cached.expiresAt, first.expiresAt)

  now += 1
  const refreshed = await weatherService.getForecast(input)
  assert.equal(requestCount, 2)
  assert.equal(Date.parse(refreshed.expiresAt), now + 30 * 60 * 1000)
})

test('만료 후 제공자 조회에 실패하면 이전 기온을 새 날씨로 반환하지 않는다', async (t) => {
  weatherService.clearCache()
  let now = Date.parse('2026-09-02T03:00:00Z')
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify(createProviderResponse()), { status: 200 }),
  )
  const input = { latitude: 37.5, longitude: 126.9, date: '2026-09-02' }
  await weatherService.getForecast(input)
  now += 30 * 60 * 1000
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }))
  await assert.rejects(weatherService.getForecast(input), (error: unknown) =>
    error instanceof ServiceError && error.code === 'WEATHER_FORECAST_UNAVAILABLE',
  )
})

test('좌표 범위를 벗어난 위치는 제공자 호출 전에 거절한다', async () => {
  weatherService.clearCache()
  await assert.rejects(
    weatherService.getForecast({
      latitude: 91,
      longitude: 126.978,
      date: '2026-09-02',
    }),
    (error: unknown) =>
      error instanceof ServiceError && error.code === 'INVALID_WEATHER_LOCATION',
  )
})
