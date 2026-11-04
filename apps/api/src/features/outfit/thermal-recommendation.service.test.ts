import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { outfitResolvers } from './outfit.resolvers.js'
import { thermalRecommendationRepository } from './thermal-recommendation.repository.js'
import { getThermalRecommendationContext } from './thermal-recommendation.service.js'
import type { GraphQLContext } from '../../graphql/context.js'

test('평균 기온이 없는 추천은 DB를 읽지 않고 중립값을 반환한다', async (t) => {
  const lookup = t.mock.method(thermalRecommendationRepository, 'findHistory', async () => [])
  const first = await getThermalRecommendationContext('user', '2026-11-05')
  const second = await getThermalRecommendationContext('user', '2026-11-05', null)
  assert.deepEqual(first, second)
  assert.equal(first.direction, 'neutral')
  assert.equal(first.sampleCount, 0)
  assert.equal(lookup.mock.callCount(), 0)
})

test('날짜와 유한한 일평균을 저장소 조회 전에 검증한다', async (t) => {
  const lookup = t.mock.method(thermalRecommendationRepository, 'findHistory', async () => [])
  await assert.rejects(getThermalRecommendationContext('user', '2026-02-30', 15), { code: 'INVALID_DATE' })
  for (const mean of [NaN, Infinity, -Infinity]) {
    await assert.rejects(getThermalRecommendationContext('user', '2026-11-05', mean), { code: 'INVALID_THERMAL_TEMPERATURE' })
  }
  assert.equal(lookup.mock.callCount(), 0)
})

test('로그인 계정과 한국 날짜를 기준으로 실제 착용 근거를 조회한다', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T14:59:00Z') })
  const lookup = t.mock.method(thermalRecommendationRepository, 'findHistory', async (owner: string, date: Date, today: Date, mean: number) => {
    assert.equal(owner, 'current-user')
    assert.equal(date.toISOString(), '2026-11-05T00:00:00.000Z')
    assert.equal(today.toISOString(), '2026-11-04T00:00:00.000Z')
    assert.equal(mean, 0)
    return [{ id: 'history', date: new Date('2026-11-03'), wornAt: new Date('2026-11-03T12:00:00Z'), wearFeeling: 'cold' as const, wearTemperatureC: 0 }]
  })
  const result = await outfitResolvers.Query.thermalRecommendationContext(null, { date: '2026-11-05', meanTemperatureC: 0 }, { getViewer: async () => ({ id: 'current-user' }) } as GraphQLContext)
  assert.equal(result.direction, 'warmer')
  assert.equal(result.sampleCount, 1)
  assert.equal(lookup.mock.callCount(), 1)
})

test('저장소는 본인·확인됨·과거·체감·실제 평균·±4도·최신30건을 DB에서 제한한다', async (t) => {
  let query: any
  const original = prisma.plannerEntry.findMany
  prisma.plannerEntry.findMany = (async (args: unknown) => { query = args; return [] }) as unknown as typeof original
  t.after(() => { prisma.plannerEntry.findMany = original })
  const today = new Date('2026-11-04')
  const target = new Date('2026-11-01')
  await thermalRecommendationRepository.findHistory('owner', target, today, 15)
  assert.deepEqual(query.where.plannerWeek, { is: { userId: 'owner' } })
  assert.deepEqual(query.where.wornAt, { isSet: true, not: null })
  assert.deepEqual(query.where.outfitId, { not: null })
  assert.deepEqual(query.where.date, { gte: new Date(today.getTime() - 180 * 86_400_000), lt: target })
  assert.deepEqual(query.where.wearTemperatureC, { gte: 11, lte: 19 })
  assert.deepEqual(query.where.wearFeeling, { in: ['cold', 'comfortable', 'hot'] })
  assert.equal(query.take, 30)
  assert.deepEqual(query.orderBy, [{ date: 'desc' }, { id: 'desc' }])
  assert.equal(query.select.wearTemperatureC, true)
  assert.equal(query.select.temperatureC, undefined)
  await thermalRecommendationRepository.findHistory('owner', new Date('2026-11-08'), today, 15)
  assert.deepEqual(query.where.date.lt, today)
})

test('개인 체감 추천 기준 조회는 로그인 없이 근거를 읽지 않는다', async (t) => {
  const lookup = t.mock.method(thermalRecommendationRepository, 'findHistory', async () => [])
  const app = await buildApp()
  t.after(() => app.close())
  const response = await app.inject({ method: 'POST', url: '/graphql', payload: { query: 'query { thermalRecommendationContext(date: "2026-11-05", meanTemperatureC: 15) { revision direction strength sampleCount } }' } })
  assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  assert.equal(lookup.mock.callCount(), 0)
})
