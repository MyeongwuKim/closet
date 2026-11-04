import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { plannerRepository } from './planner.repository.js'

function installTransaction(t: TestContext, lockCount = 1) {
  const writes: string[] = []
  const entryWrites: Array<Record<string, any>> = []
  const source = { id: 'outfit', userId: 'viewer', name: '저장 코디', style: 'casual', source: 'ai', seasons: ['spring'], note: null, plannerOnly: false,
    items: [{ wardrobeItemId: 'top', slot: 'top', layerOrder: 0 }, { wardrobeItemId: 'bottom', slot: 'bottom', layerOrder: 1 }],
    generations: [{ imageAssetId: 'shared-image', status: 'completed', requestedAt: new Date(), model: 'test', imageAsset: { id: 'shared-image' } }],
  }
  const transaction = {
    aiLease: { upsert: async () => ({}) },
    wardrobeItem: {
      findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id, archivedAt: null, updatedAt: new Date(0), displayImageAssetId: null, originalImageAssetId: null }),
    },
    plannerWeek: { findUnique: async (input: { select?: unknown }) => input.select ? { userId: 'viewer' } : { id: 'week', entries: [] } },
    outfit: { findFirst: async (input: { where: { userId: string } }) => { assert.equal(input.where.userId, 'viewer'); return source },
      update: async () => { writes.push('lock-source'); return source },
      create: async () => { writes.push('copy-outfit'); return { id: 'date-snapshot' } },
      findMany: async (input: { where: { userId: string; id: { in: string[] } } }) => {
      assert.equal(input.where.userId, 'viewer')
      return input.where.id.in.map((id) => ({ id, items: source.items, generations: [{ imageAssetId: 'shared-image' }] }))
    } },
    imageAsset: { findFirst: async () => ({ updatedAt: new Date(0) }), updateMany: async () => { writes.push('lock-image'); return { count: lockCount } } },
    plannerEntry: {
      findUnique: async () => null,
      findMany: async () => [],
      upsert: async (input: Record<string, any>) => { writes.push('save-entry'); entryWrites.push(input); return {} },
    },
  } as unknown as Prisma.TransactionClient
  const original = prisma.$transaction
  const execute = t.mock.fn(async (operation: unknown) => (operation as (tx: Prisma.TransactionClient) => Promise<unknown>)(transaction))
  prisma.$transaction = execute as typeof prisma.$transaction
  t.after(() => { prisma.$transaction = original })
  return { writes, execute, entryWrites }
}

test('고아 삭제와 같은 이미지 row를 먼저 잠그고 동일 트랜잭션 안에서 플래너 배정을 만든다', async (t) => {
  const { writes, execute, entryWrites } = installTransaction(t)
  await plannerRepository.setEntry({ plannerWeekId: 'week', date: new Date('2026-11-04'), outfitId: 'outfit' })
  assert.deepEqual(writes, ['lock-source', 'lock-image', 'copy-outfit', 'save-entry'])
  assert.equal(entryWrites[0].create.outfitId, 'date-snapshot')
  assert.notEqual(entryWrites[0].create.outfitId, 'outfit')
  assert.equal(execute.mock.callCount(), 1)
})

test('이미 삭제 claim된 이미지에는 플래너 참조를 새로 만들지 않는다', async (t) => {
  const { writes } = installTransaction(t, 0)
  await assert.rejects(plannerRepository.setEntry({ plannerWeekId: 'week', date: new Date('2026-11-04'), outfitId: 'outfit' }))
  assert.deepEqual(writes, ['lock-source', 'lock-image'])
})

test('일정을 이동할 때 공유 이미지를 한 번 잠근 뒤 양쪽 배정을 저장한다', async (t) => {
  const { writes, execute } = installTransaction(t)
  await plannerRepository.moveEntryOutfits({ plannerWeekId: 'week', entries: [
    { date: new Date('2026-11-04'), outfitId: 'outfit-a', title: '코디 A' },
    { date: new Date('2026-11-05'), outfitId: 'outfit-b', title: '코디 B' },
  ] })
  assert.deepEqual(writes, ['lock-image', 'save-entry', 'save-entry'])
  assert.equal(execute.mock.callCount(), 1)
})
