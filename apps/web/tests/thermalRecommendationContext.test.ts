import assert from 'node:assert/strict'
import test from 'node:test'
import { QueryClient } from '@tanstack/react-query'
import type { ThermalRecommendationContext, TodayOutfitRecommendation, WeatherSnapshot } from '@closet/types'
import { queryKeys } from '../src/lib/queryKeys'
import {
  getThermalRecommendationMean,
  matchesThermalRecommendationContext,
  matchesTodayRecommendationWeather,
} from '../src/features/plan/utils/thermalRecommendationContext'
import {
  assertCurrentThermalRecommendationContext,
  refreshChangedThermalRecommendationContext,
  thermalRecommendationContextQueryOptions,
} from '../src/features/plan/api/thermalRecommendationQueries'

const context = (revision: string): ThermalRecommendationContext => ({ revision, direction: 'warmer', strength: 0.5, sampleCount: 2 })
const weather: WeatherSnapshot = {
  date: '2026-11-04', temperatureC: 21, meanTemperatureC: 18, apparentTemperatureC: 20,
  minTemperatureC: 14, maxTemperatureC: 23, precipitationProbability: 0, weatherCode: 0,
  summary: '맑음', recommendedSeason: 'autumn', source: 'open-meteo', attribution: 'Open-Meteo', attributionUrl: 'https://open-meteo.com/',
}

test('일평균이 없는 이전 예보는 현재 기온으로 대체하지 않는다', () => {
  assert.equal(getThermalRecommendationMean(weather), 18)
  for (const meanTemperatureC of [undefined, null, NaN, Infinity]) {
    assert.equal(getThermalRecommendationMean({ ...weather, meanTemperatureC }), null)
    assert.equal(thermalRecommendationContextQueryOptions('viewer', weather.date, null).enabled, false)
  }
})

test('최신 체감 근거의 버전이 다르거나 없는 이전 결과는 개인화 초기 캐시로 재사용하지 않는다', () => {
  const legacy = { weather } as TodayOutfitRecommendation
  assert.equal(matchesThermalRecommendationContext(legacy, 'revision-2'), false)
  assert.equal(matchesThermalRecommendationContext({ ...legacy, thermalContext: context('revision-1') }, 'revision-2'), false)
  assert.equal(matchesThermalRecommendationContext({ ...legacy, thermalContext: context('revision-2') }, 'revision-2'), true)
  assert.equal(matchesThermalRecommendationContext({} as TodayOutfitRecommendation), true)
  assert.equal(matchesTodayRecommendationWeather(legacy, { ...weather, meanTemperatureC: 19 }), false)
  assert.equal(matchesTodayRecommendationWeather(legacy, weather), true)
})

test('개인화 캐시는 사용자·날짜·평균 기온·체감 근거 버전을 구분하고 계절 키는 유지한다', () => {
  const seasonalKey = queryKeys.planner.todayRecommendation('viewer', weather.date, 'autumn', 'auto', 0, [])
  const key = (revision: string) => queryKeys.planner.todayRecommendation('viewer', weather.date, 'autumn', 'auto', 0, [], undefined, 'weather', revision)
  assert.notDeepEqual(key('v1'), key('v2'))
  assert.equal(seasonalKey.length, 11)
  assert.notDeepEqual(queryKeys.planner.thermalContext('viewer', weather.date, 18), queryKeys.planner.thermalContext('other', weather.date, 18))
  assert.notDeepEqual(queryKeys.planner.thermalContext('viewer', weather.date, 18), queryKeys.planner.thermalContext('viewer', weather.date, 19))
})

test('동시에 도착한 버전 변경은 무료 근거 조회 하나로 합치고 새 근거가 있으면 다시 읽지 않는다', async (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const operations: string[] = []
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { ClosetNative: {
    requestGraphql: async (query: string, variables: { date: string; meanTemperatureC: number }) => {
      operations.push(query.match(/query\s+(\w+)/)?.[1] ?? 'unknown')
      assert.deepEqual(variables, { date: weather.date, meanTemperatureC: 18 })
      await gate
      return { ok: true, payload: { data: { thermalRecommendationContext: context('v2') } } }
    },
  } } })
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const key = queryKeys.planner.thermalContext('viewer', weather.date, 18)
  client.setQueryData(key, context('v1'))
  const signal = new AbortController().signal
  try {
    const requests = [
      refreshChangedThermalRecommendationContext(client, 'viewer', weather.date, 18, 'v1', signal),
      refreshChangedThermalRecommendationContext(client, 'viewer', weather.date, 18, 'v1', signal),
    ]
    release()
    await Promise.all(requests)
    assert.deepEqual(operations, ['ThermalRecommendationContext'])
    assert.equal(client.getQueryData<ThermalRecommendationContext>(key)?.revision, 'v2')
    await refreshChangedThermalRecommendationContext(client, 'viewer', weather.date, 18, 'v1', signal)
    assert.equal(operations.length, 1)
    let recommendationExecutions = 0
    await assert.rejects(async () => {
      await assertCurrentThermalRecommendationContext(client, 'viewer', weather.date, 18, 'v1', signal)
      recommendationExecutions += 1
    }, { code: 'THERMAL_CONTEXT_CHANGED' })
    assert.equal(recommendationExecutions, 0)
    await assertCurrentThermalRecommendationContext(client, 'viewer', weather.date, 18, 'v2', signal)
    assert.equal(operations.length, 1)
  } finally {
    release()
    client.clear()
  }
})
