import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { outfitRepository, type CreateOutfitData } from './outfit.repository.js'
import { createOutfitSnapshot } from './planner-outfit-snapshot.js'
import { previewJobRepository } from './preview-job.repository.js'
import { plannerRepository } from '../planner/planner.repository.js'
import { wardrobeRepository, type CreateWardrobeItemData } from '../wardrobe/wardrobe.repository.js'

const outfitData: CreateOutfitData = {
  userId: 'viewer', name: '저장 코디', style: 'casual', seasons: ['autumn'], source: 'manual',
  items: [{ wardrobeItemId: 'top', slot: 'top', layerOrder: 0 }],
}

/** 호출부가 실제 보호 함수를 같은 트랜잭션에서 거치도록 옷·사진 상태와 쓰기 순서를 기록한다. 외부 저장·삭제는 하지 않는다. */
function installFixture(t: TestContext, options: { archived?: boolean; live?: boolean; deleting?: boolean; missing?: boolean; mutexFailure?: boolean } = {}) {
  const calls: string[] = []
  const now = new Date('2026-11-05T00:00:00.000Z')
  const source = { ...outfitData, id: 'source', plannerOnly: false, note: null, generations: [] }
  const tx = {
    wardrobeItem: {
      findFirst: async ({ where }: { where: { id: string; OR?: unknown } }) => {
        calls.push(`read-item:${where.id}`)
        if (options.missing || (options.archived && where.OR)) return null
        return { id: where.id, updatedAt: now, archivedAt: options.archived ? now : null, displayImageAssetId: 'photo', originalImageAssetId: null }
      },
      updateMany: async () => { assert.fail('참조 잠금은 원본 옷의 updatedAt을 바꾸면 안 됩니다.') },
      create: async () => { calls.push('create-item'); return {} },
    },
    imageAsset: {
      findFirst: async () => { calls.push('read-photo'); return options.deleting ? null : { id: 'photo', updatedAt: now } },
      updateMany: async () => { assert.fail('참조 잠금은 원본 사진의 updatedAt을 바꾸면 안 됩니다.') },
    },
    outfitItem: { findFirst: async () => { calls.push('read-live-reference'); return options.live ? { id: 'existing-reference' } : null } },
    outfit: {
      findFirst: async () => source,
      findUniqueOrThrow: async () => source,
      update: async () => { calls.push('update-outfit'); return source },
      create: async () => { calls.push('create-outfit'); return { id: 'snapshot' } },
      findMany: async () => [source],
    },
    plannerWeek: { findUnique: async () => ({ userId: 'viewer' }) },
    plannerEntry: {
      findUnique: async () => null,
      findMany: async () => [],
      upsert: async () => { calls.push('save-date'); return {} },
    },
    aiLease: { upsert: async ({ where }: { where: { id: string } }) => {
      if (where.id.startsWith('wardrobe-image:')) {
        calls.push(`mutex:${where.id}`)
        if (options.mutexFailure) throw new Error('사진 참조 잠금 실패')
      }
      return {}
    } },
    aiPreviewJob: { findFirst: async () => null, count: async () => 0, create: async () => { calls.push('create-job'); return {} } },
    aiCreditWallet: { findUnique: async () => { calls.push('reserve-credit'); throw new Error('사용권 예약까지 진행되면 안 됩니다.') } },
  }
  const original = prisma.$transaction
  prisma.$transaction = (async (operation: (client: Prisma.TransactionClient) => Promise<unknown>) => {
    calls.push('begin')
    const result = await operation(tx as unknown as Prisma.TransactionClient)
    calls.push('commit')
    return result
  }) as typeof original
  t.after(() => { prisma.$transaction = original })
  return { calls, tx: tx as unknown as Prisma.TransactionClient }
}

test('코디 저장은 정리 중인 옷 사진을 발견하면 코디를 쓰지 않고 거절한다', async (t) => {
  const { calls } = installFixture(t, { deleting: true })
  await assert.rejects(outfitRepository.create(outfitData), { code: 'INVALID_WARDROBE_IMAGE' })
  assert.ok(calls.includes('mutex:wardrobe-image:item:top'))
  assert.ok(calls.includes('mutex:wardrobe-image:asset:photo'))
  assert.equal(calls.includes('create-outfit'), false)
  assert.equal(calls.includes('commit'), false)
})

test('코디 수정의 옷 잠금이 실패하면 구성과 사진을 갱신하지 않는다', async (t) => {
  const { calls } = installFixture(t, { mutexFailure: true })
  await assert.rejects(outfitRepository.update('source', { ...outfitData, resetGenerations: false }), { message: '사진 참조 잠금 실패' })
  assert.equal(calls.includes('update-outfit'), false)
  assert.equal(calls.includes('commit'), false)
})

test('같은 사진을 새 옷에 연결할 때도 정리 중이면 옷을 만들지 않는다', async (t) => {
  const { calls } = installFixture(t, { deleting: true })
  await assert.rejects(wardrobeRepository.create({ userId: 'viewer', name: '새 옷', displayImageAssetId: 'photo', additionalCategories: [], seasons: [], tags: [] } as CreateWardrobeItemData), { code: 'INVALID_WARDROBE_IMAGE' })
  assert.ok(calls.includes('mutex:wardrobe-image:asset:photo'))
  assert.equal(calls.includes('create-item'), false)
})

test('새 직접 배정은 다른 기록에서 사용하는 삭제 옷이어도 다시 추가하지 않는다', async (t) => {
  const { calls } = installFixture(t, { archived: true, live: true })
  await assert.rejects(plannerRepository.setEntry({ plannerWeekId: 'week', date: new Date('2026-11-02'), outfitData }), { code: 'INVALID_OUTFIT_ITEMS' })
  assert.equal(calls.includes('read-live-reference'), false)
  assert.equal(calls.includes('create-outfit'), false)
  assert.equal(calls.includes('save-date'), false)
})

test('기존 코디의 삭제 옷은 살아 있는 참조와 옷·사진 잠금을 확인한 뒤 날짜 복사본에 보존한다', async (t) => {
  const { calls } = installFixture(t, { archived: true, live: true })
  await plannerRepository.setEntry({ plannerWeekId: 'week', date: new Date('2026-11-02'), outfitId: 'source' })
  assert.ok(calls.includes('mutex:wardrobe-image:item:top'))
  assert.ok(calls.includes('mutex:wardrobe-image:asset:photo'))
  assert.ok(calls.indexOf('mutex:wardrobe-image:asset:photo') < calls.indexOf('create-outfit'))
  assert.ok(calls.indexOf('read-live-reference') < calls.indexOf('create-outfit'))
  assert.ok(calls.includes('save-date'))
  assert.equal(calls.at(-1), 'commit')
})

test('어느 날짜에도 없는 삭제 옷은 옛 복사본 ID가 있어도 다시 연결하지 않는다', async (t) => {
  const { calls } = installFixture(t, { archived: true, live: false })
  await plannerRepository.setEntry({ plannerWeekId: 'week', date: new Date('2026-11-02'), outfitId: 'source' }).then(
    () => assert.fail('고아 삭제 옷 연결은 거절해야 합니다.'),
    (error: unknown) => assert.equal((error as { code: string }).code, 'INVALID_OUTFIT_ITEMS'),
  )
  assert.equal(calls.includes('save-date'), false)
})

test('사진 정리 claim이 먼저 끝났으면 기존 참조를 복사하는 경로도 차단한다', async (t) => {
  const { calls, tx } = installFixture(t, { archived: true, live: true, deleting: true })
  await assert.rejects(createOutfitSnapshot(tx, outfitData, true), { code: 'INVALID_WARDROBE_IMAGE' })
  assert.equal(calls.includes('create-outfit'), false)
})

test('새 AI 작업은 삭제된 옷이면 사용권을 예약하거나 큐에 넣기 전에 거절한다', async (t) => {
  const { calls } = installFixture(t, { archived: true, live: true })
  await assert.rejects(previewJobRepository.enqueue({ id: 'request', userId: 'viewer', requestKey: 'request', inputKey: 'input', fingerprint: 'fingerprint', selectedItemIds: ['top'], style: null }), { code: 'INVALID_OUTFIT_ITEMS' })
  assert.equal(calls.includes('reserve-credit'), false)
  assert.equal(calls.includes('create-job'), false)
})
