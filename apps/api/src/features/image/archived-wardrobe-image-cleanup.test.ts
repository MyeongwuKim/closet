import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { Prisma, type ImageAsset } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { archivedWardrobeImageCleanupRepository as repository, type ArchivedWardrobeImageDeletionClaim } from './archived-wardrobe-image-cleanup.repository.js'
import { createArchivedWardrobeImageCleanupService } from './archived-wardrobe-image-cleanup.service.js'

const now = new Date('2026-11-05T03:00:00.000Z')
function asset(id = 'photo', overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    id, userId: 'owner', cloudflareImageId: `cf-${id}`, kind: 'wardrobeCutout', uploadStatus: 'ready',
    retention: 'permanent', expiresAt: null, deliveryVariant: 'public', deliveryUrl: `https://example.test/${id}.png`,
    originalFilename: null, storageFilename: `${id}.png`, mimeType: 'image/png', width: null, height: null,
    metadata: null, aiPreviewJobId: null, createdAt: new Date('2026-11-04'), updatedAt: new Date('2026-11-04'), ...overrides,
  }
}

function item(id = 'deleted', options: { active?: boolean; live?: boolean; foreign?: boolean } = {}) {
  return {
    id, userId: options.foreign ? 'other-owner' : 'owner', archivedAt: options.active ? null : new Date('2026-11-05'),
    updatedAt: new Date('2026-11-04'), outfitItems: options.live ? [{ id: 'saved-or-dated' }] : [],
  }
}
function usage(image = asset(), options: { active?: boolean; live?: boolean; foreign?: boolean } = {}) {
  return { ...image, wardrobeDisplayItems: [item('deleted', options)], wardrobeOriginalItems: [] as ReturnType<typeof item>[], outfitGenerations: [] as Array<{ id: string }> }
}
const claimFor = (image: ImageAsset): ArchivedWardrobeImageDeletionClaim => ({ asset: image, leaseUntil: new Date(now.getTime() + 300_000) })

function fixture(t: TestContext) {
  const state = { asset: usage() as ReturnType<typeof usage> | null, jobs: [] as Array<{ selectedItemIds: string[] }>, conflict: false, attempts: 0 }
  const events: string[] = []
  const writes: any[] = []
  const tx = {
    imageAsset: {
      findFirst: async ({ where }: any) => {
        const current = state.asset
        if (!current || (where.expiresAt && current.expiresAt?.getTime() !== where.expiresAt.getTime())) return null
        return current
      },
      updateMany: async (args: any) => {
        events.push('asset-write'); writes.push(args)
        if (state.asset) state.asset = { ...state.asset, ...args.data }
        return { count: 1 }
      },
      deleteMany: async () => { events.push('asset-delete'); state.asset = null; return { count: 1 } },
    },
    wardrobeItem: { updateMany: async (args: any) => {
      events.push(args.data.displayImageAssetId === null ? 'display-detach' : args.data.originalImageAssetId === null ? 'original-detach' : 'item-touch')
      return { count: 1 }
    } },
    aiLease: { upsert: async (args: any) => {
      events.push(`mutex:${args.where.id.includes(':asset:') ? 'asset' : 'item'}`)
      if (state.conflict) {
        state.conflict = false
        state.asset!.wardrobeDisplayItems[0]!.outfitItems = [{ id: 'new-live-reference' }]
        throw new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: 'test' })
      }
      return args.create
    } },
    aiPreviewJob: { findMany: async () => state.jobs },
  } as unknown as Prisma.TransactionClient
  const original = prisma.$transaction
  prisma.$transaction = (async (run: (client: Prisma.TransactionClient) => Promise<unknown>) => { state.attempts++; return run(tx) }) as typeof original
  t.after(() => { prisma.$transaction = original })
  return { state, events, writes }
}

test('삭제 직전에는 활성 옷·살아있는 코디·공유 소유자·진행 작업·생성 연결을 모두 보호한다', async (t) => {
  const f = fixture(t)
  for (const options of [{ active: true }, { live: true }, { foreign: true }]) {
    f.state.asset = usage(asset(), options)
    assert.equal(await repository.claim('photo', now), null)
  }
  f.state.asset = usage()
  f.state.jobs = [{ selectedItemIds: ['deleted'] }]
  assert.equal(await repository.claim('photo', now), null)
  f.state.jobs = []
  f.state.asset.outfitGenerations = [{ id: 'legacy-generation' }]
  assert.equal(await repository.claim('photo', now), null)
  assert.equal(f.events.length, 0)
})

test('claim은 공유 옷과 자산의 전용 mutex를 잠근 뒤 삭제중으로 바꾸며 사진 연결은 유지한다', async (t) => {
  const f = fixture(t)
  f.state.asset!.wardrobeOriginalItems = [item('another')]
  const result = await repository.claim('photo', now)
  assert.ok(result)
  assert.equal(f.events.length, 4)
  assert.deepEqual(f.events.slice(0, 3).map((value) => value.split(':')[0]), ['mutex', 'mutex', 'mutex'])
  assert.equal(f.events[3], 'asset-write')
  assert.equal(f.writes[0].data.retention, 'deleting')
  assert.equal(f.writes[0].data.metadata.purpose, 'archivedWardrobeImageCleanup')
  assert.equal(f.state.asset!.wardrobeDisplayItems.length, 1)
  assert.equal(f.state.asset!.wardrobeOriginalItems.length, 1)
})

test('사진 연결이 먼저 끝나면 트랜잭션을 재시도해 새 참조를 확인하고 삭제를 중단한다', async (t) => {
  const f = fixture(t)
  f.state.conflict = true
  assert.equal(await repository.claim('photo', now), null)
  assert.equal(f.state.attempts, 2)
  assert.equal(f.writes.length, 0)
})

test('현재 삭제 임대가 끝나기 전에는 재실행하지 않고 같은 밀리초에도 자산을 실제 변경한다', async (t) => {
  const f = fixture(t)
  f.state.asset = usage(asset('photo', { updatedAt: now }))
  const claim = await repository.claim('photo', now)
  assert.ok(claim)
  assert.equal(f.writes[0].data.updatedAt.getTime(), now.getTime() + 1)
  assert.equal(await repository.claim('photo', now), null)
  assert.equal(f.writes.length, 1)
})

test('finalize는 같은 임대만 양쪽 사진 연결을 해제한 뒤 자산을 지우고 옷 행은 삭제하지 않는다', async (t) => {
  const f = fixture(t)
  const claim = await repository.claim('photo', now)
  assert.ok(claim)
  f.events.length = 0
  assert.deepEqual(await repository.finalize({ ...claim, leaseUntil: new Date(claim.leaseUntil.getTime() + 1) }), { count: 0 })
  assert.equal(f.events.length, 0)
  assert.deepEqual(await repository.finalize(claim), { count: 1 })
  assert.deepEqual(f.events.slice(0, 2).map((value) => value.split(':')[0]), ['mutex', 'mutex'])
  assert.deepEqual(f.events.slice(2), ['asset-write', 'display-detach', 'original-detach', 'asset-delete'])
})

test('후보 조회는 보호된 첫 페이지 뒤의 미사용 삭제 사진도 찾고 조회만 수행한다', async (t) => {
  const pages = [[usage(asset('protected'), { live: true })], [usage(asset('unused'))]]
  const queries: any[] = []
  const original = { jobs: prisma.aiPreviewJob.findMany, assets: prisma.imageAsset.findMany, write: prisma.imageAsset.updateMany }
  let writes = 0
  prisma.aiPreviewJob.findMany = (async () => []) as unknown as typeof original.jobs
  prisma.imageAsset.findMany = (async (args: unknown) => { queries.push(args); return pages.shift() ?? [] }) as unknown as typeof original.assets
  prisma.imageAsset.updateMany = (async () => { writes++; throw new Error('dry-run write') }) as typeof original.write
  t.after(() => { prisma.aiPreviewJob.findMany = original.jobs; prisma.imageAsset.findMany = original.assets; prisma.imageAsset.updateMany = original.write })
  const candidates = await repository.findCandidates(now, 1)
  assert.deepEqual(candidates.map((image) => image.id), ['unused'])
  assert.equal(queries.length, 2)
  assert.match(JSON.stringify(queries[1].where), /protected/)
  assert.equal(writes, 0)
})

test('아무 옷에도 연결되지 않은 신규 업로드는 삭제 후보로 취급하지 않는다', async (t) => {
  const f = fixture(t)
  f.state.asset!.wardrobeDisplayItems = []
  assert.equal(await repository.claim('photo', now), null)
  f.state.asset = usage(asset('photo', { retention: 'deleting', expiresAt: now, metadata: { purpose: 'different-cleanup' } }))
  assert.equal(await repository.claim('photo', now), null)
  assert.deepEqual(f.events, [])
})

test('dry-run은 claim·CF·DB 쓰기 없이 사진 후보만 페이지로 조회한다', async () => {
  const calls: string[] = []
  const service = createArchivedWardrobeImageCleanupService({
    findCandidates: async () => [asset()],
    claim: async () => { calls.push('claim'); return claimFor(asset()) },
    deleteImage: async () => { calls.push('cf') }, finalize: async () => { calls.push('finalize'); return { count: 1 } },
    release: async () => { calls.push('release') },
  })
  assert.deepEqual(await service.cleanup({ execute: false, limit: 100, now }), { candidateCount: 1, deletedCount: 0, failedAssetIds: [] })
  assert.deepEqual(calls, [])
})

test('실행은 claim→CF→DB 순서로 처리하고 새 참조는 건너뛰며 CF·DB 실패를 재시도에 남긴다', async () => {
  const calls: string[] = []
  const candidates = ['success', 'shared', 'cf-failed', 'db-failed'].map((id) => asset(id))
  const service = createArchivedWardrobeImageCleanupService({
    findCandidates: async () => candidates,
    claim: async (id) => id === 'shared' ? null : claimFor(asset(id)),
    deleteImage: async (id) => { calls.push(`cf:${id}`); if (id === 'cf-cf-failed') throw new Error('CF failed') },
    finalize: async (claim) => { calls.push(`db:${claim.asset.id}`); if (claim.asset.id === 'db-failed') throw new Error('DB failed'); return { count: 1 } },
    release: async (claim) => { calls.push(`retry:${claim.asset.id}`) },
  })
  assert.deepEqual(await service.cleanup({ execute: true, limit: 100, now }), { candidateCount: 4, deletedCount: 1, failedAssetIds: ['cf-failed', 'db-failed'] })
  assert.deepEqual(calls, ['cf:cf-success', 'db:success', 'cf:cf-cf-failed', 'retry:cf-failed', 'cf:cf-db-failed', 'db:db-failed', 'retry:db-failed'])
})

test('잘못된 배치 옵션은 조회·삭제 전에 거절한다', async () => {
  const service = createArchivedWardrobeImageCleanupService({
    findCandidates: async () => { throw new Error('조회 금지') }, claim: async () => null,
    deleteImage: async () => {}, finalize: async () => ({ count: 0 }), release: async () => {},
  })
  for (const limit of [0, -1, 1.5, 501]) await assert.rejects(service.cleanup({ execute: true, limit, now }), { code: 'INVALID_WARDROBE_IMAGE_CLEANUP_OPTIONS' })
})
