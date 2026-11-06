import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../../lib/prisma.js'
import { getKoreaTodayUtc } from '../wardrobe/wardrobe.service.js'
import { weatherService } from '../weather/weather.service.js'
import { plannerRepository } from './planner.repository.js'
import { plannerService } from './planner.service.js'
import { ensureWearWeatherStorage, wearWeatherRepository } from './wear-weather.repository.js'
import { recordPendingWearWeather, syncWearWeatherLocation } from './wear-weather.service.js'

test('별도 MongoDB에서 일정 배정·날짜 경과·중복 처리·삭제와 기온 저장을 검증한다', { skip: !process.env.WEAR_WEATHER_INTEGRATION_DATABASE }, async (t) => {
  const database = new URL(process.env.DATABASE_URL!).pathname
  assert.match(database, /^\/closet_wear_weather_test_\d+$/)
  t.after(async () => { await prisma.$runCommandRaw({ dropDatabase: 1 }); await prisma.$disconnect() })
  await ensureWearWeatherStorage()
  const user = await prisma.user.create({ data: { displayName: '착용 날씨 통합 테스트' } })
  const otherUser = await prisma.user.create({ data: { displayName: '다른 테스트 계정' } })
  const items = await Promise.all((['top', 'bottom'] as const).map((category) => prisma.wardrobeItem.create({
    data: { userId: user.id, name: `테스트 ${category}`, category, seasons: ['spring'] },
  })))
  const outfit = await prisma.outfit.create({ data: {
    userId: user.id, name: '테스트 코디', style: 'casual', seasons: ['spring'],
    items: { create: items.map((item, index) => ({ wardrobeItemId: item.id, slot: item.category!, layerOrder: index })) },
  } })
  const today = getKoreaTodayUtc()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const weekStartsOn = yesterday.toISOString().slice(0, 10)
  await syncWearWeatherLocation(user.id, { latitude: 37.5665, longitude: 126.978 })
  await plannerService.setEntry(user.id, { weekStartsOn, date: today.toISOString().slice(0, 10), outfitId: outfit.id })
  const week = await plannerRepository.findWeek(user.id, yesterday)
  assert.ok(week)
  assert.equal(week.entries[0]?.weatherLatitude, 37.57)
  assert.equal(week.entries[0]?.weatherLongitude, 126.98)
  const worn = await prisma.plannerEntry.create({ data: { plannerWeekId: week.id, date: yesterday, wornAt: new Date(), outfitId: outfit.id, weatherLatitude: 37.57, weatherLongitude: 126.98, temperatureC: 99 } })
  const unconfirmed = await prisma.plannerEntry.create({ data: { plannerWeekId: week.id, date: new Date(yesterday.getTime() - 86_400_000), outfitId: outfit.id, weatherLatitude: 37.57, weatherLongitude: 126.98 } })
  const future = await prisma.plannerEntry.create({ data: { plannerWeekId: week.id, date: tomorrow, outfitId: outfit.id, weatherLatitude: 37.57, weatherLongitude: 126.98 } })
  const otherWeek = await prisma.plannerWeek.create({ data: { userId: otherUser.id, weekStartsOn: yesterday } })
  const otherEntry = await prisma.plannerEntry.create({ data: { plannerWeekId: otherWeek.id, date: today, weatherLatitude: 10, weatherLongitude: 20 } })
  await syncWearWeatherLocation(user.id, { latitude: 35.1796, longitude: 129.0756 })
  assert.equal((await prisma.plannerEntry.findUniqueOrThrow({ where: { id: worn.id } })).weatherLatitude, 37.57)
  assert.equal((await prisma.plannerEntry.findUniqueOrThrow({ where: { id: future.id } })).weatherLatitude, 35.18)
  assert.equal((await prisma.plannerEntry.findUniqueOrThrow({ where: { id: otherEntry.id } })).weatherLatitude, 10)
  const provider = t.mock.method(weatherService, 'getPastDailyTemperature', async () => 16.2)
  const concurrent = await Promise.all([recordPendingWearWeather(), recordPendingWearWeather()])
  assert.equal(concurrent.reduce((sum, count) => sum + count, 0), 1)
  assert.equal(await recordPendingWearWeather(), 0)
  assert.equal(provider.mock.callCount(), 1)
  const stored = await prisma.plannerEntry.findUniqueOrThrow({ where: { id: worn.id } })
  assert.equal(stored.temperatureC, 99)
  assert.equal(stored.wearTemperatureC, 16.2)
  assert.ok(stored.wearWeatherRecordedAt)
  assert.equal((await prisma.plannerEntry.findUniqueOrThrow({ where: { id: future.id } })).wearTemperatureC, null)
  assert.equal((await prisma.plannerEntry.findUniqueOrThrow({ where: { id: unconfirmed.id } })).wearTemperatureC, null)
  const records = await plannerService.getOutfitWearHistory(user.id, [outfit.id])
  assert.equal(records.find((record) => record.date.getTime() === yesterday.getTime())?.wearTemperatureC, 16.2)
  assert.deepEqual(await plannerService.getOutfitWearHistory(otherUser.id, [outfit.id]), [])
  const wornDate = yesterday.toISOString().slice(0, 10)
  await assert.rejects(plannerService.clearEntry(user.id, weekStartsOn, wornDate), { code: 'PLANNER_WEAR_CONFIRMED' })
  assert.equal((await prisma.plannerEntry.findUniqueOrThrow({ where: { id: worn.id } })).wearTemperatureC, 16.2)
  await plannerService.setEntryWorn(user.id, { weekStartsOn, date: wornDate, outfitId: outfit.id, worn: false })
  await plannerService.clearEntry(user.id, weekStartsOn, wornDate)
  assert.equal((await plannerService.getOutfitWearHistory(user.id, [outfit.id])).some((record) => record.date.getTime() === yesterday.getTime()), false)
  await syncWearWeatherLocation(user.id, null)
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).wearWeatherLatitude, null)
  assert.equal((await prisma.plannerEntry.findUniqueOrThrow({ where: { id: future.id } })).weatherLatitude, null)
  assert.equal((await prisma.plannerEntry.findUniqueOrThrow({ where: { id: worn.id } })).weatherLatitude, 37.57)
  const race = { ...stored, outfitId: outfit.id }
  await prisma.plannerEntry.update({ where: { id: worn.id }, data: { wearTemperatureC: null } })
  assert.equal(await wearWeatherRepository.record(race, 22, new Date()), false)
})
