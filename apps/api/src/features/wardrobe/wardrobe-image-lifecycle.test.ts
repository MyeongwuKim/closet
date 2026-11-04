import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma } from '@prisma/client'
import { lockWardrobeImagesForReference, lockWardrobeItemsForReference } from './wardrobe-image-lifecycle.js'

function transaction(options: { archived?: boolean; liveReference?: boolean; unavailableImage?: boolean; mutexConflict?: boolean } = {}) {
  const writes: string[] = []
  const before = new Date(Date.now() + 60_000)
  const tx = {
    aiLease: {
      upsert: async (input: { where: { id: string } }) => {
        const kind = input.where.id.includes(':item:') ? 'item' : 'photo'
        writes.push(kind)
        if (options.mutexConflict) throw Object.assign(new Error('다른 트랜잭션이 먼저 연결을 바꿨습니다.'), { code: 'P2034' })
        return {}
      },
    },
    wardrobeItem: {
      findFirst: async () => ({ id: 'shirt', archivedAt: options.archived ? before : null, updatedAt: before, displayImageAssetId: 'photo', originalImageAssetId: 'photo' }),
    },
    outfitItem: { findFirst: async () => options.liveReference ? { id: 'live-outfit-item' } : null },
    imageAsset: {
      findFirst: async () => options.unavailableImage ? null : { id: 'photo', updatedAt: before },
    },
  } as unknown as Prisma.TransactionClient
  return { tx, writes }
}

test('새 코디 연결은 옷과 원본·표시 공용 사진을 한 번씩 잠근다', async () => {
  const { tx, writes } = transaction()
  await lockWardrobeItemsForReference(tx, 'owner', ['shirt', 'shirt'])
  assert.deepEqual(writes, ['item', 'photo'])
})

test('삭제한 옷은 새 코디에 넣지 않고 이미 살아 있는 기록을 복사할 때만 허용한다', async () => {
  const newReference = transaction({ archived: true, liveReference: true })
  await assert.rejects(lockWardrobeItemsForReference(newReference.tx, 'owner', ['shirt']), { code: 'INVALID_OUTFIT_ITEMS' })
  assert.deepEqual(newReference.writes, ['item'])

  const snapshot = transaction({ archived: true, liveReference: true })
  await lockWardrobeItemsForReference(snapshot.tx, 'owner', ['shirt'], { allowArchived: true })
  assert.deepEqual(snapshot.writes, ['item', 'photo'])
})

test('정리된 삭제 옷을 숨은 고아 코디로 다시 연결하지 않는다', async () => {
  const { tx, writes } = transaction({ archived: true, liveReference: false })
  await assert.rejects(lockWardrobeItemsForReference(tx, 'owner', ['shirt'], { allowArchived: true }), { code: 'INVALID_OUTFIT_ITEMS' })
  assert.deepEqual(writes, ['item'])
})

test('다른 트랜잭션과 잠금이 충돌하면 사진에 연결하지 않는다', async () => {
  const { tx, writes } = transaction({ mutexConflict: true })
  await assert.rejects(lockWardrobeItemsForReference(tx, 'owner', ['shirt']), { code: 'P2034' })
  assert.deepEqual(writes, ['item'])
})

test('삭제 중·접근 불가 사진은 새 옷에서도 연결할 수 없다', async () => {
  const { tx, writes } = transaction({ unavailableImage: true })
  await assert.rejects(lockWardrobeImagesForReference(tx, 'owner', ['photo']), { code: 'INVALID_WARDROBE_IMAGE' })
  assert.deepEqual(writes, ['photo'])
})

test('옷이나 사진이 없는 기존 기록은 불필요한 DB 접근 없이 통과한다', async () => {
  await lockWardrobeItemsForReference({} as Prisma.TransactionClient, 'owner', [])
  await lockWardrobeImagesForReference({} as Prisma.TransactionClient, 'owner', [])
})
