import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryClient } from '@tanstack/react-query'
import type { WeatherSnapshot } from '@closet/types'
import {
  getWeatherStaleTime,
  hasWeatherExpired,
  subscribeWeatherReturn,
  WEATHER_VALIDITY_MS,
} from '../src/features/weather/utils/weatherRefresh'

const startedAt = Date.parse('2026-10-06T07:00:00Z')
const weather: WeatherSnapshot = {
  date: '2026-10-06',
  expiresAt: new Date(startedAt + WEATHER_VALIDITY_MS).toISOString(),
  temperatureC: 19.4,
  apparentTemperatureC: 17.8,
  minTemperatureC: 10.7,
  maxTemperatureC: 20,
  precipitationProbability: 0,
  weatherCode: 0,
  summary: '맑음',
  recommendedSeason: 'autumn',
  source: 'open-meteo',
  attribution: 'Open-Meteo',
  attributionUrl: 'https://open-meteo.com/',
}

test('30분 전까지 재사용하고 정확히 30분부터 갱신한다', () => {
  assert.equal(hasWeatherExpired(weather, startedAt, startedAt + WEATHER_VALIDITY_MS - 1), false)
  assert.equal(hasWeatherExpired(weather, startedAt, startedAt + WEATHER_VALIDITY_MS), true)
  assert.equal(hasWeatherExpired(undefined, 0, startedAt), true)
})

test('29분 된 서버 캐시를 받아도 유효시간을 새로 30분 부여하지 않는다', () => {
  const receivedAt = startedAt + 29 * 60 * 1000
  assert.equal(getWeatherStaleTime(weather, receivedAt), 60 * 1000)
  assert.equal(hasWeatherExpired(weather, receivedAt, startedAt + WEATHER_VALIDITY_MS), true)
  assert.equal(getWeatherStaleTime(weather, startedAt + WEATHER_VALIDITY_MS), 0)
})

test('만료 정보가 없는 이전 응답은 수신 시점부터 30분을 사용한다', () => {
  for (const expiresAt of [undefined, null, 'invalid']) {
    const legacy = { ...weather, expiresAt }
    assert.equal(getWeatherStaleTime(legacy, startedAt), WEATHER_VALIDITY_MS)
    assert.equal(hasWeatherExpired(legacy, startedAt, startedAt + WEATHER_VALIDITY_MS - 1), false)
    assert.equal(hasWeatherExpired(legacy, startedAt, startedAt + WEATHER_VALIDITY_MS), true)
  }
})

test('화면 재진입 쿼리는 만료 전 캐시를 재사용하고 만료 후 중복 요청을 합친다', async (t) => {
  let now = startedAt
  t.mock.method(Date, 'now', () => now)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  let calls = 0
  const options = {
    queryKey: ['weather', 'test'],
    staleTime: (query: { state: { data?: WeatherSnapshot; dataUpdatedAt: number } }) =>
      getWeatherStaleTime(query.state.data, query.state.dataUpdatedAt),
    queryFn: async () => {
      calls += 1
      return { ...weather, expiresAt: new Date(now + WEATHER_VALIDITY_MS).toISOString() }
    },
  }
  try {
    await client.fetchQuery(options)
    now += WEATHER_VALIDITY_MS - 1
    await client.fetchQuery(options)
    assert.equal(calls, 1)
    now += 1
    await Promise.all([client.fetchQuery(options), client.fetchQuery(options)])
    assert.equal(calls, 2)
  } finally {
    client.clear()
  }
})

test('숨김 전환은 무시하고 탭·창·네이티브 복귀를 전달하며 해제 뒤 호출하지 않는다', () => {
  const windowTarget = new EventTarget()
  const documentTarget = Object.assign(new EventTarget(), { visibilityState: 'hidden' as DocumentVisibilityState })
  let calls = 0
  const unsubscribe = subscribeWeatherReturn(() => { calls += 1 }, windowTarget, documentTarget)
  documentTarget.dispatchEvent(new Event('visibilitychange'))
  windowTarget.dispatchEvent(new Event('focus'))
  assert.equal(calls, 0)
  documentTarget.visibilityState = 'visible'
  documentTarget.dispatchEvent(new Event('visibilitychange'))
  windowTarget.dispatchEvent(new Event('focus'))
  windowTarget.dispatchEvent(new Event('closet:native-app-active'))
  assert.equal(calls, 3)
  unsubscribe()
  documentTarget.dispatchEvent(new Event('visibilitychange'))
  windowTarget.dispatchEvent(new Event('focus'))
  windowTarget.dispatchEvent(new Event('closet:native-app-active'))
  assert.equal(calls, 3)
})
