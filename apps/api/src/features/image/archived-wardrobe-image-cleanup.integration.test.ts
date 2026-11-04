import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import type { ImageAsset, PrismaClient, WardrobeItem } from '@prisma/client'

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim()

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

async function bounded<T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('동시 실행 검사 단계가 5초 안에 도달하지 않았습니다.')), 5000)
    })])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function observe<T>(promise: Promise<T>) {
  // 다른 트랜잭션의 검증 단계가 열리기 전에 실패해도 실행 중인 Promise를 추적한다.
  void promise.catch(() => undefined)
  return promise
}

/** 빈 전용 MongoDB에서만 사진 정리와 실제 저장 트랜잭션의 충돌을 검사한다. CF·AI의 외부 요청은 모두 대체한다. */
test('삭제된 옷 사진의 실제 DB 참조 보호·정리·동시 연결을 검증한다', {
  skip: testDatabaseUrl ? false : 'TEST_DATABASE_URL이 없어 실제 DB 통합 검사를 실행하지 않았습니다.',
}, async (t) => {
  const target = new URL(testDatabaseUrl!)
  assert.ok(['mongodb:', 'mongodb+srv:'].includes(target.protocol))
  assert.match(target.pathname, /^\/closet_image_orphan_test_\d+$/, '별도의 빈 이미지 검사 DB만 허용합니다.')
  const globals = globalThis as unknown as { prisma?: PrismaClient }
  assert.equal(globals.prisma, undefined, '앱 DB singleton과 함께 실행할 수 없습니다.')
  const previousDatabaseUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = testDatabaseUrl
  const { PrismaClient } = await import('@prisma/client')
  const baseClient = new PrismaClient({ datasources: { db: { url: testDatabaseUrl! } } })
  type QueryEvent = { model: string; operation: string; args: unknown }
  let beforeQuery: ((event: QueryEvent) => void | Promise<void>) | undefined
  const client = baseClient.$extends({ query: { $allModels: {
    async $allOperations({ model, operation, args, query }) {
      await beforeQuery?.({ model, operation, args })
      return query(args)
    },
  } } }) as unknown as PrismaClient
  globals.prisma = client
  let ownsDatabase = false
  t.after(async () => {
    beforeQuery = undefined
    try { if (ownsDatabase) await client.$runCommandRaw({ dropDatabase: 1 }) }
    finally {
      await client.$disconnect()
      delete globals.prisma
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = previousDatabaseUrl
    }
  })
  const inventory = await client.$runCommandRaw({ listCollections: 1, nameOnly: true })
  const collections = (inventory as { cursor?: { firstBatch?: unknown[] } }).cursor?.firstBatch
  assert.ok(Array.isArray(collections) && collections.length === 0, '기존 DB는 사용하거나 정리하지 않습니다.')
  ownsDatabase = true
  const collectionNames = ['User', 'ImageAsset', 'WardrobeItem', 'Outfit', 'OutfitItem', 'OutfitGeneration', 'PlannerWeek', 'PlannerEntry', 'AiPreviewJob', 'AiLease', 'AiCreditWallet', 'PreviewCreditDay']
  for (const collection of collectionNames) await client.$runCommandRaw({ create: collection })
  await client.$runCommandRaw({ createIndexes: 'ImageAsset', indexes: [{ key: { cloudflareImageId: 1 }, name: 'wardrobe_photo_cf_id', unique: true }] })
  const { prisma } = await import('../../lib/prisma.js')
  assert.equal(prisma, client)
  const { aiTransaction } = await import('../../lib/ai/ai-storage.js')
  const { archivedWardrobeImageCleanupRepository: repository } = await import('./archived-wardrobe-image-cleanup.repository.js')
  const { archivedWardrobeImageCleanupService: service } = await import('./archived-wardrobe-image-cleanup.service.js')
  const { cloudflareImagesClient } = await import('./cloudflare-images.client.js')
  const { wardrobeRepository } = await import('../wardrobe/wardrobe.repository.js')
  const { outfitRepository } = await import('../outfit/outfit.repository.js')
  const { outfitService } = await import('../outfit/outfit.service.js')
  const { plannerService } = await import('../planner/planner.service.js')
  const { previewJobService } = await import('../outfit/preview-job.service.js')
  const { previewJobRepository } = await import('../outfit/preview-job.repository.js')
  const { lockWardrobeImagesForReference } = await import('../wardrobe/wardrobe-image-lifecycle.js')
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('실제 외부 요청은 통합 검사에서 허용하지 않습니다.') })
  t.afterEach(async () => {
    beforeQuery = undefined
    for (const collection of [...collectionNames].reverse()) await client.$runCommandRaw({ delete: collection, deletes: [{ q: {}, limit: 0 }] })
  })
  const now = new Date()
  const old = new Date(now.getTime() - 48 * 60 * 60_000)

  const createPhoto = (userId: string, kind: 'wardrobeCutout' | 'wardrobeOriginal' = 'wardrobeCutout') => client.imageAsset.create({
    data: { userId, kind, cloudflareImageId: `wardrobe-photo-integration-${randomUUID()}`, uploadStatus: 'ready', retention: 'permanent',
      mimeType: 'image/png', deliveryUrl: `https://integration.invalid/${randomUUID()}.png`, createdAt: old },
  })
  const createItem = async (userId: string, archived = true, category: 'top' | 'bottom' = 'top') => {
    const [cutout, original] = await Promise.all([createPhoto(userId), createPhoto(userId, 'wardrobeOriginal')])
    const item = await client.wardrobeItem.create({ data: {
      userId, name: `사진 검사 ${category}`, category, seasons: ['autumn'], classificationStatus: 'classified',
      archivedAt: archived ? old : null, displayImageAssetId: cutout.id, originalImageAssetId: original.id,
    } })
    return { item, cutout, original }
  }
  const createOwner = () => client.user.create({ data: { displayName: '삭제 옷 사진 통합 검사' } })
  const createOutfit = (userId: string, items: WardrobeItem[], plannerOnly = false) => client.outfit.create({ data: {
    userId, name: '사진 참조 검사 코디', style: 'casual', seasons: ['autumn'], plannerOnly,
    items: { create: items.map((item, layerOrder) => ({ wardrobeItemId: item.id, slot: item.category!, layerOrder })) },
  } })
  const createJob = (userId: string, selectedItemIds: string[], status: 'queued' | 'processing') => client.aiPreviewJob.create({ data: {
    id: randomUUID(), userId, requestKeys: [randomUUID()], inputKey: randomUUID(), fingerprint: randomUUID(), selectedItemIds, status,
    leaseToken: status === 'processing' ? randomUUID() : null, leaseUntil: status === 'processing' ? old : null,
    // 작업 TTL이 지났더라도 processing/queued 문서가 남아 있으면 사진을 보호해야 한다.
    expiresAt: old,
  } })
  const wardrobeCreateData = (userId: string, photo: ImageAsset) => ({
    userId, name: '공유 사진 새 옷', displayImageAssetId: photo.id, category: 'top' as const,
    additionalCategories: [], seasons: ['autumn' as const], tags: [], classificationStatus: 'classified' as const,
  })

  await t.test('활성 옷·코디북·지난 착용 날짜와 진행 작업이 사용하는 원본과 누끼를 모두 보호한다', async () => {
    const owner = await createOwner()
    const active = await createItem(owner.id, false)
    const book = await createItem(owner.id)
    const planned = await createItem(owner.id)
    const queued = await createItem(owner.id)
    const processing = await createItem(owner.id)
    await createOutfit(owner.id, [book.item])
    const privateOutfit = await createOutfit(owner.id, [planned.item], true)
    const week = await client.plannerWeek.create({ data: { userId: owner.id, weekStartsOn: old } })
    await client.plannerEntry.create({ data: { plannerWeekId: week.id, outfitId: privateOutfit.id, date: old, wornAt: old, wearFeeling: 'cold' } })
    await createJob(owner.id, [queued.item.id], 'queued')
    await createJob(owner.id, [processing.item.id], 'processing')
    const candidates = await repository.findCandidates(now, 100)
    for (const scenario of [active, book, planned, queued, processing]) {
      for (const photo of [scenario.cutout, scenario.original]) {
        assert.equal(candidates.some((candidate) => candidate.id === photo.id), false)
        assert.equal(await repository.claim(photo.id, now), null)
        assert.equal((await client.imageAsset.findUniqueOrThrow({ where: { id: photo.id } })).retention, 'permanent')
      }
    }
    const entry = await client.plannerEntry.findFirstOrThrow()
    assert.equal(entry.wornAt?.getTime(), old.getTime())
    assert.equal(entry.wearFeeling, 'cold')
  })

  await t.test('공유 사진을 다른 활성 옷·다른 계정·다른 사진 역할에서 사용하면 보호한다', async () => {
    const owner = await createOwner()
    const target = await createItem(owner.id)
    const other = await createOwner()
    await client.wardrobeItem.create({ data: { userId: other.id, name: '타계정 원본 공유', originalImageAssetId: target.cutout.id, seasons: [], archivedAt: old } })
    await client.wardrobeItem.create({ data: { userId: owner.id, name: '활성 누끼 공유', displayImageAssetId: target.original.id, seasons: [], archivedAt: null } })
    assert.equal(await repository.claim(target.cutout.id, now), null)
    assert.equal(await repository.claim(target.original.id, now), null)
  })

  await t.test('미사용 삭제 옷의 사진만 정리하고 옷 행·새 업로드·다른 사진은 보존한다', async (st) => {
    const owner = await createOwner()
    const target = await createItem(owner.id)
    const unrelated = await createPhoto(owner.id)
    const pending = await createPhoto(owner.id)
    await client.imageAsset.update({ where: { id: pending.id }, data: { uploadStatus: 'pending' } })
    const calls: string[] = []
    st.mock.method(cloudflareImagesClient, 'deleteImage', async (id: string) => { calls.push(id) })
    const result = await service.cleanup({ execute: true, limit: 100, now })
    assert.equal(result.deletedCount, 2)
    assert.deepEqual(result.failedAssetIds, [])
    assert.deepEqual(calls.sort(), [target.cutout.cloudflareImageId, target.original.cloudflareImageId].sort())
    const preserved = await client.wardrobeItem.findUniqueOrThrow({ where: { id: target.item.id } })
    assert.equal(preserved.archivedAt?.getTime(), old.getTime())
    assert.equal(preserved.displayImageAssetId, null)
    assert.equal(preserved.originalImageAssetId, null)
    assert.equal(await client.imageAsset.count({ where: { id: { in: [target.cutout.id, target.original.id] } } }), 0)
    assert.equal(await client.imageAsset.count({ where: { id: { in: [unrelated.id, pending.id] } } }), 2)
  })

  await t.test('dry-run은 후보만 읽으며 연결·삭제 상태·CF를 바꾸지 않는다', async (st) => {
    const owner = await createOwner()
    const target = await createItem(owner.id)
    const calls = st.mock.method(cloudflareImagesClient, 'deleteImage', async () => undefined)
    const before = await client.wardrobeItem.findUniqueOrThrow({ where: { id: target.item.id } })
    const result = await service.cleanup({ execute: false, limit: 100, now })
    assert.equal(result.candidateCount, 2)
    assert.equal(result.deletedCount, 0)
    assert.equal(calls.mock.callCount(), 0)
    assert.deepEqual(await client.wardrobeItem.findUniqueOrThrow({ where: { id: target.item.id } }), before)
    assert.equal((await client.imageAsset.findUniqueOrThrow({ where: { id: target.cutout.id } })).retention, 'permanent')
  })

  await t.test('고아 private 코디는 정리를 막지 않지만 살아 있는 다른 사진 연결은 막는다', async () => {
    const owner = await createOwner()
    const orphan = await createItem(owner.id)
    await createOutfit(owner.id, [orphan.item], true)
    const claim = await repository.claim(orphan.cutout.id, now)
    assert.ok(claim)
    const live = await createItem(owner.id)
    const outfit = await createOutfit(owner.id, [], false)
    await client.outfitGeneration.create({ data: { userId: owner.id, outfitId: outfit.id, imageAssetId: live.original.id, status: 'completed' } })
    assert.equal(await repository.claim(live.original.id, now), null)
  })

  await t.test('후보를 읽은 뒤 새 참조가 생기면 claim에서 다시 확인해 보호한다', async () => {
    const owner = await createOwner()
    const target = await createItem(owner.id)
    assert.ok((await repository.findCandidates(now, 100)).some((asset) => asset.id === target.cutout.id))
    await createOutfit(owner.id, [target.item])
    assert.equal(await repository.claim(target.cutout.id, now), null)
  })

  await t.test('CF 실패에는 옷 사진 연결을 유지하고 임대가 지난 배치에서 재시도한다', async (st) => {
    const owner = await createOwner()
    const target = await createItem(owner.id)
    const failCloudflare = st.mock.method(cloudflareImagesClient, 'deleteImage', async () => { throw new Error('검사용 CF 실패') })
    const failed = await service.cleanup({ execute: true, limit: 100, now })
    assert.equal(failed.deletedCount, 0)
    assert.deepEqual(failed.failedAssetIds.sort(), [target.cutout.id, target.original.id].sort())
    const preserved = await client.wardrobeItem.findUniqueOrThrow({ where: { id: target.item.id } })
    assert.equal(preserved.displayImageAssetId, target.cutout.id)
    assert.equal(preserved.originalImageAssetId, target.original.id)
    const state = await client.imageAsset.findUniqueOrThrow({ where: { id: target.cutout.id } })
    assert.equal(state.retention, 'deleting')
    assert.ok(state.expiresAt && state.expiresAt > now)
    assert.equal((await repository.findCandidates(now, 100)).length, 0)
    const calls: string[] = []
    failCloudflare.mock.restore()
    st.mock.method(cloudflareImagesClient, 'deleteImage', async (id: string) => { calls.push(id) })
    const retry = await service.cleanup({ execute: true, limit: 100, now: new Date(state.expiresAt!.getTime() + 1) })
    assert.equal(retry.deletedCount, 2)
    assert.deepEqual(calls.sort(), [target.cutout.cloudflareImageId, target.original.cloudflareImageId].sort())
  })

  await t.test('CF 404 응답은 이미 삭제된 파일로 처리하고 DB 연결을 정리한다', async (st) => {
    const owner = await createOwner()
    const target = await createItem(owner.id)
    const oldAccount = process.env.CF_ACCOUNT
    const oldToken = process.env.CF_TOKEN
    process.env.CF_ACCOUNT = 'integration-only'
    process.env.CF_TOKEN = 'integration-only'
    const calls: string[] = []
    st.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      assert.match(url, /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/integration-only\/images\/v1\//)
      assert.equal(init?.method, 'DELETE')
      calls.push(url.split('/').at(-1)!)
      return new Response('{}', { status: 404 })
    })
    try {
      const result = await service.cleanup({ execute: true, limit: 100, now })
      assert.equal(result.deletedCount, 2)
      assert.deepEqual(result.failedAssetIds, [])
      assert.deepEqual(calls.sort(), [target.cutout.cloudflareImageId, target.original.cloudflareImageId].sort())
    } finally {
      if (oldAccount === undefined) delete process.env.CF_ACCOUNT
      else process.env.CF_ACCOUNT = oldAccount
      if (oldToken === undefined) delete process.env.CF_TOKEN
      else process.env.CF_TOKEN = oldToken
    }
  })

  await t.test('CF 삭제 후 DB 정리에 실패해도 연결은 롤백하고 배치에서 완결한다', async (st) => {
    const owner = await createOwner()
    const target = await createItem(owner.id)
    const calls: string[] = []
    st.mock.method(cloudflareImagesClient, 'deleteImage', async (id: string) => { calls.push(id) })
    beforeQuery = ({ model, operation }) => {
      if (model === 'ImageAsset' && operation === 'deleteMany') throw new Error('검사용 DB 정리 실패')
    }
    const first = await service.cleanup({ execute: true, limit: 100, now })
    assert.equal(first.deletedCount, 0)
    const item = await client.wardrobeItem.findUniqueOrThrow({ where: { id: target.item.id } })
    assert.equal(item.displayImageAssetId, target.cutout.id)
    assert.equal(item.originalImageAssetId, target.original.id)
    const state = await client.imageAsset.findUniqueOrThrow({ where: { id: target.cutout.id } })
    beforeQuery = undefined
    const second = await service.cleanup({ execute: true, limit: 100, now: new Date(state.expiresAt!.getTime() + 1) })
    assert.equal(second.deletedCount, 2)
    assert.equal(await client.imageAsset.count({ where: { id: { in: [target.cutout.id, target.original.id] } } }), 0)
    assert.equal(calls.length, 4)
  })

  await t.test('오래된 삭제 임대는 새 임대의 연결을 해제하거나 자산을 제거하지 못한다', async () => {
    const owner = await createOwner()
    const target = await createItem(owner.id)
    const first = await repository.claim(target.cutout.id, now)
    assert.ok(first)
    await repository.release(first, now)
    const state = await client.imageAsset.findUniqueOrThrow({ where: { id: target.cutout.id } })
    const next = await repository.claim(target.cutout.id, new Date(state.expiresAt!.getTime() + 1))
    assert.ok(next)
    assert.equal((await repository.finalize(first)).count, 0)
    assert.equal((await client.wardrobeItem.findUniqueOrThrow({ where: { id: target.item.id } })).displayImageAssetId, target.cutout.id)
    assert.equal((await repository.finalize(next)).count, 1)
  })

  await t.test('삭제가 먼저 확정되면 같은 사진을 쓰는 새 옷 저장은 거절한다', async () => {
    const owner = await createOwner()
    const target = await createItem(owner.id)
    assert.ok(await repository.claim(target.cutout.id, now))
    await assert.rejects(wardrobeRepository.create(wardrobeCreateData(owner.id, target.cutout)), { code: 'INVALID_WARDROBE_IMAGE' })
    assert.equal(await client.wardrobeItem.count({ where: { displayImageAssetId: target.cutout.id } }), 1)
  })

  await t.test('새 옷 연결이 사진 잠금을 잡은 동안 시작한 정리는 충돌 후 재검사해 보존한다', async () => {
    const owner = await createOwner()
    const target = await createItem(owner.id)
    const writerLocked = deferred()
    const allowWriterCommit = deferred()
    const claimReachedAssetLock = deferred()
    const connecting = observe(aiTransaction(async (tx) => {
      await lockWardrobeImagesForReference(tx, owner.id, [target.cutout.id])
      await tx.wardrobeItem.create({ data: { ...wardrobeCreateData(owner.id, target.cutout), archivedAt: null } })
      writerLocked.resolve()
      await allowWriterCommit.promise
    }))
    try { await bounded(writerLocked.promise) }
    catch (error) {
      allowWriterCommit.resolve()
      await connecting.catch(() => undefined)
      throw error
    }
    beforeQuery = ({ model, operation, args }) => {
      const where = (args as { where?: { id?: string } }).where
      if (model === 'AiLease' && operation === 'upsert' && where?.id === `wardrobe-image:asset:${target.cutout.id}`) claimReachedAssetLock.resolve()
    }
    const claiming = observe(repository.claim(target.cutout.id, now))
    let phaseError: unknown
    try { await bounded(claimReachedAssetLock.promise) }
    catch (error) { phaseError = error }
    finally { allowWriterCommit.resolve() }
    await connecting
    const deletion = await claiming
    if (phaseError) throw phaseError
    assert.equal(deletion, null)
    beforeQuery = undefined
    assert.equal((await client.imageAsset.findUniqueOrThrow({ where: { id: target.cutout.id } })).retention, 'permanent')
    assert.equal(await client.wardrobeItem.count({ where: { displayImageAssetId: target.cutout.id } }), 2)
  })

  await t.test('코디 입력 검증 뒤 삭제·정리가 먼저 끝나면 코디 저장 시 다시 거절한다', async (st) => {
    const owner = await createOwner()
    const upper = await createItem(owner.id, false)
    const bottom = await createItem(owner.id, false, 'bottom')
    const validated = deferred()
    const continueSave = deferred()
    const lookup = wardrobeRepository.findManyOwnedByIds.bind(wardrobeRepository)
    st.mock.method(wardrobeRepository, 'findManyOwnedByIds', async (userId: string, ids: string[]) => {
      const items = await lookup(userId, ids)
      validated.resolve()
      await continueSave.promise
      return items
    })
    const saving = observe(outfitService.create(owner.id, { name: '오래된 화면에서 저장', style: 'casual', seasons: ['autumn'], items: [upper.item, bottom.item].map((item, layerOrder) => ({ wardrobeItemId: item.id, layerOrder })) }))
    try {
      await bounded(validated.promise)
      await wardrobeRepository.archive(upper.item.id)
      assert.ok(await repository.claim(upper.cutout.id, now))
    } catch (error) {
      continueSave.resolve()
      await saving.catch(() => undefined)
      throw error
    }
    continueSave.resolve()
    await assert.rejects(saving, { code: 'INVALID_OUTFIT_ITEMS' })
    assert.equal(await client.outfitItem.count({ where: { wardrobeItemId: upper.item.id } }), 0)
  })

  await t.test('생성 입력 검증 뒤 정리가 먼저 시작되면 작업 예약과 사용권 차감도 만들지 않는다', async (st) => {
    const owner = await createOwner()
    const upper = await createItem(owner.id, false)
    const bottom = await createItem(owner.id, false, 'bottom')
    await client.aiCreditWallet.create({ data: { userId: owner.id, balance: 5 } })
    const validated = deferred()
    const continueQueue = deferred()
    const lookup = wardrobeRepository.findManyOwnedWithImagesByIds.bind(wardrobeRepository)
    st.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async (userId: string, ids: string[]) => {
      const items = await lookup(userId, ids)
      validated.resolve()
      await continueQueue.promise
      return items
    })
    const queuing = observe(previewJobService.start(owner.id, { requestId: randomUUID(), selectedItemIds: [upper.item.id, bottom.item.id] }))
    try {
      await bounded(validated.promise)
      await wardrobeRepository.archive(upper.item.id)
      assert.ok(await repository.claim(upper.cutout.id, now))
    } catch (error) {
      continueQueue.resolve()
      await queuing.catch(() => undefined)
      throw error
    }
    continueQueue.resolve()
    await assert.rejects(queuing, { code: 'INVALID_OUTFIT_ITEMS' })
    assert.equal(await client.aiPreviewJob.count(), 0)
    assert.equal((await client.aiCreditWallet.findUniqueOrThrow({ where: { userId: owner.id } })).balance, 5)
  })

  await t.test('작업 예약이 먼저 완료되면 이후 옷 삭제·정리가 진행 작업의 사진을 보존한다', async () => {
    const owner = await createOwner()
    const upper = await createItem(owner.id, false)
    const bottom = await createItem(owner.id, false, 'bottom')
    const job = await previewJobRepository.enqueue({ id: randomUUID(), userId: owner.id, requestKey: randomUUID(), inputKey: randomUUID(), fingerprint: randomUUID(), selectedItemIds: [upper.item.id, bottom.item.id], style: null })
    await wardrobeRepository.archive(upper.item.id)
    assert.equal(job.status, 'queued')
    assert.equal(await repository.claim(upper.cutout.id, now), null)
    assert.equal(await repository.claim(upper.original.id, now), null)
  })

  await t.test('참조 잠금은 옷·사진의 메타데이터와 생성 입력에 쓰는 수정 시각을 바꾸지 않는다', async () => {
    const owner = await createOwner()
    const upper = await createItem(owner.id, false)
    const bottom = await createItem(owner.id, false, 'bottom')
    const itemIds = [upper.item.id, bottom.item.id]
    const imageIds = [upper.cutout.id, upper.original.id, bottom.cutout.id, bottom.original.id]
    const beforeItems = await client.wardrobeItem.findMany({ where: { id: { in: itemIds } }, orderBy: { id: 'asc' } })
    const beforeImages = await client.imageAsset.findMany({ where: { id: { in: imageIds } }, orderBy: { id: 'asc' } })
    await outfitRepository.create({
      userId: owner.id, name: '메타데이터 보존 코디', style: 'casual', seasons: ['autumn'], source: 'manual',
      items: [upper.item, bottom.item].map((item, layerOrder) => ({ wardrobeItemId: item.id, slot: item.category!, layerOrder })),
    })
    await previewJobRepository.enqueue({ id: randomUUID(), userId: owner.id, requestKey: randomUUID(), inputKey: randomUUID(), fingerprint: randomUUID(), selectedItemIds: itemIds, style: null })
    assert.deepEqual(await client.wardrobeItem.findMany({ where: { id: { in: itemIds } }, orderBy: { id: 'asc' } }), beforeItems)
    assert.deepEqual(await client.imageAsset.findMany({ where: { id: { in: imageIds } }, orderBy: { id: 'asc' } }), beforeImages)
  })

  await t.test('삭제 옷이 든 기존 코디를 날짜에 배정하는 동안에도 원본·누끼와 기록을 보존한다', async () => {
    const owner = await createOwner()
    const upper = await createItem(owner.id)
    const bottom = await createItem(owner.id, false, 'bottom')
    const book = await createOutfit(owner.id, [upper.item, bottom.item])
    const [assigned, deletion] = await Promise.all([
      plannerService.setEntry(owner.id, { weekStartsOn: '2026-11-02', date: '2026-11-02', outfitId: book.id }),
      repository.claim(upper.cutout.id, now),
    ])
    assert.equal(deletion, null)
    const entry = assigned?.entries.find((entry) => entry.date.toISOString().slice(0, 10) === '2026-11-02')
    assert.ok(entry?.outfit && entry.outfit.id !== book.id)
    assert.deepEqual(entry.outfit.items.map((item) => item.wardrobeItemId).sort(), [upper.item.id, bottom.item.id].sort())
    assert.equal(await client.imageAsset.count({ where: { id: { in: [upper.cutout.id, upper.original.id] } } }), 2)
  })
})
