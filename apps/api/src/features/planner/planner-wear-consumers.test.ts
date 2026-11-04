import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../../lib/prisma.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { statisticsService } from '../catalog/statistics.service.js'
import { plannerRepository } from './planner.repository.js'
import { wearWeatherRepository } from './wear-weather.repository.js'

test('옷별 이력·통계·최근 착용·날씨는 DB 조회부터 실제 착용을 확인한 일정만 읽는다', async (t) => {
  const reads: Array<{ where: Record<string, unknown> }> = []
  const plannerFindMany = prisma.plannerEntry.findMany
  const wardrobeFindMany = prisma.wardrobeItem.findMany
  const outfitFindMany = prisma.outfit.findMany
  prisma.plannerEntry.findMany = (async (args: { where: Record<string, unknown> }) => { reads.push(args); return [] }) as unknown as typeof plannerFindMany
  prisma.wardrobeItem.findMany = (async () => []) as unknown as typeof wardrobeFindMany
  prisma.outfit.findMany = (async () => []) as unknown as typeof outfitFindMany
  t.after(() => {
    prisma.plannerEntry.findMany = plannerFindMany
    prisma.wardrobeItem.findMany = wardrobeFindMany
    prisma.outfit.findMany = outfitFindMany
  })
  const today = new Date('2026-11-04')
  const userId = '000000000000000000000001'
  await wardrobeRepository.findWearHistory(userId, today)
  await statisticsService.get(userId)
  await plannerRepository.findRecentWearHistory(userId, ['000000000000000000000002'], new Date('2026-11-01'), today, today)
  await wearWeatherRepository.pending(today, new Date())
  assert.equal(reads.length, 4)
  for (const read of reads) assert.deepEqual(read.where.wornAt, { isSet: true, not: null })
  for (const read of reads.slice(0, 3)) assert.deepEqual(read.where.plannerWeek, { is: { userId } })
})
