import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { Prisma, type ImageAsset } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { cloudflareImagesClient } from './cloudflare-images.client.js'
import { imageRepository, lockGeneratedImageForReference, type GeneratedImageDeletionClaim } from './image.repository.js'
import { imageService } from './image.service.js'

const now = new Date('2026-11-04T00:00:00Z')
function asset(id = 'asset', overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    id, userId: 'owner', cloudflareImageId: `cloud-${id}`, kind: 'outfitGenerated', uploadStatus: 'ready',
    retention: 'permanent', expiresAt: null, deliveryVariant: 'public', deliveryUrl: 'https://images.invalid/public',
    originalFilename: null, storageFilename: 'generated.png', mimeType: 'image/png', width: null, height: null,
    metadata: { model: 'fixture', purpose: 'outfitPreview' }, aiPreviewJobId: 'job',
    createdAt: new Date('2026-11-02'), updatedAt: new Date('2026-11-03'), ...overrides,
  }
}
const claim = (image: ImageAsset): GeneratedImageDeletionClaim => ({ asset: image, leaseUntil: new Date(now.getTime() + 300_000) })

/** DB 트랜잭션 경계만 대체하고 실제 claim의 조회·행 변경·고아 연결 정리 순서를 기록한다. */
function transactionFixture(t: TestContext) {
  const state = { image: asset() as ImageAsset | null, liveReference: false, activeJob: false, conflict: false, attempts: 0 }
  const queries: any[] = []
  const writes: any[] = []
  const detached: any[] = []
  const tx = {
    imageAsset: {
      findFirst: async (args: any) => { queries.push(args); return state.liveReference ? null : state.image },
      updateMany: async (args: any) => {
        writes.push(args)
        if (state.conflict) {
          state.conflict = false
          state.liveReference = true
          throw new Prisma.PrismaClientKnownRequestError('write conflict', { code: 'P2034', clientVersion: 'test' })
        }
        return { count: 1 }
      },
    },
    aiPreviewJob: { findFirst: async () => state.activeJob ? { id: 'processing-job' } : null },
    outfitGeneration: { deleteMany: async (args: any) => { detached.push(args); return { count: 1 } } },
  } as unknown as Prisma.TransactionClient
  const original = prisma.$transaction
  prisma.$transaction = (async (run: (client: Prisma.TransactionClient) => Promise<unknown>) => { state.attempts += 1; return run(tx) }) as typeof original
  t.after(() => { prisma.$transaction = original })
  return { tx, state, queries, writes, detached }
}

test('삭제 후보 조회는 24시간·살아있는 코디/플래너·옷장 양쪽·진행 작업과 페이지 경계를 제한한다', async (t) => {
  let query: any
  const originals = { image: prisma.imageAsset.findMany, jobs: prisma.aiPreviewJob.findMany }
  prisma.aiPreviewJob.findMany = (async () => [{ id: 'active-job', imageAssetId: 'protected-asset' }]) as unknown as typeof originals.jobs
  prisma.imageAsset.findMany = (async (args: unknown) => { query = args; return [] }) as unknown as typeof originals.image
  t.after(() => { prisma.imageAsset.findMany = originals.image; prisma.aiPreviewJob.findMany = originals.jobs })
  const after = { createdAt: new Date('2026-10-30'), id: 'previous-id' }
  await imageRepository.findExpiredGeneratedPreviews(now, 100, after)
  assert.equal(query.where.kind, 'outfitGenerated')
  assert.deepEqual(query.where.wardrobeDisplayItems, { none: {} })
  assert.deepEqual(query.where.wardrobeOriginalItems, { none: {} })
  const live = query.where.outfitGenerations.none.outfit.is.OR
  assert.ok(live.some((condition: any) => condition.plannerOnly === false))
  assert.ok(live.some((condition: any) => condition.planEntries?.some))
  assert.deepEqual(query.where.AND[0].OR[0].createdAt, { lte: new Date('2026-11-03') })
  assert.deepEqual(query.where.AND[0].OR[0].retention, { in: ['permanent', 'temporary'] })
  const serialized = JSON.stringify(query.where.AND)
  assert.match(serialized, /active-job/)
  assert.match(serialized, /protected-asset/)
  assert.match(serialized, /previous-id/)
  assert.deepEqual(query.orderBy, [{ createdAt: 'asc' }, { id: 'asc' }])
  assert.equal(query.take, 100)
})

test('claim은 실제 참조를 다시 확인하고 같은 이미지 행을 바꾼 뒤 숨은 고아 연결만 정리한다', async (t) => {
  const fixture = transactionFixture(t)
  const result = await imageRepository.claimExpiredGeneratedPreview('asset', now)
  assert.ok(result)
  assert.equal(result.asset.id, 'asset')
  assert.deepEqual(fixture.queries[0].where.AND[0].OR[0].createdAt, { lte: new Date('2026-11-03') })
  assert.equal(fixture.writes[0].data.retention, 'deleting')
  assert.equal(fixture.writes[0].where.updatedAt, fixture.state.image!.updatedAt)
  assert.deepEqual(fixture.detached, [{ where: { imageAssetId: 'asset' } }])
})

test('진행·복구 중 생성 작업과 살아있는 공유 참조는 claim하지 않는다', async (t) => {
  const fixture = transactionFixture(t)
  fixture.state.activeJob = true
  assert.equal(await imageRepository.claimExpiredGeneratedPreview('asset', now), null)
  fixture.state.activeJob = false
  fixture.state.liveReference = true
  assert.equal(await imageRepository.claimGeneratedImageDeletion('owner', 'asset', now), null)
  assert.equal(fixture.writes.length, 0)
  assert.equal(fixture.detached.length, 0)
})

test('원격 고아를 추적한 새 tombstone도 삭제 임대가 끝나면 24시간을 다시 기다리지 않고 재시도한다', async (t) => {
  const fixture = transactionFixture(t)
  fixture.state.image = asset('remote-tombstone', { createdAt: now, retention: 'deleting', expiresAt: now, aiPreviewJobId: null })
  const result = await imageRepository.claimExpiredGeneratedPreview('remote-tombstone', now)
  assert.ok(result)
  const retry = fixture.queries[0].where.AND[0].OR[1]
  assert.equal(retry.retention, 'deleting')
  assert.equal(retry.createdAt, undefined)
  assert.deepEqual(retry.OR[0], { expiresAt: { lte: now } })
})

test('이미지 연결이 먼저 커밋돼 쓰기 충돌이 나면 새 참조를 읽고 삭제를 중단한다', async (t) => {
  const fixture = transactionFixture(t)
  fixture.state.conflict = true
  assert.equal(await imageRepository.claimExpiredGeneratedPreview('asset', now), null)
  assert.equal(fixture.state.attempts, 2)
  assert.equal(fixture.detached.length, 0)
})

test('새 연결은 삭제 중인 자산을 거절하고 동일 밀리초에도 이미지 행을 반드시 변경한다', async (t) => {
  const fixture = transactionFixture(t)
  t.mock.method(Date, 'now', () => fixture.state.image!.updatedAt.getTime())
  await lockGeneratedImageForReference(fixture.tx, 'owner', 'asset')
  assert.equal(fixture.writes[0].data.updatedAt.getTime(), fixture.state.image!.updatedAt.getTime() + 1)
  assert.equal(fixture.writes[0].where.userId, 'owner')
  assert.deepEqual(fixture.writes[0].where.retention, { in: ['permanent', 'temporary'] })
  fixture.state.image = null
  await assert.rejects(lockGeneratedImageForReference(fixture.tx, 'owner', 'asset'), { code: 'OUTFIT_PREVIEW_NOT_FOUND' })
})

test('dry-run은 100개 넘는 고아도 페이지로 읽되 claim·CF·DB 쓰기는 하지 않는다', async (t) => {
  const calls: any[] = []
  t.mock.method(imageRepository, 'findExpiredGeneratedPreviews', async (...args: unknown[]) => {
    calls.push(args)
    return calls.length === 1 ? Array.from({ length: 100 }, (_, index) => asset(`first-${index}`)) : Array.from({ length: 50 }, (_, index) => asset(`second-${index}`))
  })
  const getClaim = t.mock.method(imageRepository, 'claimExpiredGeneratedPreview', async () => { throw new Error('쓰기 금지') })
  const remote = t.mock.method(cloudflareImagesClient, 'deleteImage', async () => { throw new Error('CF 금지') })
  const result = await imageService.cleanupExpiredGeneratedPreviews({ execute: false, limit: 150, now })
  assert.deepEqual(result, { candidateCount: 150, deletedCount: 0, failedAssetIds: [] })
  assert.deepEqual(calls[1][2], { id: 'first-99', createdAt: new Date('2026-11-02') })
  assert.equal(getClaim.mock.callCount(), 0)
  assert.equal(remote.mock.callCount(), 0)
})

test('execute는 CF→DB 순서로 지우고 참조가 생긴 후보는 건너뛰며 실패 기록은 재시도에 남긴다', async (t) => {
  const candidates = ['deleted', 'shared', 'cf-failed', 'db-failed'].map((id) => asset(id))
  t.mock.method(imageRepository, 'findExpiredGeneratedPreviews', async () => candidates)
  t.mock.method(imageRepository, 'claimExpiredGeneratedPreview', async (id: string) => id === 'shared' ? null : claim(candidates.find((candidate) => candidate.id === id)!))
  const events: string[] = []
  t.mock.method(cloudflareImagesClient, 'deleteImage', async (id: string) => { events.push(`cf:${id}`); if (id === 'cloud-cf-failed') throw new Error('provider failure') })
  t.mock.method(imageRepository, 'removeClaimedGeneratedPreview', async (current: GeneratedImageDeletionClaim) => { events.push(`db:${current.asset.id}`); if (current.asset.id === 'db-failed') throw new Error('DB failure'); return { count: 1 } })
  const retry = t.mock.method(imageRepository, 'releaseGeneratedPreviewCleanup', async () => ({ count: 1 }))
  const result = await imageService.cleanupExpiredGeneratedPreviews({ execute: true, limit: 100, now })
  assert.deepEqual(result, { candidateCount: 4, deletedCount: 1, failedAssetIds: ['cf-failed', 'db-failed'] })
  assert.deepEqual(events, ['cf:cloud-deleted', 'db:deleted', 'cf:cloud-cf-failed', 'cf:cloud-db-failed', 'db:db-failed'])
  assert.equal(retry.mock.callCount(), 2)
})

test('삭제 실패는 deleting을 유지하고 현재 임대의 재시도 시각만 변경한다', async (t) => {
  let query: any
  const original = prisma.imageAsset.updateMany
  prisma.imageAsset.updateMany = (async (args: unknown) => { query = args; return { count: 1 } }) as unknown as typeof original
  t.after(() => { prisma.imageAsset.updateMany = original })
  const current = claim(asset())
  await imageRepository.releaseGeneratedPreviewCleanup(current, now)
  assert.deepEqual(query.where, { id: 'asset', kind: 'outfitGenerated', retention: 'deleting', expiresAt: current.leaseUntil })
  assert.deepEqual(query.data, { expiresAt: new Date(now.getTime() + 15 * 60_000) })
})

test('CF 삭제가 성공했어도 현재 임대와 모든 참조 없음이 유지될 때만 DB 행을 지운다', async (t) => {
  let query: any
  const original = prisma.imageAsset.deleteMany
  prisma.imageAsset.deleteMany = (async (args: unknown) => { query = args; return { count: 0 } }) as unknown as typeof original
  t.after(() => { prisma.imageAsset.deleteMany = original })
  const current = claim(asset())
  assert.deepEqual(await imageRepository.removeClaimedGeneratedPreview(current), { count: 0 })
  assert.equal(query.where.expiresAt, current.leaseUntil)
  assert.equal(query.where.retention, 'deleting')
  assert.deepEqual(query.where.outfitGenerations, { none: {} })
  assert.deepEqual(query.where.wardrobeDisplayItems, { none: {} })
  assert.deepEqual(query.where.wardrobeOriginalItems, { none: {} })
})

test('즉시 삭제도 CF 실패 시 DB 행을 지우지 않고 재시도를 예약한다', async (t) => {
  const current = claim(asset())
  t.mock.method(imageRepository, 'claimGeneratedImageDeletion', async () => current)
  t.mock.method(cloudflareImagesClient, 'deleteImage', async () => { throw new Error('provider down') })
  const remove = t.mock.method(imageRepository, 'removeClaimedGeneratedPreview', async () => ({ count: 1 }))
  const retry = t.mock.method(imageRepository, 'releaseGeneratedPreviewCleanup', async () => ({ count: 1 }))
  await imageService.removeGeneratedImage('owner', { id: 'asset', cloudflareImageId: 'untrusted' })
  assert.equal(remove.mock.callCount(), 0)
  assert.equal(retry.mock.callCount(), 1)
})
