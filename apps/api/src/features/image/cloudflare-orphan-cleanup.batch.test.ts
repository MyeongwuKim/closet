import assert from 'node:assert/strict'
import test from 'node:test'
import type { ImageAsset } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { cloudflareCleanupCursorRepository, type CloudflareCleanupCursor } from './cloudflare-cleanup-cursor.repository.js'
import { createCloudflareOrphanCleanupBatch } from './cloudflare-orphan-cleanup.batch.js'
import { createCloudflareOrphanCleanupService } from './cloudflare-orphan-cleanup.service.js'

const now = new Date('2026-11-04T12:00:00Z')
const userId = '0123456789abcdef01234567'
const image = (id: string) => ({ id, uploaded: '2026-11-01T00:00:00Z', meta: { userId, kind: 'outfitGenerated', storageFilename: 'closet_dev_test.png' } })

function cursorStore(initial: CloudflareCleanupCursor = { revision: 0 }) {
  let value = initial
  let writes = 0
  return {
    readCursor: async () => ({ ...value }),
    advanceCursor: async (previous: CloudflareCleanupCursor, continuationToken?: string) => {
      if (previous.revision !== value.revision) return false
      value = { continuationToken, revision: value.revision + 1 }
      writes++
      return true
    },
    current: () => value,
    writes: () => writes,
  }
}

test('프로세스가 바뀌어도 1만 개 보존 파일 뒤의 고아부터 이어서 정리하고 끝에서 처음으로 순환한다', async () => {
  const cursor = cursorStore()
  const starts: Array<string | undefined> = []
  const deleted: string[] = []
  const service = createCloudflareOrphanCleanupService({
    listImages: async (token) => {
      starts.push(token)
      const page = token ? Number(token.slice(1)) : 0
      return page < 10
        ? { images: Array.from({ length: 1000 }, (_, index) => image(`saved-${page}-${index}`)), continuationToken: `p${page + 1}` }
        : { images: [image('orphan-on-page-11')] }
    },
    hasDatabaseAsset: async (id) => id.startsWith('saved-'),
    hasActiveJob: async () => false,
    createDeletionClaim: async (candidate) => ({ asset: { cloudflareImageId: candidate.remoteId } as ImageAsset, leaseUntil: now }),
    removeClaim: async () => ({ count: 1 }), releaseClaim: async () => undefined,
    deleteImage: async (id) => { deleted.push(id) },
  })
  const first = await createCloudflareOrphanCleanupBatch({ ...cursor, cleanup: service.cleanup }).cleanup({ execute: true, now })
  assert.equal(first.scannedCount, 10_000)
  assert.equal(first.stopReason, 'max-pages')
  assert.equal(cursor.current().continuationToken, 'p10')
  // 새 실행기를 만들어 메모리가 초기화되는 Cloud Run Job의 다음 실행을 흉내 낸다.
  const second = await createCloudflareOrphanCleanupBatch({ ...cursor, cleanup: service.cleanup }).cleanup({ execute: true, now })
  assert.deepEqual(deleted, ['orphan-on-page-11'])
  assert.equal(second.pagesRead, 1)
  assert.equal(starts[10], 'p10')
  assert.equal(cursor.current().continuationToken, undefined)
  assert.equal(cursor.current().revision, 2)
})

test('한 페이지 중간에서 삭제 한도에 닿으면 남은 후보를 건너뛰지 않고 같은 페이지부터 재개한다', async () => {
  const cursor = cursorStore({ revision: 1, continuationToken: 'page-two' })
  const remaining = new Set(['one', 'two', 'three'])
  const starts: Array<string | undefined> = []
  const service = createCloudflareOrphanCleanupService({
    listImages: async (token) => { starts.push(token); return { images: [...remaining].map(image), continuationToken: 'page-three' } },
    hasDatabaseAsset: async () => false, hasActiveJob: async () => false,
    createDeletionClaim: async (candidate) => ({ asset: { cloudflareImageId: candidate.remoteId } as ImageAsset, leaseUntil: now }),
    removeClaim: async () => ({ count: 1 }), releaseClaim: async () => undefined,
    deleteImage: async (id) => { remaining.delete(id) },
  })
  const batch = () => createCloudflareOrphanCleanupBatch({ ...cursor, cleanup: service.cleanup })
  const first = await batch().cleanup({ execute: true, maxPages: 1, limit: 2, now })
  assert.equal(first.stopReason, 'limit')
  assert.equal(cursor.current().continuationToken, 'page-two')
  await batch().cleanup({ execute: true, maxPages: 1, limit: 2, now })
  assert.deepEqual(starts, ['page-two', 'page-two'])
  assert.equal(remaining.size, 0)
  assert.equal(cursor.current().continuationToken, 'page-three')
})

test('조회 전용·삭제 실패·반복 페이지는 진행점을 바꾸지 않는다', async () => {
  for (const mode of ['dry-run', 'failure', 'repeat'] as const) {
    const cursor = cursorStore({ revision: 3, continuationToken: 'saved-page' })
    const service = createCloudflareOrphanCleanupService({
      listImages: async () => ({ images: [image('orphan')], ...(mode === 'repeat' ? { continuationToken: 'saved-page' } : {}) }),
      hasDatabaseAsset: async () => false, hasActiveJob: async () => false,
      createDeletionClaim: async () => ({ asset: {} as ImageAsset, leaseUntil: now }),
      removeClaim: async () => ({ count: 1 }), releaseClaim: async () => undefined,
      deleteImage: async () => { if (mode === 'failure') throw new Error('CF unavailable') },
    })
    const result = await createCloudflareOrphanCleanupBatch({ ...cursor, cleanup: service.cleanup }).cleanup({ execute: mode !== 'dry-run', now })
    assert.equal(result.checkpointSaved, false)
    assert.equal(cursor.writes(), 0)
    assert.deepEqual(cursor.current(), { revision: 3, continuationToken: 'saved-page' })
  }
})

test('겹친 배치의 늦은 완료는 더 최신인 진행점을 덮어쓰지 않는다', async () => {
  const cursor = cursorStore()
  const service = createCloudflareOrphanCleanupService({
    listImages: async () => ({ images: [], continuationToken: 'next' }),
    hasDatabaseAsset: async () => false, hasActiveJob: async () => false,
    createDeletionClaim: async () => { throw new Error('no candidates') },
    removeClaim: async () => ({ count: 1 }), releaseClaim: async () => undefined, deleteImage: async () => undefined,
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const slow = createCloudflareOrphanCleanupBatch({ ...cursor, cleanup: async (options) => { await gate; return service.cleanup(options) } })
  const pending = slow.cleanup({ execute: true, maxPages: 1, now })
  await Promise.resolve()
  await createCloudflareOrphanCleanupBatch({ ...cursor, cleanup: service.cleanup }).cleanup({ execute: true, maxPages: 1, now })
  release()
  assert.equal((await pending).checkpointSaved, false)
  assert.equal(cursor.current().revision, 1)
  assert.equal(cursor.writes(), 1)
})

test('실제 진행점 adapter는 계정별 키와 revision으로 저장하고 최초 생성 충돌을 무시한다', async (t) => {
  const repository = prisma.cloudflareCleanupCursor
  const original = { findUnique: repository.findUnique, updateMany: repository.updateMany, create: repository.create }
  const calls: unknown[] = []
  repository.findUnique = (async () => ({ continuationToken: 'next-page', revision: 7 })) as unknown as typeof original.findUnique
  repository.updateMany = (async (args: unknown) => { calls.push(args); return { count: 0 } }) as unknown as typeof original.updateMany
  repository.create = (async () => { throw { code: 'P2002' } }) as unknown as typeof original.create
  t.after(() => { Object.assign(repository, original) })
  const cursor = await cloudflareCleanupCursorRepository.read('account-one')
  assert.deepEqual(cursor, { continuationToken: 'next-page', revision: 7 })
  assert.equal(await cloudflareCleanupCursorRepository.advance('account-one', cursor), false)
  assert.deepEqual(calls[0], { where: { id: 'account-one', revision: 7 }, data: { continuationToken: null, revision: { increment: 1 } } })
  assert.equal(await cloudflareCleanupCursorRepository.advance('account-one', { revision: 0 }, 'next-page'), false)
})
