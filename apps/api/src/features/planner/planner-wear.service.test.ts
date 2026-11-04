import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { Prisma } from '@prisma/client'
import { buildApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { plannerRepository } from './planner.repository.js'
import type { outfitInclude } from '../outfit/outfit.repository.js'
import { plannerService } from './planner.service.js'

const userId = '000000000000000000000001'
const outfitId = '000000000000000000000002'
const replacementId = '000000000000000000000003'
const plannerWeekId = '000000000000000000000004'
const weekStartsOn = '2026-11-02'
const date = new Date('2026-11-04')
const confirmedAt = new Date('2026-11-04T00:01:00Z')

function freezeToday(t: TestContext) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T14:59:00Z') })
}

function week() {
  return { id: plannerWeekId, entries: [{ date, outfitId, wornAt: null, outfit: { id: outfitId, userId } }] } as unknown as NonNullable<Awaited<ReturnType<typeof plannerRepository.findWeek>>>
}

/** 실제 DB 대신 트랜잭션 경계의 항목과 쓰기만 기록한다. 읽은 기존 상태에 따른 초기화·중복 확인을 검사한다. */
function repositoryFixture(t: TestContext, previousOutfitId: string | null = outfitId, wornAt: Date | null = confirmedAt) {
  type StoredOutfit = Prisma.OutfitGetPayload<{ include: typeof outfitInclude }>
  const makeOutfit = (id: string): StoredOutfit => ({
    id, userId, name: '날짜 코디', style: 'casual', source: 'manual', seasons: ['spring'], plannerOnly: true, note: null,
    items: [{ wardrobeItemId: 'top', slot: 'top', layerOrder: 0 }, { wardrobeItemId: id === replacementId ? 'other-bottom' : 'bottom', slot: 'bottom', layerOrder: 1 }],
    generations: [],
  }) as unknown as StoredOutfit
  const outfits = new Map([outfitId, replacementId].map((id) => [id, makeOutfit(id)]))
  const entries = [{ id: 'entry', date, outfitId: previousOutfitId, wornAt, outfit: previousOutfitId ? outfits.get(previousOutfitId) ?? null : null }]
  const writes: Array<{ kind: string; args: Record<string, any> }> = []
  const transaction = {
    aiLease: { upsert: async () => ({}) },
    wardrobeItem: {
      findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id, archivedAt: null, updatedAt: new Date(0), displayImageAssetId: null, originalImageAssetId: null }),
    },
    plannerEntry: {
      findUnique: async () => entries[0],
      findMany: async () => entries,
      count: async () => 1,
      upsert: async (args: Record<string, any>) => { writes.push({ kind: 'upsert', args }); return {} },
      update: async (args: Record<string, any>) => { writes.push({ kind: 'update', args }); return {} },
    },
    plannerWeek: { findUnique: async (input: { select?: unknown }) => input.select ? { userId } : week() },
    imageAsset: { findFirst: async () => ({ updatedAt: new Date(0) }), updateMany: async () => ({ count: 1 }) },
    outfit: {
      findFirst: async (input: { where: { id: string; userId: string } }) => { assert.equal(input.where.userId, userId); return outfits.get(input.where.id) },
      update: async (input: { where: { id: string } }) => outfits.get(input.where.id),
      create: async () => ({ id: 'new-date-snapshot' }),
      findMany: async (input: { where: { userId: string; id: { in: string[] } } }) => {
      assert.equal(input.where.userId, userId)
      return input.where.id.in.map((id) => ({ id, items: outfits.get(id)?.items ?? [], generations: [] }))
    } },
  } as unknown as Prisma.TransactionClient
  const originalTransaction = prisma.$transaction
  prisma.$transaction = (async (run: (client: Prisma.TransactionClient) => Promise<unknown>) => run(transaction)) as typeof originalTransaction
  t.after(() => { prisma.$transaction = originalTransaction })
  return { entries, writes, outfits }
}

test('오늘의 내 코디만 확인하며 취소도 저장소로 전달한다', async (t) => {
  freezeToday(t)
  const current = week()
  t.mock.method(plannerRepository, 'findWeek', async (owner: string) => { assert.equal(owner, userId); return current })
  const saved: unknown[][] = []
  t.mock.method(plannerRepository, 'setEntryWorn', async (...args: unknown[]) => { saved.push(args); return current })
  const input = { weekStartsOn, date: '2026-11-04', outfitId, worn: true }
  await plannerService.setEntryWorn(userId, input)
  await plannerService.setEntryWorn(userId, { ...input, worn: false })
  assert.deepEqual(saved.map((args) => args.slice(0, 4)), [[plannerWeekId, date, outfitId, true], [plannerWeekId, date, outfitId, false]])
})

test('한국 자정 전의 미래 날짜는 확인할 수 없고 자정 후에는 가능하다', async (t) => {
  freezeToday(t)
  const current = week()
  current.entries[0].date = new Date('2026-11-05')
  t.mock.method(plannerRepository, 'findWeek', async () => current)
  const save = t.mock.method(plannerRepository, 'setEntryWorn', async () => current)
  const input = { weekStartsOn, date: '2026-11-05', outfitId, worn: true }
  await assert.rejects(plannerService.setEntryWorn(userId, input), { code: 'FUTURE_PLANNER_WEAR' })
  assert.equal(save.mock.callCount(), 0)
  t.mock.timers.tick(2 * 60_000)
  await plannerService.setEntryWorn(userId, input)
  assert.equal(save.mock.callCount(), 1)
})

test('배정 없음·다른 계정의 코디·교체된 코디는 확인하지 않는다', async (t) => {
  freezeToday(t)
  let current: ReturnType<typeof week> | null = null
  t.mock.method(plannerRepository, 'findWeek', async () => current)
  const save = t.mock.method(plannerRepository, 'setEntryWorn', async () => current)
  const input = { weekStartsOn, date: '2026-11-04', outfitId, worn: true }
  await assert.rejects(plannerService.setEntryWorn(userId, input), { code: 'PLANNER_OUTFIT_CHANGED' })
  current = week()
  current.entries[0].outfitId = replacementId
  await assert.rejects(plannerService.setEntryWorn(userId, input), { code: 'PLANNER_OUTFIT_CHANGED' })
  current = week()
  current.entries[0].outfit!.userId = 'another-user'
  await assert.rejects(plannerService.setEntryWorn(userId, input), { code: 'PLANNER_OUTFIT_CHANGED' })
  assert.equal(save.mock.callCount(), 0)
})

test('검증 중 코디가 교체되면 저장소의 충돌을 오류로 전달한다', async (t) => {
  freezeToday(t)
  t.mock.method(plannerRepository, 'findWeek', async () => week())
  t.mock.method(plannerRepository, 'setEntryWorn', async () => null)
  await assert.rejects(plannerService.setEntryWorn(userId, { weekStartsOn, date: '2026-11-04', outfitId, worn: true }), { code: 'PLANNER_OUTFIT_CHANGED' })
})

test('최초 확인만 시각을 저장하고 중복 확인은 원래 시각을 유지한다', async (t) => {
  const fixture = repositoryFixture(t, outfitId, null)
  await plannerRepository.setEntryWorn(plannerWeekId, date, outfitId, true, confirmedAt)
  assert.deepEqual(fixture.writes[0].args.data, { wornAt: confirmedAt, wearFeeling: null })
  fixture.entries[0].wornAt = confirmedAt
  await plannerRepository.setEntryWorn(plannerWeekId, date, outfitId, true, new Date('2026-11-04T12:00:00Z'))
  assert.equal(fixture.writes.length, 1)
})

test('착용 취소는 기온 결과·재시도도 초기화하고 중복 취소는 다시 쓰지 않는다', async (t) => {
  const fixture = repositoryFixture(t)
  await plannerRepository.setEntryWorn(plannerWeekId, date, outfitId, false, new Date())
  assert.deepEqual(fixture.writes[0].args.data, { wornAt: null, wearFeeling: null, wearTemperatureC: null, wearWeatherRecordedAt: null, wearWeatherRetryAt: null })
  fixture.entries[0].wornAt = null
  await plannerRepository.setEntryWorn(plannerWeekId, date, outfitId, false, new Date())
  assert.equal(fixture.writes.length, 1)
})

test('저장 직전 다른 코디이면 쓰지 않는다', async (t) => {
  const fixture = repositoryFixture(t, replacementId)
  assert.equal(await plannerRepository.setEntryWorn(plannerWeekId, date, outfitId, true, confirmedAt), null)
  assert.equal(fixture.writes.length, 0)
})

test('코디 재배정은 확인·기온을 초기화하고 같은 코디 재저장은 유지한다', async (t) => {
  const fixture = repositoryFixture(t)
  await plannerRepository.setEntry({ plannerWeekId, date, outfitId, title: '같은 코디' })
  assert.equal('wornAt' in fixture.writes[0].args.update, false)
  assert.equal('wearFeeling' in fixture.writes[0].args.update, false)
  await plannerRepository.setEntry({ plannerWeekId, date, outfitId: replacementId, title: '바뀐 코디' })
  assert.equal(fixture.writes[1].args.update.wornAt, null)
  assert.equal(fixture.writes[1].args.update.wearFeeling, null)
  assert.equal(fixture.writes[1].args.update.wearTemperatureC, null)
})

test('옷이 같고 사진만 바뀌어 날짜 복사본이 새로 생겨도 착용·체감·기온은 유지한다', async (t) => {
  const fixture = repositoryFixture(t)
  const previous = fixture.outfits.get(outfitId)!
  fixture.outfits.set(replacementId, {
    ...previous, id: replacementId,
    generations: [{ imageAssetId: 'new-image', userId, status: 'completed', requestedAt: new Date(), model: 'test', imageAsset: { id: 'new-image' } }] as typeof previous.generations,
  })
  await plannerRepository.setEntry({ plannerWeekId, date, outfitId: replacementId })
  const update = fixture.writes[0].args.update
  assert.equal(update.outfitId, 'new-date-snapshot')
  assert.equal('wornAt' in update, false)
  assert.equal('wearFeeling' in update, false)
  assert.equal('wearTemperatureC' in update, false)
})

test('날짜 이동에서 코디가 바뀌는 날짜만 확인을 초기화한다', async (t) => {
  const fixture = repositoryFixture(t)
  await plannerRepository.moveEntryOutfits({ plannerWeekId, entries: [{ date, outfitId: replacementId, title: '옮긴 코디' }] })
  assert.equal(fixture.writes[0].args.update.wornAt, null)
  assert.equal(fixture.writes[0].args.update.wearFeeling, null)
  await plannerRepository.moveEntryOutfits({ plannerWeekId, entries: [{ date, outfitId, title: '기존 코디' }] })
  assert.equal('wornAt' in fixture.writes[1].args.update, false)
  assert.equal('wearFeeling' in fixture.writes[1].args.update, false)
})

test('최근 착용 조회는 착용 확인이 있는 항목만 읽는다', async (t) => {
  let filter: any
  const originalFindMany = prisma.plannerEntry.findMany
  prisma.plannerEntry.findMany = (async (args: unknown) => { filter = args; return [] }) as unknown as typeof originalFindMany
  t.after(() => { prisma.plannerEntry.findMany = originalFindMany })
  await plannerRepository.findRecentWearHistory(userId, [outfitId], date, new Date('2026-11-05'), date)
  assert.deepEqual(filter.where.wornAt, { isSet: true, not: null })
  assert.equal(filter.select.wornAt, true)
})

test('착용 확인 API는 로그인 없이는 저장하지 않는다', async (t) => {
  const app = await buildApp()
  t.after(() => app.close())
  const save = t.mock.method(plannerRepository, 'setEntryWorn', async () => null)
  const response = await app.inject({ method: 'POST', url: '/graphql', payload: { query: 'mutation { setPlannerEntryWorn(input: { weekStartsOn: "2026-11-02", date: "2026-11-04", outfitId: "000000000000000000000002", worn: true }) { id } }' } })
  assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  assert.equal(save.mock.callCount(), 0)
})
