import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { buildApp } from '../../app.js'
import { ServiceError } from '../../graphql/errors.js'
import { prisma } from '../../lib/prisma.js'
import { authService } from '../auth/auth.service.js'
import { getTemperatureWearHistory } from './temperature-history.service.js'
import { plannerRepository } from './planner.repository.js'
import { plannerService } from './planner.service.js'
import { outfitService } from '../outfit/outfit.service.js'

const owner = '000000000000000000000001'
const foreign = '000000000000000000000002'
const id = (value: number) => value.toString(16).padStart(24, '0')
type Row = { date: Date; wornAt: Date | null; wearTemperatureC: number | null; manualWearTemperatureC?: number | null; wearFeeling: 'cold' | 'comfortable' | 'hot' | null; owner: string; outfit: { id: string; items: { wardrobeItemId: string }[] } | null }
function record(day: string, outfit: number, itemIds: string[], temperature: number | null, feeling: Row['wearFeeling'] = null): Row {
  return { date: new Date(day), wornAt: new Date(`${day}T10:00:00Z`), owner, wearTemperatureC: temperature, wearFeeling: feeling, outfit: { id: id(outfit), items: itemIds.map(wardrobeItemId => ({ wardrobeItemId })) } }
}

/** 실제 service → repository를 사용하고 DB 경계만 대체한다. 읽은 소유권 조건과 페이지별 사진 조회도 함께 검사한다. */
function fixture(t: TestContext, rows: Row[]) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-13T04:00:00Z') })
  const calls = { records: [] as Array<Record<string, any>>, outfits: [] as Array<Record<string, any>> }
  const original = { records: prisma.plannerEntry.findMany, outfits: prisma.outfit.findMany }
  prisma.plannerEntry.findMany = (async (args: Record<string, any>) => {
    calls.records.push(args)
    return rows.filter(row => row.owner === args.where.plannerWeek.is.userId)
  }) as unknown as typeof original.records
  prisma.outfit.findMany = (async (args: Record<string, any>) => {
    calls.outfits.push(args)
    return rows.filter(row => row.owner === args.where.userId && row.outfit && args.where.id.in.includes(row.outfit.id)).map(row => ({
      ...row.outfit!, userId: row.owner, name: `코디 ${row.outfit!.id}`, style: 'casual', seasons: ['spring'], createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), generations: [],
    }))
  }) as unknown as typeof original.outfits
  t.after(() => { prisma.plannerEntry.findMany = original.records; prisma.outfit.findMany = original.outfits })
  return calls
}

test('순서가 다른 같은 조합을 묶고 실제 평균·체감만 남기며 예정·미래·다른 계정은 제외한다', async t => {
  const rows = [
    record('2026-11-10', 10, ['top', 'bottom'], 16.2, 'comfortable'),
    record('2026-11-09', 11, ['bottom', 'top'], 12, 'cold'),
    { ...record('2026-11-12', 12, ['top', 'bottom'], 99), wornAt: null },
    record('2026-11-14', 13, ['top', 'bottom'], 99),
    { ...record('2026-11-11', 14, ['foreign'], 99), owner: foreign },
    record('2026-11-08', 15, [], 99),
  ]
  const calls = fixture(t, rows)
  const page = await getTemperatureWearHistory(owner)
  assert.equal(page.totalCount, 1)
  assert.equal(page.items[0].id, id(10))
  assert.deepEqual(page.items[0].records, [
    { date: '2026-11-10', outfitId: id(10), wornAt: '2026-11-10T10:00:00.000Z', temperatureC: 16.2, automaticTemperatureC: 16.2, manualTemperatureC: null, feeling: 'comfortable' },
    { date: '2026-11-09', outfitId: id(11), wornAt: '2026-11-09T10:00:00.000Z', temperatureC: 12, automaticTemperatureC: 12, manualTemperatureC: null, feeling: 'cold' },
  ])
  assert.deepEqual(calls.records[0].where.wornAt, { isSet: true, not: null })
  assert.equal(calls.records[0].where.outfit.is.userId, owner)
  assert.equal(calls.records[0].where.date.lte.toISOString(), '2026-11-13T00:00:00.000Z')
  assert.deepEqual(calls.outfits[0].where, { userId: owner, id: { in: [id(10)] } })
})

test('온도별 기록의 범위에는 직접 입력한 기온을 우선하고 실제 평균도 반환한다', async t => {
  fixture(t, [{ ...record('2026-11-10', 10, ['top'], 16.2), manualWearTemperatureC: -2.5 }])
  const page = await getTemperatureWearHistory(owner, { maxTemperatureC: 0 })
  assert.equal(page.items[0]?.records[0]?.temperatureC, -2.5)
  assert.equal(page.items[0]?.records[0]?.automaticTemperatureC, 16.2)
  assert.equal((await getTemperatureWearHistory(owner, { minTemperatureC: 0 })).totalCount, 0)
})

test('저장 코디 상세는 같은 옷을 포함한 다른 조합을 제외하고 날짜 목록을 읽는다', async t => {
  const itemIds = [id(1), id(2)]
  const calls = fixture(t, [record('2026-11-12', 10, [...itemIds, id(3)], 13), record('2026-11-10', 11, [...itemIds].reverse(), 16)])
  const page = await getTemperatureWearHistory(owner, { compositionItemIds: itemIds })
  assert.deepEqual(page.items.map(group => group.id), [id(11)])
  assert.deepEqual(calls.records[0].where.outfit.is.AND, itemIds.map(wardrobeItemId => ({ items: { some: { wardrobeItemId } } })))
})

test('기온·체감을 같은 날짜에서 비교하고 필터 밖의 과거 기록도 상세에 보존한다', async t => {
  fixture(t, [record('2026-11-10', 10, ['a', 'b'], 16, 'comfortable'), record('2026-11-09', 11, ['b', 'a'], 12, 'cold')])
  const filtered = await getTemperatureWearHistory(owner, { minTemperatureC: 10, maxTemperatureC: 15, feeling: 'cold' })
  assert.equal(filtered.items[0].id, id(11))
  assert.equal(filtered.items[0].matchingDate, '2026-11-09')
  assert.equal(filtered.items[0].records.length, 2)
  assert.equal((await getTemperatureWearHistory(owner, { minTemperatureC: 10, maxTemperatureC: 15, feeling: 'comfortable' })).totalCount, 0)
})

test('하한은 포함·상한은 제외하며 0℃·미기록을 구분한다', async t => {
  fixture(t, [record('2026-11-10', 10, ['a'], 10), record('2026-11-09', 11, ['b'], 15), record('2026-11-08', 12, ['c'], 0), record('2026-11-07', 13, ['d'], null)])
  assert.deepEqual((await getTemperatureWearHistory(owner, { minTemperatureC: 10, maxTemperatureC: 15 })).items.map(group => group.id), [id(10)])
  assert.deepEqual((await getTemperatureWearHistory(owner, { maxTemperatureC: 5 })).items.map(group => group.id), [id(12)])
  assert.deepEqual((await getTemperatureWearHistory(owner, { unrecordedOnly: true })).items.map(group => group.id), [id(13)])
})

test('같은 날짜의 다른 조합도 커서로 빠짐없이 넘기며 사진은 현재 페이지에서만 읽는다', async t => {
  const calls = fixture(t, [record('2026-11-10', 10, ['a'], 12), record('2026-11-10', 11, ['b'], 12), record('2026-11-09', 12, ['c'], 12)])
  const first = await getTemperatureWearHistory(owner, { limit: 1 })
  const second = await getTemperatureWearHistory(owner, { limit: 1, cursor: first.nextCursor })
  const third = await getTemperatureWearHistory(owner, { limit: 1, cursor: second.nextCursor })
  assert.deepEqual([...first.items, ...second.items, ...third.items].map(group => group.id), [id(11), id(10), id(12)])
  assert.equal(first.totalCount, 3)
  assert.equal(third.hasNextPage, false)
  assert.equal(third.nextCursor, null)
  assert.equal(calls.outfits.every(call => call.where.id.in.length === 1), true)
  await assert.rejects(getTemperatureWearHistory(owner, { limit: 1, cursor: first.nextCursor, minTemperatureC: 20 }), { code: 'INVALID_CURSOR' })
})

test('잘못된 기온·체감·페이지는 조회 전에 거절한다', async t => {
  const calls = fixture(t, [])
  for (const input of [{ minTemperatureC: NaN }, { maxTemperatureC: 101 }, { minTemperatureC: 15, maxTemperatureC: 10 }, { minTemperatureC: 0, unrecordedOnly: true }]) {
    await assert.rejects(getTemperatureWearHistory(owner, input), { code: 'INVALID_TEMPERATURE_RANGE' })
  }
  await assert.rejects(getTemperatureWearHistory(owner, { feeling: 'wrong' as 'cold' }), { code: 'INVALID_WEAR_FEELING' })
  await assert.rejects(getTemperatureWearHistory(owner, { limit: 51 }), { code: 'INVALID_PAGE' })
  await assert.rejects(getTemperatureWearHistory(owner, { cursor: 'broken' }), { code: 'INVALID_CURSOR' })
  assert.equal(calls.records.length, 0)
})

test('GraphQL 인증·입력·실제 날짜별 필드 계약을 확인하고 다른 계정 기록을 반환하지 않는다', async t => {
  const calls = fixture(t, [record('2026-11-10', 10, ['a'], 12, 'cold')])
  t.mock.method(authService, 'getViewer', async (token?: string) => {
    if (!token) throw new ServiceError('로그인이 필요해요.', 'UNAUTHENTICATED')
    return { id: token === 'owner-session' ? owner : foreign } as Awaited<ReturnType<typeof authService.getViewer>>
  })
  const app = await buildApp()
  t.after(() => app.close())
  const query = 'query($input: TemperatureWearHistoryInput) { temperatureWearHistory(input: $input) { totalCount hasNextPage nextCursor items { id matchingDate records { date temperatureC feeling } outfit { id name } } } }'
  const request = async (token?: string, input = {}) => (await app.inject({ method: 'POST', url: '/graphql', headers: token ? { authorization: `Bearer ${token}` } : undefined, payload: { query, variables: { input } } })).json()
  assert.equal((await request()).errors[0].extensions.code, 'UNAUTHENTICATED')
  assert.equal(calls.records.length, 0)
  const result = await request('owner-session', { minTemperatureC: 10, maxTemperatureC: 15 })
  assert.equal(result.errors, undefined)
  assert.equal(result.data.temperatureWearHistory.items[0].records[0].date, '2026-11-10')
  assert.equal(result.data.temperatureWearHistory.items[0].records[0].feeling, 'cold')
  assert.equal((await request('foreign-session')).data.temperatureWearHistory.totalCount, 0)
})

test('과거 코디를 바꿔 담은 이름·스타일은 AI 추천으로 분류하지 않고 직접 구성에 전달한다', async t => {
  const week = { id: 'week', entries: [] }
  t.mock.method(plannerRepository, 'findWeek', async () => week as unknown as Awaited<ReturnType<typeof plannerRepository.findWeek>>)
  t.mock.method(plannerRepository, 'setEntry', async () => week as unknown as Awaited<ReturnType<typeof plannerRepository.setEntry>>)
  const prepare = t.mock.method(outfitService, 'preparePlannerOutfit', async () => ({ userId: owner, name: '셔츠와 데님', style: 'casual', source: 'manual', seasons: [], items: [] }))
  await plannerService.setDirectEntry(owner, { weekStartsOn: '2026-11-09', date: '2026-11-11', itemIds: [id(1), id(2)], name: '셔츠와 데님', style: 'casual' })
  assert.deepEqual(prepare.mock.calls[0].arguments, [owner, { itemIds: [id(1), id(2)], items: undefined, seasons: undefined, previewImage: undefined, name: '셔츠와 데님', style: 'casual', source: 'manual' }])
})
