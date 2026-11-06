import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { plannerRepository } from './planner.repository.js'
import { plannerService } from './planner.service.js'
import { wearWeatherRepository } from './wear-weather.repository.js'

const userId = '000000000000000000000001'
const outfitId = '000000000000000000000002'
const plannerWeekId = '000000000000000000000004'
const weekStartsOn = '2026-11-02'
const location = { weatherLatitude: 37.57, weatherLongitude: 126.98 }

type StoredEntry = {
  date: Date
  outfitId: string | null
  title: string | null
  weatherLatitude?: number | null
  weatherLongitude?: number | null
  wornAt?: Date | null
  wearFeeling?: string | null
  wearTemperatureC?: number | null
}

/** 실제 서비스 이동과 저장소 upsert를 연결하되, 날짜별 상태와 마지막 지역은 메모리에만 저장한다. */
function installMoveFixture(t: TestContext, entries: StoredEntry[], savedLocation: typeof location | null = location) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-04T03:00:00Z') })
  const week = () => ({ id: plannerWeekId, userId, entries })
  t.mock.method(plannerRepository, 'findWeek', async (owner: string) => {
    assert.equal(owner, userId)
    return week() as unknown as NonNullable<Awaited<ReturnType<typeof plannerRepository.findWeek>>>
  })
  const readLocation = t.mock.method(wearWeatherRepository, 'getLocation', async (owner: string) => {
    assert.equal(owner, userId)
    return savedLocation
  })
  const transaction = {
    aiLease: { upsert: async () => ({}) },
    plannerWeek: { findUnique: async () => week() },
    outfit: { findMany: async (input: { where: { userId: string; id: { in: string[] } } }) => {
      assert.equal(input.where.userId, userId)
      return input.where.id.in.map((id) => ({ id, items: [], generations: [] }))
    } },
    plannerEntry: {
      findMany: async () => entries.map((entry) => ({ ...entry })),
      upsert: async (input: { where: { plannerWeekId_date: { date: Date } }; update: Partial<StoredEntry>; create: StoredEntry }) => {
        const previous = entries.find((entry) => entry.date.getTime() === input.where.plannerWeekId_date.date.getTime())
        if (previous) {
          // Prisma는 undefined인 갱신 필드를 쓰지 않는다. 지난 날짜의 좌표 보존도 같은 조건으로 확인한다.
          Object.assign(previous, Object.fromEntries(Object.entries(input.update).filter(([, value]) => value !== undefined)))
        } else {
          entries.push({ ...input.create })
        }
        return {}
      },
    },
  } as unknown as Prisma.TransactionClient
  const original = prisma.$transaction
  prisma.$transaction = (async (run: (client: Prisma.TransactionClient) => Promise<unknown>) => run(transaction)) as typeof original
  t.after(() => { prisma.$transaction = original })
  return { entries, readLocation }
}

test('미확정 코디를 빈 오늘 날짜로 이동하면 마지막 날씨 지역을 연결한다', async (t) => {
  const fixture = installMoveFixture(t, [{ date: new Date('2026-11-03'), outfitId, title: '옮길 코디', weatherLatitude: 35.16, weatherLongitude: 129.06 }])
  await plannerService.moveEntry(userId, { weekStartsOn, sourceDate: '2026-11-03', targetDate: '2026-11-04' })
  const target = fixture.entries.find((entry) => entry.date.getTime() === Date.parse('2026-11-04'))!
  assert.equal(target.outfitId, outfitId)
  assert.equal(target.weatherLatitude, location.weatherLatitude)
  assert.equal(target.weatherLongitude, location.weatherLongitude)
  assert.equal(target.wornAt, null)
  assert.equal(target.wearFeeling, null)
  assert.equal(fixture.entries[0].wornAt, null)
  assert.equal(fixture.entries[0].wearTemperatureC, null)
  assert.equal(fixture.entries[0].weatherLatitude, 35.16)
  assert.equal(fixture.readLocation.mock.callCount(), 1)
})

test('이동 범위의 중간 날짜가 착용 완료면 이동 전체를 거절한다', async (t) => {
  const entries = [
    { date: new Date('2026-11-02'), outfitId, title: '옮길 코디' },
    {
      date: new Date('2026-11-03'), outfitId: '000000000000000000000003', title: '입은 코디',
      wornAt: new Date('2026-11-03T08:00:00Z'), wearFeeling: 'cold', wearTemperatureC: 12,
    },
  ]
  const before = structuredClone(entries)
  installMoveFixture(t, entries)

  await assert.rejects(
    plannerService.moveEntry(userId, { weekStartsOn, sourceDate: '2026-11-02', targetDate: '2026-11-04' }),
    { code: 'PLANNER_WEAR_CONFIRMED' },
  )
  assert.deepEqual(entries, before)
})

test('미래 빈 날짜로 이동해도 지역을 연결하며 이미 있는 날짜는 현재 허용된 지역으로 갱신한다', async (t) => {
  const fixture = installMoveFixture(t, [
    { date: new Date('2026-11-04'), outfitId, title: '옮길 코디', weatherLatitude: 35.16, weatherLongitude: 129.06 },
    { date: new Date('2026-11-05'), outfitId: null, title: null, weatherLatitude: 35.16, weatherLongitude: 129.06 },
  ])
  await plannerService.moveEntry(userId, { weekStartsOn, sourceDate: '2026-11-04', targetDate: '2026-11-06' })
  for (const entry of fixture.entries) {
    assert.equal(entry.weatherLatitude, location.weatherLatitude)
    assert.equal(entry.weatherLongitude, location.weatherLongitude)
  }
  assert.equal(fixture.entries.find((entry) => entry.date.getTime() === Date.parse('2026-11-06'))!.outfitId, outfitId)
  assert.equal(fixture.readLocation.mock.callCount(), 1)
})

test('지난 날짜끼리 이동하면 현재 지역을 읽지 않고 날짜에 남아 있던 지역을 보존한다', async (t) => {
  const fixture = installMoveFixture(t, [
    { date: new Date('2026-11-02'), outfitId, title: '옮길 코디', weatherLatitude: 35.16, weatherLongitude: 129.06 },
    { date: new Date('2026-11-03'), outfitId: null, title: null, weatherLatitude: 33.5, weatherLongitude: 126.5 },
  ])
  await plannerService.moveEntry(userId, { weekStartsOn, sourceDate: '2026-11-02', targetDate: '2026-11-03' })
  assert.equal(fixture.entries[0].weatherLatitude, 35.16)
  assert.equal(fixture.entries[1].weatherLatitude, 33.5)
  assert.equal(fixture.entries[1].outfitId, outfitId)
  assert.equal(fixture.readLocation.mock.callCount(), 0)
})

test('지난 빈 날짜에는 현재 위치를 소급 연결하지 않는다', async (t) => {
  const fixture = installMoveFixture(t, [{ date: new Date('2026-11-02'), outfitId, title: '옮길 코디', ...location }])
  await plannerService.moveEntry(userId, { weekStartsOn, sourceDate: '2026-11-02', targetDate: '2026-11-03' })
  const target = fixture.entries.find((entry) => entry.date.getTime() === Date.parse('2026-11-03'))!
  assert.equal(target.weatherLatitude, null)
  assert.equal(target.weatherLongitude, null)
  assert.equal(fixture.readLocation.mock.callCount(), 0)
})

test('저장 지역이 없으면 오늘 이후 이동 대상의 오래된 좌표를 비운다', async (t) => {
  const fixture = installMoveFixture(t, [
    { date: new Date('2026-11-04'), outfitId, title: '옮길 코디', ...location },
    { date: new Date('2026-11-05'), outfitId: null, title: null, ...location },
  ], null)
  await plannerService.moveEntry(userId, { weekStartsOn, sourceDate: '2026-11-04', targetDate: '2026-11-05' })
  assert.equal(fixture.entries[1].outfitId, outfitId)
  for (const entry of fixture.entries) {
    assert.equal(entry.weatherLatitude, null)
    assert.equal(entry.weatherLongitude, null)
  }
})
