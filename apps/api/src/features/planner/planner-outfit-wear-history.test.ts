import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { buildApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { outfitCompositionKey } from '../outfit/outfit-composition.js'
import { plannerService } from './planner.service.js'

const userId = '000000000000000000000001'
const foreignUserId = '000000000000000000000002'
const bookId = '000000000000000000000010'
const otherBookId = '000000000000000000000011'
const foreignBookId = '000000000000000000000012'
const today = new Date('2026-11-05')
const items = (ids: string[]) => ids.map((wardrobeItemId) => ({ wardrobeItemId }))
type Template = { id: string; userId: string; items: ReturnType<typeof items> }
type Entry = { date: Date; wornAt: Date | null; wearTemperatureC: number | null; outfit: { items: ReturnType<typeof items> } | null }

/** 공개 service가 실제 repository의 조회·매핑을 거치게 하되 DB 경계만 소유권과 구성별 테스트 데이터로 대체한다. */
function fixture(t: TestContext, templates: Template[], entries: Entry[]) {
  const original = { outfits: prisma.outfit.findMany, entries: prisma.plannerEntry.findMany }
  const calls: { outfits: Array<Record<string, any>>; entries: Array<Record<string, any>> } = { outfits: [], entries: [] }
  prisma.outfit.findMany = (async (args: Record<string, any>) => {
    calls.outfits.push(args)
    return templates.filter((outfit) => (!args.where.userId || outfit.userId === args.where.userId)
      && args.where.id.in.includes(outfit.id))
  }) as unknown as typeof original.outfits
  prisma.plannerEntry.findMany = (async (args: Record<string, any>) => {
    calls.entries.push(args)
    return entries
  }) as unknown as typeof original.entries
  t.after(() => { prisma.outfit.findMany = original.outfits; prisma.plannerEntry.findMany = original.entries })
  return calls
}

test('코디 조합 키는 순서·중복과 무관하며 빈 구성은 매칭하지 않고 입력을 보존한다', () => {
  const input = ['c', 'a', 'b', 'a']
  assert.equal(outfitCompositionKey(input), outfitCompositionKey(['b', 'c', 'a']))
  assert.deepEqual(input, ['c', 'a', 'b', 'a'])
  assert.equal(outfitCompositionKey([]), '')
  assert.notEqual(outfitCompositionKey(['a', 'b', 'c']), outfitCompositionKey(['a', 'b', 'd']))
})

test('날짜별 복사본은 정확한 현재 조합으로 요청 코디 ID에 연결하고 미착용·미래 배정도 유지한다', async (t) => {
  const calls = fixture(t, [{ id: bookId, userId, items: items(['a', 'b', 'c']) }], [
    { date: today, wornAt: today, wearTemperatureC: 13, outfit: { items: items(['c', 'a', 'b']) } },
    { date: new Date('2026-11-04'), wornAt: today, wearTemperatureC: 12, outfit: { items: items(['a', 'b', 'd']) } },
    { date: new Date('2026-11-07'), wornAt: null, wearTemperatureC: null, outfit: { items: items(['a', 'b', 'c']) } },
    { date: new Date('2026-11-03'), wornAt: null, wearTemperatureC: null, outfit: null },
  ])
  const result = await plannerService.getOutfitWearHistory(userId, [bookId, bookId])
  assert.deepEqual(result, [
    { outfitId: bookId, date: today, wornAt: today, wearTemperatureC: 13 },
    { outfitId: bookId, date: new Date('2026-11-07'), wornAt: null, wearTemperatureC: null },
  ])
  assert.deepEqual(calls.outfits[0].where, { userId, id: { in: [bookId] } })
  assert.deepEqual(calls.entries[0].where.plannerWeek, { is: { userId } })
  assert.equal(calls.entries[0].where.outfit.is.userId, userId)
  assert.equal(calls.entries[0].where.wornAt, undefined)
  assert.equal(calls.entries[0].where.date, undefined)
})

test('현재 코디북이 ABD로 바뀌면 보관된 ABC 착용은 붙이지 않고 ABD 예정만 반환한다', async (t) => {
  fixture(t, [{ id: bookId, userId, items: items(['a', 'b', 'd']) }], [
    { date: today, wornAt: today, wearTemperatureC: 10, outfit: { items: items(['a', 'b', 'c']) } },
    { date: new Date('2026-11-06'), wornAt: null, wearTemperatureC: null, outfit: { items: items(['a', 'b', 'd']) } },
  ])
  assert.deepEqual(await plannerService.getOutfitWearHistory(userId, [bookId]), [{
    outfitId: bookId, date: new Date('2026-11-06'), wornAt: null, wearTemperatureC: null,
  }])
})

test('다른 계정 코디와 빈 구성은 본인 착용과 조합이 같아도 이력을 반환하지 않는다', async (t) => {
  const calls = fixture(t, [
    { id: foreignBookId, userId: foreignUserId, items: items(['a', 'b', 'c']) },
    { id: bookId, userId, items: [] },
  ], [{ date: today, wornAt: today, wearTemperatureC: 10, outfit: { items: items(['a', 'b', 'c']) } }])
  assert.deepEqual(await plannerService.getOutfitWearHistory(userId, [foreignBookId, bookId]), [])
  assert.equal(calls.entries.length, 0)
})

test('기존 중복 코디도 요청받은 각 ID를 유지하며 이름·사진과 관계없이 같은 옷 구성을 연결한다', async (t) => {
  fixture(t, [
    { id: bookId, userId, items: items(['a', 'b', 'c']) },
    { id: otherBookId, userId, items: items(['b', 'c', 'a']) },
  ], [{ date: today, wornAt: today, wearTemperatureC: 10, outfit: { items: items(['a', 'b', 'c']) } }])
  const result = await plannerService.getOutfitWearHistory(userId, [bookId, otherBookId])
  assert.deepEqual(result.map((entry) => entry.outfitId), [bookId, otherBookId])
  assert.equal(result.every((entry) => entry.wearTemperatureC === 10), true)
})

test('잘못된 ID·과다 요청과 인증 없는 GraphQL 조회는 DB 이력 조회 전에 거절한다', async (t) => {
  const calls = fixture(t, [], [])
  assert.throws(() => plannerService.getOutfitWearHistory(userId, ['not-an-id']), { code: 'INVALID_OUTFIT_ID' })
  assert.throws(() => plannerService.getOutfitWearHistory(userId, Array.from({ length: 101 }, (_, index) => index.toString(16).padStart(24, '0'))), { code: 'OUTFIT_HISTORY_LIMIT_EXCEEDED' })
  const app = await buildApp()
  t.after(() => app.close())
  const response = await app.inject({ method: 'POST', url: '/graphql', payload: {
    query: `query { outfitWearHistory(outfitIds: ["${bookId}"]) { outfitId date } }`,
  } })
  assert.equal(response.json().errors?.length, 1)
  assert.equal(response.json().errors[0].extensions.code, 'UNAUTHENTICATED')
  assert.equal(calls.outfits.length, 0)
  assert.equal(calls.entries.length, 0)
})
