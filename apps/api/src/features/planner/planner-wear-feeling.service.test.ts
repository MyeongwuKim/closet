import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { Prisma, WearFeeling } from '@prisma/client'
import { buildApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { plannerRepository } from './planner.repository.js'
import { plannerResolvers } from './planner.resolvers.js'
import { plannerService, type SetPlannerEntryWearFeelingInput } from './planner.service.js'

const userId = '000000000000000000000001'
const outfitId = '000000000000000000000002'
const replacementId = '000000000000000000000003'
const plannerWeekId = '000000000000000000000004'
const date = new Date('2026-11-04')
const wornAt = new Date('2026-11-04T00:01:00Z')
const input: SetPlannerEntryWearFeelingInput = {
  weekStartsOn: '2026-11-02', date: '2026-11-04', outfitId,
  wornAt: wornAt.toISOString(), feeling: 'comfortable',
}

function freezeToday(t: TestContext) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T14:59:00Z') })
}

function week() {
  return { id: plannerWeekId, entries: [{ date, outfitId, wornAt, wearFeeling: null, outfit: { id: outfitId, userId } }] } as unknown as NonNullable<Awaited<ReturnType<typeof plannerRepository.findWeek>>>
}

/** 실제 DB 대신 조회한 착용 기록과 CAS 결과를 조절해 취소·재확인·동시 변경을 검사한다. */
function repositoryFixture(t: TestContext) {
  const entry = { id: 'entry', outfitId, wornAt: wornAt as Date | null, wearFeeling: null as WearFeeling | null }
  const writes: Array<Record<string, any>> = []
  let count = 1
  const transaction = {
    plannerEntry: {
      findUnique: async () => entry,
      updateMany: async (args: Record<string, any>) => { writes.push(args); return { count } },
    },
    plannerWeek: { findUnique: async () => week() },
  } as unknown as Prisma.TransactionClient
  const originalTransaction = prisma.$transaction
  prisma.$transaction = (async (run: (client: Prisma.TransactionClient) => Promise<unknown>) => run(transaction)) as typeof originalTransaction
  t.after(() => { prisma.$transaction = originalTransaction })
  return { entry, writes, failCompare: () => { count = 0 } }
}

test('확인된 내 코디의 세 체감과 선택 해제를 같은 착용 기록에 전달한다', async (t) => {
  freezeToday(t)
  const current = week()
  t.mock.method(plannerRepository, 'findWeek', async (owner: string) => { assert.equal(owner, userId); return current })
  const saved: unknown[][] = []
  t.mock.method(plannerRepository, 'setEntryWearFeeling', async (...args: unknown[]) => { saved.push(args); return current })
  for (const feeling of ['cold', 'comfortable', 'hot', null] as const) {
    await plannerService.setEntryWearFeeling(userId, { ...input, feeling })
  }
  assert.deepEqual(saved.map((args) => args.slice(0, 4)), Array(4).fill([plannerWeekId, date, outfitId, wornAt]))
  assert.deepEqual(saved.map((args) => args[4]), ['cold', 'comfortable', 'hot', null])
})

test('미확인·다른 계정·교체된 코디·취소 후 재확인한 기록은 거절한다', async (t) => {
  freezeToday(t)
  let current: ReturnType<typeof week> | null = null
  t.mock.method(plannerRepository, 'findWeek', async () => current)
  const save = t.mock.method(plannerRepository, 'setEntryWearFeeling', async () => current)
  await assert.rejects(plannerService.setEntryWearFeeling(userId, input), { code: 'PLANNER_WEAR_CHANGED' })
  current = week()
  current.entries[0].wornAt = null
  await assert.rejects(plannerService.setEntryWearFeeling(userId, input), { code: 'PLANNER_WEAR_CHANGED' })
  current = week()
  current.entries[0].outfit!.userId = 'another-owner'
  await assert.rejects(plannerService.setEntryWearFeeling(userId, input), { code: 'PLANNER_WEAR_CHANGED' })
  current = week()
  current.entries[0].outfitId = replacementId
  await assert.rejects(plannerService.setEntryWearFeeling(userId, input), { code: 'PLANNER_WEAR_CHANGED' })
  current = week()
  current.entries[0].wornAt = new Date('2026-11-04T00:02:00Z')
  await assert.rejects(plannerService.setEntryWearFeeling(userId, input), { code: 'PLANNER_WEAR_CHANGED' })
  assert.equal(save.mock.callCount(), 0)
})

test('서비스 경계에서 날짜·확인 시각·체감 값을 검증하고 미래 날짜도 거절한다', async (t) => {
  freezeToday(t)
  const lookup = t.mock.method(plannerRepository, 'findWeek', async () => week())
  await assert.rejects(plannerService.setEntryWearFeeling(userId, { ...input, date: '2026-02-30' }), { code: 'INVALID_DATE' })
  for (const value of ['invalid', '2026-11-04', '2026-02-30T00:01:00.000Z']) {
    await assert.rejects(plannerService.setEntryWearFeeling(userId, { ...input, wornAt: value }), { code: 'INVALID_WEAR_CONFIRMATION' })
  }
  await assert.rejects(plannerService.setEntryWearFeeling(userId, { ...input, feeling: 'warm' as WearFeeling }), { code: 'INVALID_WEAR_FEELING' })
  await assert.rejects(plannerService.setEntryWearFeeling(userId, { ...input, date: '2026-11-05' }), { code: 'FUTURE_PLANNER_WEAR' })
  assert.equal(lookup.mock.callCount(), 0)
})

test('서비스 검사 뒤 취소·교체되면 저장소 충돌을 그대로 거절한다', async (t) => {
  freezeToday(t)
  t.mock.method(plannerRepository, 'findWeek', async () => week())
  t.mock.method(plannerRepository, 'setEntryWearFeeling', async () => null)
  await assert.rejects(plannerService.setEntryWearFeeling(userId, input), { code: 'PLANNER_WEAR_CHANGED' })
})

test('체감 저장은 확인 시각과 코디를 CAS 조건에 넣고 다른 착용 데이터는 바꾸지 않는다', async (t) => {
  const fixture = repositoryFixture(t)
  await plannerRepository.setEntryWearFeeling(plannerWeekId, date, outfitId, wornAt, 'cold')
  assert.deepEqual(fixture.writes[0], { where: { id: 'entry', outfitId, wornAt }, data: { wearFeeling: 'cold' } })
  fixture.entry.wearFeeling = 'cold'
  await plannerRepository.setEntryWearFeeling(plannerWeekId, date, outfitId, wornAt, 'cold')
  assert.equal(fixture.writes.length, 1)
  await plannerRepository.setEntryWearFeeling(plannerWeekId, date, outfitId, wornAt, null)
  assert.deepEqual(fixture.writes[1].data, { wearFeeling: null })
})

test('저장소도 확인 취소·다른 코디·다른 확인 시각을 쓰기 전에 거절한다', async (t) => {
  const fixture = repositoryFixture(t)
  fixture.entry.wornAt = null
  assert.equal(await plannerRepository.setEntryWearFeeling(plannerWeekId, date, outfitId, wornAt, 'hot'), null)
  fixture.entry.wornAt = new Date('2026-11-04T00:02:00Z')
  assert.equal(await plannerRepository.setEntryWearFeeling(plannerWeekId, date, outfitId, wornAt, 'hot'), null)
  fixture.entry.wornAt = wornAt
  fixture.entry.outfitId = replacementId
  assert.equal(await plannerRepository.setEntryWearFeeling(plannerWeekId, date, outfitId, wornAt, 'hot'), null)
  assert.equal(fixture.writes.length, 0)
})

test('CAS 직전에 기록이 바뀌면 성공한 것으로 응답하지 않는다', async (t) => {
  const fixture = repositoryFixture(t)
  fixture.failCompare()
  assert.equal(await plannerRepository.setEntryWearFeeling(plannerWeekId, date, outfitId, wornAt, 'hot'), null)
})

test('GraphQL은 미확인·기존 누락 필드의 체감을 null로 노출한다', () => {
  const resolve = plannerResolvers.PlannerEntry.wearFeeling
  assert.equal(resolve({ wearFeeling: 'hot' }), null)
  assert.equal(resolve({ wornAt: null, wearFeeling: 'cold' }), null)
  assert.equal(resolve({ wornAt }), null)
  assert.equal(resolve({ wornAt, wearFeeling: 'comfortable' }), 'comfortable')
})

test('체감 저장 API는 로그인 없이는 실행되지 않는다', async (t) => {
  const app = await buildApp()
  t.after(() => app.close())
  const save = t.mock.method(plannerRepository, 'setEntryWearFeeling', async () => null)
  const response = await app.inject({ method: 'POST', url: '/graphql', payload: { query: `mutation { setPlannerEntryWearFeeling(input: { weekStartsOn: "2026-11-02", date: "2026-11-04", outfitId: "${outfitId}", wornAt: "${wornAt.toISOString()}", feeling: cold }) { id } }` } })
  assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  assert.equal(save.mock.callCount(), 0)
})
