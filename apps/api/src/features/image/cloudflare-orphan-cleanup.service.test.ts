import assert from 'node:assert/strict'
import test from 'node:test'
import type { ImageAsset } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { parseCloudflareOrphanCleanupArgs } from '../../cli/cleanup-cloudflare-orphans.js'
import { cloudflareImagesClient } from './cloudflare-images.client.js'
import { cloudflareOrphanCleanupService, createCloudflareOrphanCleanupService } from './cloudflare-orphan-cleanup.service.js'
import { imageRepository } from './image.repository.js'

const now = new Date('2026-11-04T12:00:00.000Z')
const userId = '0123456789abcdef01234567'
const meta = { kind: 'outfitGenerated', userId, storageFilename: 'closet_dev_20261102_ai.png', model: 'test' }
const remote = (id = 'remote-one') => ({ id, uploaded: '2026-11-02T12:00:00.000Z', meta })
const asset = (remoteId: string): ImageAsset => ({ id: 'asset-one', userId, cloudflareImageId: remoteId, kind: 'outfitGenerated', uploadStatus: 'ready', retention: 'deleting', expiresAt: new Date(now.getTime() + 300_000), deliveryVariant: null, deliveryUrl: null, originalFilename: null, storageFilename: meta.storageFilename, mimeType: null, width: null, height: null, metadata: meta, aiPreviewJobId: null, createdAt: now, updatedAt: now })
type Dependencies = Parameters<typeof createCloudflareOrphanCleanupService>[0]

function harness(images: unknown[], overrides: Partial<Dependencies> = {}) {
  const events: string[] = []
  const dependencies: Dependencies = {
    listImages: async (token) => { events.push(`list:${token ?? 'first'}`); return { images } },
    hasDatabaseAsset: async (id) => { events.push(`db:${id}`); return false },
    hasActiveJob: async (owner) => { events.push(`active:${owner}`); return false },
    createDeletionClaim: async (candidate) => { events.push(`claim:${candidate.remoteId}`); return { asset: asset(candidate.remoteId), leaseUntil: new Date(now.getTime() + 300_000) } },
    removeClaim: async (claim) => { events.push(`remove:${claim.asset.cloudflareImageId}`); return { count: 1 } },
    releaseClaim: async (claim) => { events.push(`release:${claim.asset.cloudflareImageId}`) },
    deleteImage: async (id) => { events.push(`delete:${id}`) },
    ...overrides,
  }
  return { events, dependencies, service: createCloudflareOrphanCleanupService(dependencies) }
}

test('기본 실행은 오래된 앱 생성 고아의 목록·DB만 읽고 삭제 임대도 만들지 않는다', async () => {
  const { service, events } = harness([remote()])
  const result = await service.cleanup({ now })
  assert.deepEqual(result.candidateRemoteIds, ['remote-one'])
  assert.equal(result.deletedCount, 0)
  assert.deepEqual(events, ['list:first', 'db:remote-one', `active:${userId}`])
})

test('불명확한 앱 메타데이터·업로드 시각·최근 파일은 DB 조회와 삭제 후보에서 제외한다', async () => {
  const invalid = [
    null, [], 'unknown', {}, { ...remote(), id: '' }, { ...remote(), id: ' remote ' },
    { ...remote(), meta: JSON.stringify(meta) }, { ...remote(), meta: [] },
    { ...remote(), meta: { ...meta, kind: 'wardrobeOriginal' } },
    { ...remote(), meta: { ...meta, userId: 'owner' } },
    { ...remote(), meta: { ...meta, storageFilename: 'closet_prod_one.png' } },
    { ...remote(), meta: { ...meta, storageFilename: 'closet_dev_' } },
    { ...remote(), meta: { ...meta, storageFilename: 'closet_dev_../secret.png' } },
    ...['2026-02-30T12:00:00Z', '2026-11-01T24:00:00Z', '2026-11-01', 'invalid', 10, '2026-11-04T00:00:00Z', '2027-01-01T00:00:00Z'].map((uploaded, index) => ({ ...remote(`time-${index}`), uploaded })),
  ].map((value, index) => value && typeof value === 'object' && !Array.isArray(value) ? { ...value, id: 'id' in value ? value.id === 'remote-one' ? `invalid-${index}` : value.id : undefined } : value)
  const { service, events } = harness(invalid)
  const result = await service.cleanup({ execute: true, now })
  assert.deepEqual(result.candidateRemoteIds, [])
  assert.deepEqual(events, ['list:first'])
})

test('24시간 경계와 명시한 시간대의 같은 시각은 후보이며 DB 기록·진행 작업이 있으면 건너뛴다', async () => {
  const { service, events } = harness([
    { ...remote('boundary'), uploaded: '2026-11-03T12:00:00.000Z' },
    { ...remote('offset'), uploaded: '2026-11-03T21:00:00+09:00' },
    remote('saved'), remote('active'),
  ], {
    hasDatabaseAsset: async (id) => { events.push(`db:${id}`); return id === 'saved' },
    hasActiveJob: async () => events.at(-1) === 'db:active',
  })
  const result = await service.cleanup({ now })
  assert.deepEqual(result.candidateRemoteIds, ['boundary', 'offset'])
  assert.equal(result.existingCount, 1)
  assert.equal(result.activeJobCount, 1)
})

test('execute는 DB·진행 작업을 재검사하고 unique 임대 후에만 CF와 같은 임대의 기록을 지운다', async () => {
  const { service, events } = harness([remote()])
  const result = await service.cleanup({ execute: true, now })
  assert.equal(result.deletedCount, 1)
  assert.deepEqual(events, ['list:first', 'db:remote-one', `active:${userId}`, 'db:remote-one', `active:${userId}`, 'claim:remote-one', `active:${userId}`, 'delete:remote-one', 'remove:remote-one'])
})

test('execute 직전 DB 연결 또는 unique 충돌이 생기면 CF를 지우지 않는다', async () => {
  let reads = 0
  const saved = harness([remote()], { hasDatabaseAsset: async () => ++reads === 2 })
  assert.equal((await saved.service.cleanup({ execute: true, now })).racedCount, 1)
  assert.equal(saved.events.some((event) => event.startsWith('delete:')), false)
  const conflict = harness([remote()], { createDeletionClaim: async () => { throw { code: 'P2002' } } })
  const result = await conflict.service.cleanup({ execute: true, now })
  assert.equal(result.racedCount, 1)
  assert.deepEqual(result.failedRemoteIds, [])
  assert.equal(conflict.events.some((event) => event.startsWith('delete:')), false)
})

test('진행 작업이 재검사·임대 직후 나타나면 삭제하지 않고 생성한 임대만 재시도로 남긴다', async () => {
  for (const activeAt of [2, 3]) {
    let reads = 0
    const { service, events } = harness([remote()], { hasActiveJob: async () => ++reads === activeAt })
    const result = await service.cleanup({ execute: true, now })
    assert.equal(result.deletedCount, 0)
    assert.equal(result.activeJobCount, 1)
    assert.equal(events.includes('delete:remote-one'), false)
    assert.equal(events.includes('release:remote-one'), activeAt === 3)
  }
})

test('DB 연결 실패는 첫 확인·재검사·임대 뒤 모두 삭제를 막고 실패 ID를 남긴다', async () => {
  for (const failAt of [1, 2]) {
    let reads = 0
    const { service, events } = harness([remote()], { hasDatabaseAsset: async () => { if (++reads === failAt) throw new Error('DB unavailable'); return false } })
    const result = await service.cleanup({ execute: true, now })
    assert.deepEqual(result.failedRemoteIds, ['remote-one'])
    assert.equal(events.includes('delete:remote-one'), false)
  }
  let reads = 0
  const { service, events } = harness([remote()], { hasActiveJob: async () => { if (++reads === 3) throw new Error('DB unavailable'); return false } })
  assert.deepEqual((await service.cleanup({ execute: true, now })).failedRemoteIds, ['remote-one'])
  assert.equal(events.includes('delete:remote-one'), false)
  assert.equal(events.includes('release:remote-one'), true)
})

test('CF 삭제·DB 기록 삭제가 실패하면 임대 기록을 남겨 DB 고아 배치가 재시도하게 한다', async () => {
  const failedDelete = harness([remote()], { deleteImage: async () => { throw new Error('remote failed') } })
  assert.deepEqual((await failedDelete.service.cleanup({ execute: true, now })).failedRemoteIds, ['remote-one'])
  assert.equal(failedDelete.events.includes('remove:remote-one'), false)
  assert.equal(failedDelete.events.includes('release:remote-one'), true)
  for (const removeClaim of [async () => ({ count: 0 }), async () => { throw new Error('DB failed') }]) {
    const { service, events } = harness([remote()], { removeClaim })
    const result = await service.cleanup({ execute: true, now })
    assert.equal(result.deletedCount, 0)
    assert.deepEqual(result.failedRemoteIds, ['remote-one'])
    assert.equal(events.includes('delete:remote-one'), true)
    assert.equal(events.includes('release:remote-one'), true)
  }
})

test('페이지를 순서대로 읽되 중복 ID는 전부 제외하고 반복 토큰이면 실행 삭제를 차단한다', async () => {
  const { service, events } = harness([], { listImages: async (token) => {
    events.push(`list:${token ?? 'first'}`)
    return token ? { images: [remote('duplicate'), remote('second')], continuationToken: 'next' } : { images: [remote('duplicate'), remote('first')], continuationToken: 'next' }
  } })
  const result = await service.cleanup({ execute: true, now })
  assert.equal(result.pagesRead, 2)
  assert.equal(result.duplicateCount, 1)
  assert.equal(result.executionBlocked, true)
  assert.equal(result.stopReason, 'repeated-token')
  assert.deepEqual(result.candidateRemoteIds, ['first', 'second'])
  assert.equal(events.some((event) => event.startsWith('claim:') || event.startsWith('delete:')), false)
})

test('후보·페이지 안전 상한과 잘못된 원격 목록 응답을 지킨다', async () => {
  const limited = harness([remote('one'), remote('two')])
  const result = await limited.service.cleanup({ execute: true, limit: 1, now })
  assert.deepEqual(result.deletedRemoteIds, ['one'])
  assert.equal(result.stopReason, 'limit')
  const paged = harness([], { listImages: async () => ({ images: [remote()], continuationToken: 'next' }) })
  assert.equal((await paged.service.cleanup({ maxPages: 1, now })).stopReason, 'max-pages')
  for (const options of [{ limit: 501 }, { limit: 0 }, { maxPages: 11 }, { maxPages: 0 }, { now: new Date('invalid') }]) {
    const check = harness([])
    await assert.rejects(check.service.cleanup(options), { code: 'INVALID_CLOUDFLARE_CLEANUP_OPTIONS' })
    assert.deepEqual(check.events, [])
  }
  const bad = harness([], { listImages: async () => ({ images: null } as never) })
  await assert.rejects(bad.service.cleanup({ execute: true, now }), { code: 'CLOUDFLARE_INVALID_PAGE' })
  assert.deepEqual(bad.events, [])
})

test('실제 adapter는 전 계정 CF 번호를 조회하고 deleting 임대를 직접 생성해 같은 임대로 정리한다', async (t) => {
  const original = { findAsset: prisma.imageAsset.findUnique, findJob: prisma.aiPreviewJob.findFirst, create: prisma.imageAsset.create }
  const calls: any[] = []
  prisma.imageAsset.findUnique = (async (args: unknown) => { calls.push(['find', args]); return null }) as unknown as typeof original.findAsset
  prisma.aiPreviewJob.findFirst = (async (args: unknown) => { calls.push(['job', args]); return null }) as unknown as typeof original.findJob
  prisma.imageAsset.create = (async (args: unknown) => { calls.push(['create', args]); return asset('remote-one') }) as unknown as typeof original.create
  t.after(() => { prisma.imageAsset.findUnique = original.findAsset; prisma.aiPreviewJob.findFirst = original.findJob; prisma.imageAsset.create = original.create })
  t.mock.method(cloudflareImagesClient, 'listImages', async () => ({ images: [remote()] }))
  const deleted = t.mock.method(cloudflareImagesClient, 'deleteImage', async () => undefined)
  const removed = t.mock.method(imageRepository, 'removeClaimedGeneratedPreview', async () => ({ count: 1 }))
  const result = await cloudflareOrphanCleanupService.cleanup({ execute: true, now })
  assert.equal(result.deletedCount, 1)
  assert.deepEqual(calls[0][1], { where: { cloudflareImageId: 'remote-one' }, select: { id: true } })
  assert.deepEqual(calls[1][1], { where: { userId, status: { in: ['queued', 'processing'] } }, select: { id: true } })
  const data = calls.find(([kind]) => kind === 'create')[1].data
  assert.equal(data.retention, 'deleting')
  assert.equal(data.kind, 'outfitGenerated')
  assert.equal(data.uploadStatus, 'ready')
  assert.equal(data.userId, userId)
  assert.equal(data.cloudflareImageId, 'remote-one')
  assert.equal(data.expiresAt.getTime(), now.getTime() + 300_000)
  assert.equal(deleted.mock.callCount(), 1)
  assert.equal(removed.mock.calls[0]!.arguments[0]!.leaseUntil.getTime(), data.expiresAt.getTime())
})

test('CF client는 V2 목록·페이지크기·정렬·토큰만 전송하고 404 삭제는 성공으로 처리한다', async (t) => {
  const previous = { account: process.env.CF_ACCOUNT, token: process.env.CF_TOKEN }
  process.env.CF_ACCOUNT = 'test-account'
  process.env.CF_TOKEN = 'test-token'
  t.after(() => { if (previous.account === undefined) delete process.env.CF_ACCOUNT; else process.env.CF_ACCOUNT = previous.account; if (previous.token === undefined) delete process.env.CF_TOKEN; else process.env.CF_TOKEN = previous.token })
  const requests: Array<{ url: URL; method?: string }> = []
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: new URL(String(input)), method: init?.method })
    return init?.method === 'DELETE' ? new Response(null, { status: 404 }) : Response.json({ success: true, result: { images: [remote()], continuation_token: 'next-token' } })
  })
  const result = await cloudflareImagesClient.listImages('current-token')
  assert.equal(result.continuationToken, 'next-token')
  assert.equal(requests[0]!.method, 'GET')
  assert.equal(requests[0]!.url.pathname, '/client/v4/accounts/test-account/images/v2')
  assert.deepEqual([...requests[0]!.url.searchParams], [['per_page', '1000'], ['sort_order', 'asc'], ['continuation_token', 'current-token']])
  await cloudflareImagesClient.deleteImage('missing-image')
  assert.equal(requests[1]!.method, 'DELETE')
})

test('CF client는 잘못된 목록·토큰을 삭제 후보로 전달하지 않는다', async (t) => {
  const previous = { account: process.env.CF_ACCOUNT, token: process.env.CF_TOKEN }
  process.env.CF_ACCOUNT = 'test-account'
  process.env.CF_TOKEN = 'test-token'
  t.after(() => { if (previous.account === undefined) delete process.env.CF_ACCOUNT; else process.env.CF_ACCOUNT = previous.account; if (previous.token === undefined) delete process.env.CF_TOKEN; else process.env.CF_TOKEN = previous.token })
  let result: unknown
  const mocked = t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, result }))
  for (result of [null, [], {}, { images: null }, { images: Array(1001).fill(null) }, { images: [], continuation_token: 3 }, { images: [], continuation_token: 'a'.repeat(33) }]) {
    await assert.rejects(cloudflareImagesClient.listImages())
  }
  const reads = mocked.mock.callCount()
  await assert.rejects(cloudflareImagesClient.listImages('a'.repeat(33)))
  assert.equal(mocked.mock.callCount(), reads)
})

test('CLI는 기본 조회·명시 실행·안전 상한을 구분하고 오타·중복을 거절한다', () => {
  assert.deepEqual(parseCloudflareOrphanCleanupArgs([]), { execute: false, limit: 100, maxPages: 10 })
  assert.deepEqual(parseCloudflareOrphanCleanupArgs(['--execute', '--limit=20', '--max-pages=2']), { execute: true, limit: 20, maxPages: 2 })
  for (const args of [['--exectue'], ['--execute=true'], ['--limit=0'], ['--limit=501'], ['--max-pages=11'], ['--limit=1.5'], ['--execute', '--execute'], ['--limit=1', '--limit=2']]) {
    assert.throws(() => parseCloudflareOrphanCleanupArgs(args))
  }
})
