import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../../lib/prisma.js'
import { getKoreaTodayUtc } from '../wardrobe/wardrobe.service.js'
import { weatherService } from '../weather/weather.service.js'
import { wearWeatherRepository } from './wear-weather.repository.js'
import { recordPendingWearWeather, syncWearWeatherLocation } from './wear-weather.service.js'

const userId = '000000000000000000000001'
const entry = { id: '000000000000000000000002', date: new Date('2026-11-02'), wornAt: new Date('2026-11-02T10:00:00Z'), outfitId: '000000000000000000000003', weatherLatitude: 37.57, weatherLongitude: 126.98 }

test('위치는 지역 단위로 저장하고 계정 소유의 이후 일정만 연결한다', async (t) => {
  let saved: unknown[] = []
  t.mock.method(wearWeatherRepository, 'saveLocation', async (...args: unknown[]) => { saved = args })
  await syncWearWeatherLocation(userId, { latitude: 37.566534, longitude: 126.978045 })
  assert.equal(saved[0], userId)
  assert.deepEqual(saved[1], { latitude: 37.57, longitude: 126.98 })
  assert.equal((saved[2] as Date).getTime(), getKoreaTodayUtc().getTime())
  await assert.rejects(syncWearWeatherLocation(userId, { latitude: NaN, longitude: 126 }))
  await syncWearWeatherLocation(userId, null)
  assert.equal(saved[1], null)
})

test('한국 날짜가 지난 뒤 남아 있는 코디만 평균 기온을 확정한다', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T14:59:00Z') })
  const stored = { ...entry, temperatureC: null as number | null }
  t.mock.method(wearWeatherRepository, 'pending', async (today: Date) => stored.date < today && stored.temperatureC === null ? [stored] : [])
  t.mock.method(wearWeatherRepository, 'claim', async () => true)
  let providerCalls = 0
  t.mock.method(weatherService, 'getPastDailyTemperature', async (input: { date: string }) => { providerCalls++; assert.equal(input.date, '2026-11-02'); return 16.2 })
  t.mock.method(wearWeatherRepository, 'record', async (_entry: unknown, temperature: number) => { stored.temperatureC = temperature; return true })
  assert.equal(await recordPendingWearWeather(), 0)
  assert.equal(providerCalls, 0)
  t.mock.timers.tick(2 * 60_000)
  assert.equal(await recordPendingWearWeather(), 1)
  assert.equal(stored.temperatureC, 16.2)
  assert.equal(await recordPendingWearWeather(), 0)
  assert.equal(providerCalls, 1)
})

test('날씨 실패는 예보를 저장하지 않으며 임대되지 않은 기록도 처리하지 않는다', async (t) => {
  t.mock.method(wearWeatherRepository, 'pending', async () => [entry])
  t.mock.method(wearWeatherRepository, 'claim', async () => true)
  const provider = t.mock.method(weatherService, 'getPastDailyTemperature', async () => { throw new Error('provider unavailable') })
  const record = t.mock.method(wearWeatherRepository, 'record', async () => true)
  assert.equal(await recordPendingWearWeather(), 0)
  assert.equal(record.mock.callCount(), 0)
  t.mock.method(wearWeatherRepository, 'claim', async () => false)
  assert.equal(await recordPendingWearWeather(), 0)
  assert.equal(provider.mock.callCount(), 1)
})

test('같은 지역·날짜의 여러 착용 기록은 날씨 조회를 공유한다', async (t) => {
  t.mock.method(wearWeatherRepository, 'pending', async () => [entry, { ...entry, id: '000000000000000000000004' }])
  t.mock.method(wearWeatherRepository, 'claim', async () => true)
  const provider = t.mock.method(weatherService, 'getPastDailyTemperature', async () => 0)
  const record = t.mock.method(wearWeatherRepository, 'record', async () => true)
  assert.equal(await recordPendingWearWeather(), 2)
  assert.equal(provider.mock.callCount(), 1)
  assert.equal(record.mock.callCount(), 2)
})

test('DB 조회는 오늘·미래·삭제한 코디와 재시도 대기 기록을 제외한다', async (t) => {
  let where: unknown
  const original = prisma.plannerEntry.findMany
  prisma.plannerEntry.findMany = (async (args: { where: unknown }) => { where = args.where; return [] }) as unknown as typeof original
  t.after(() => { prisma.plannerEntry.findMany = original })
  const today = getKoreaTodayUtc()
  await wearWeatherRepository.pending(today, new Date())
  const filter = where as { date: { lt: Date }; wornAt: unknown; outfitId: { not: null }; AND: unknown[] }
  assert.deepEqual(filter.wornAt, { isSet: true, not: null })
  assert.deepEqual(filter.date, { lt: today })
  assert.deepEqual(filter.outfitId, { not: null })
  assert.match(JSON.stringify(filter.AND), /isSet/)
  assert.match(JSON.stringify(filter.AND), /wearWeatherRetryAt/)
})

test('기온 저장은 조회 중 삭제·재배정·지역 변경과 기존 기록 덮어쓰기를 막는다', async (t) => {
  let filter: unknown
  const original = prisma.plannerEntry.updateMany
  prisma.plannerEntry.updateMany = (async (args: { where: unknown }) => { filter = args.where; return { count: 0 } }) as unknown as typeof original
  t.after(() => { prisma.plannerEntry.updateMany = original })
  assert.equal(await wearWeatherRepository.record(entry, 18, new Date()), false)
  assert.deepEqual(filter, { id: entry.id, outfitId: entry.outfitId, date: entry.date, wornAt: entry.wornAt, weatherLatitude: entry.weatherLatitude, weatherLongitude: entry.weatherLongitude, OR: [{ wearTemperatureC: null }, { wearTemperatureC: { isSet: false } }] })
})

test('착용이 미확정이거나 취소된 일정은 날씨 제공자를 호출하지 않는다', async (t) => {
  t.mock.method(wearWeatherRepository, 'pending', async () => [{ ...entry, wornAt: null }])
  const claim = t.mock.method(wearWeatherRepository, 'claim', async () => true)
  const provider = t.mock.method(weatherService, 'getPastDailyTemperature', async () => 18)
  assert.equal(await recordPendingWearWeather(), 0)
  assert.equal(claim.mock.callCount(), 0)
  assert.equal(provider.mock.callCount(), 0)
  assert.equal(await wearWeatherRepository.record({ ...entry, wornAt: null }, 18, new Date()), false)
})
