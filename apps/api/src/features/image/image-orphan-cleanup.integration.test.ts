import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import type { ImageAsset, PrismaClient } from '@prisma/client'

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim()

/**
 * TEST_DATABASE_URL이 가리키는 빈 closet_image_orphan_test_숫자 DB에서만 실행한다.
 * 주소가 없으면 Prisma·서비스를 런타임에 import하지도 않는다. CF는 대체하고 생성한 전용 DB만 종료 시 삭제한다.
 * 실제 MongoDB 트랜잭션을 지원하는 별도 테스트 인스턴스가 필요하다.
 */
test('별도 MongoDB에서 이미지 참조 보호와 코디북·플래너 기록 분리를 검증한다', {
  skip: testDatabaseUrl ? false : 'TEST_DATABASE_URL이 없어 실제 DB 통합 검사를 실행하지 않았습니다.',
}, async (t) => {
  let target: URL
  try { target = new URL(testDatabaseUrl!) }
  catch { throw new Error('TEST_DATABASE_URL에는 별도 MongoDB 테스트 주소가 필요합니다.') }
  assert.ok(['mongodb:', 'mongodb+srv:'].includes(target.protocol), 'MongoDB 테스트 주소만 허용합니다.')
  assert.match(target.pathname, /^\/closet_image_orphan_test_\d+$/, 'DB 이름은 closet_image_orphan_test_숫자 형식이어야 합니다.')

  // 기존 앱 singleton이 있으면 해당 DB를 건드리지 않고 중단한다. 이 파일은 독립된 테스트 프로세스에서 실행한다.
  const globals = globalThis as unknown as { prisma?: PrismaClient }
  assert.equal(globals.prisma, undefined, '이미 초기화된 앱 DB와 함께 실행할 수 없습니다.')
  const previousDatabaseUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = testDatabaseUrl
  const { PrismaClient } = await import('@prisma/client')
  const client = new PrismaClient({ datasources: { db: { url: testDatabaseUrl! } } })
  globals.prisma = client
  let ownsDatabase = false
  t.after(async () => {
    try {
      if (ownsDatabase) await client.$runCommandRaw({ dropDatabase: 1 })
    } finally {
      await client.$disconnect()
      delete globals.prisma
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = previousDatabaseUrl
    }
  })

  const { prisma } = await import('../../lib/prisma.js')
  assert.equal(prisma, client, '통합 검사는 전용 Prisma client만 사용할 수 있습니다.')
  const inventory = await client.$runCommandRaw({ listCollections: 1, nameOnly: true })
  const collections = (inventory as { cursor?: { firstBatch?: unknown[] } }).cursor?.firstBatch
  assert.ok(Array.isArray(collections) && collections.length === 0, '기존 컬렉션이 있는 DB는 사용하거나 정리하지 않습니다.')
  ownsDatabase = true
  for (const collection of ['User', 'ImageAsset', 'Outfit', 'OutfitGeneration', 'OutfitItem', 'WardrobeItem', 'PlannerWeek', 'PlannerEntry', 'AiPreviewJob', 'AiLease', 'CloudflareCleanupCursor']) {
    await client.$runCommandRaw({ create: collection })
  }
  await client.$runCommandRaw({ createIndexes: 'ImageAsset', indexes: [{ key: { cloudflareImageId: 1 }, name: 'integration_cloudflare_id', unique: true }] })

  const { aiTransaction } = await import('../../lib/ai/ai-storage.js')
  const { imageRepository, lockGeneratedImageForReference } = await import('./image.repository.js')
  const { imageService } = await import('./image.service.js')
  const { cloudflareImagesClient } = await import('./cloudflare-images.client.js')
  const { outfitRepository } = await import('../outfit/outfit.repository.js')
  const { outfitService } = await import('../outfit/outfit.service.js')
  const { plannerService } = await import('../planner/planner.service.js')
  const { cloudflareCleanupCursorRepository } = await import('./cloudflare-cleanup-cursor.repository.js')
  const now = new Date()
  const old = new Date(now.getTime() - 25 * 60 * 60_000)
  const user = await client.user.create({ data: { displayName: '이미지 고아 통합 테스트' } })
  const items = await Promise.all(['top', 'bottom'].map((category) => client.wardrobeItem.create({
    data: { userId: user.id, name: `테스트 ${category}`, category: category as 'top' | 'bottom', seasons: ['autumn'] },
  })))
  const outfitItems = items.map((item, index) => ({ wardrobeItemId: item.id, slot: item.category!, layerOrder: index }))
  const createImage = (overrides: Partial<Pick<ImageAsset, 'createdAt' | 'retention' | 'expiresAt' | 'aiPreviewJobId'>> = {}) => client.imageAsset.create({
    data: {
      userId: user.id, cloudflareImageId: `integration-${randomUUID()}`, kind: 'outfitGenerated', uploadStatus: 'ready',
      retention: 'permanent', expiresAt: null, mimeType: 'image/png', deliveryUrl: 'https://integration.invalid/image',
      createdAt: old, metadata: { purpose: 'outfitPreview', model: 'integration-fixture', selectedItemIds: items.map((item) => item.id) },
      ...overrides,
    },
  })
  const createOutfit = (imageAssetId?: string, plannerOnly = false) => client.outfit.create({
    data: {
      userId: user.id, name: `테스트 코디 ${randomUUID()}`, style: 'casual', seasons: ['autumn'], plannerOnly,
      items: { create: outfitItems },
      generations: imageAssetId ? { create: { userId: user.id, imageAssetId, status: 'completed', model: 'integration-fixture', completedAt: now } } : undefined,
    },
  })
  let failCloudflare = false
  const deletedCloudflareIds: string[] = []
  t.mock.method(cloudflareImagesClient, 'deleteImage', async (id: string) => {
    if (failCloudflare) throw new Error('테스트 CF 실패')
    deletedCloudflareIds.push(id)
  })

  /** 각 시나리오에 독립된 계정·ABC/ABD 구성·옷 구성 메타데이터가 일치하는 실제 DB 이미지를 준비한다. */
  const createPlannerScenario = async (label: string) => {
    const owner = await client.user.create({ data: { displayName: label } })
    const garments = await Promise.all((['top', 'bottom', 'outer', 'outer'] as const).map((category, index) => client.wardrobeItem.create({
      data: { userId: owner.id, name: `${label}-${'ABCD'[index]}`, category, seasons: ['autumn'] },
    })))
    const abc = garments.slice(0, 3).map((item) => item.id)
    const abd = [garments[0]!.id, garments[1]!.id, garments[3]!.id]
    const imageFor = (itemIds: string[]) => client.imageAsset.create({
      data: {
        userId: owner.id, cloudflareImageId: `planner-snapshot-${randomUUID()}`, kind: 'outfitGenerated',
        uploadStatus: 'ready', retention: 'permanent', expiresAt: null, mimeType: 'image/png',
        deliveryUrl: 'https://integration.invalid/planner-snapshot', createdAt: old,
        metadata: { purpose: 'outfitPreview', model: 'integration-fixture', selectedItemIds: [...itemIds].sort(), style: 'casual' },
      },
    })
    const preview = (image: ImageAsset) => ({ assetId: image.id, mimeType: 'image/png', model: 'integration-fixture' })
    const outfitInput = (name: string, itemIds: string[], image: ImageAsset) => ({
      name, style: 'casual', seasons: ['autumn' as const],
      items: itemIds.map((wardrobeItemId, layerOrder) => ({ wardrobeItemId, layerOrder })),
      previewImage: preview(image),
    })
    const originalImage = await imageFor(abc)
    const replacementImage = await imageFor(abd)
    const saved = await outfitService.create(owner.id, outfitInput(`${label}-ABC`, abc, originalImage))
    const entryAt = (date: string) => client.plannerEntry.findFirstOrThrow({
      where: { date: new Date(date), plannerWeek: { is: { userId: owner.id } } },
      include: { outfit: { include: { items: true, generations: true } } },
    })
    return { owner, abc, abd, saved, originalImage, replacementImage, imageFor, preview, outfitInput, entryAt }
  }

  const entryItemIds = (entry: Awaited<ReturnType<Awaited<ReturnType<typeof createPlannerScenario>>['entryAt']>>) => {
    assert.ok(entry.outfit, '플래너에 저장한 날짜 코디가 남아 있어야 합니다.')
    return entry.outfit.items.map((item) => item.wardrobeItemId).sort()
  }

  const entryImageId = (entry: Awaited<ReturnType<Awaited<ReturnType<typeof createPlannerScenario>>['entryAt']>>) => {
    assert.ok(entry.outfit, '플래너에 저장한 날짜 코디가 남아 있어야 합니다.')
    return entry.outfit.generations.find((generation) => generation.status === 'completed')?.imageAssetId
  }

  await t.test('원격 정리 진행점의 동시 생성·진행은 한 번만 반영하고 다른 CF 계정과 분리한다', async () => {
    const id = 'integration-cf-account'
    const initial = await cloudflareCleanupCursorRepository.read(id)
    const created = await Promise.all(['page-a', 'page-b'].map((token) => cloudflareCleanupCursorRepository.advance(id, initial, token)))
    assert.equal(created.filter(Boolean).length, 1)
    const saved = await cloudflareCleanupCursorRepository.read(id)
    assert.equal(saved.revision, 1)
    const advanced = await Promise.all(['page-c', 'page-d'].map((token) => cloudflareCleanupCursorRepository.advance(id, saved, token)))
    assert.equal(advanced.filter(Boolean).length, 1)
    assert.equal(await cloudflareCleanupCursorRepository.advance(id, saved, 'stale-page'), false)
    assert.equal((await cloudflareCleanupCursorRepository.read(id)).revision, 2)
    assert.deepEqual(await cloudflareCleanupCursorRepository.read('other-account'), { continuationToken: undefined, revision: 0 })
  })

  await t.test('저장 코디의 공유 이미지와 옷장 관계가 있는 이미지는 보호한다', async () => {
    const shared = await createImage()
    const first = await createOutfit(shared.id)
    const second = await createOutfit(shared.id)
    assert.equal(await imageRepository.claimExpiredGeneratedPreview(shared.id, now), null)
    await client.outfitGeneration.deleteMany({ where: { outfitId: first.id } })
    await imageService.removeGeneratedImage(user.id, shared)
    assert.equal(deletedCloudflareIds.length, 0)
    assert.equal((await client.imageAsset.findUniqueOrThrow({ where: { id: shared.id } })).retention, 'permanent')
    assert.equal(await client.outfitGeneration.count({ where: { outfitId: second.id, imageAssetId: shared.id } }), 1)

    // 과거 데이터에 남은 원본 관계도 실제 MongoDB 관계 필터가 보호하는지 확인한다.
    const wardrobeLinked = await createImage()
    await client.wardrobeItem.create({ data: { userId: user.id, name: '기존 원본 연결', originalImageAssetId: wardrobeLinked.id, seasons: [] } })
    assert.equal(await imageRepository.claimExpiredGeneratedPreview(wardrobeLinked.id, now), null)
    const candidates = await imageRepository.findExpiredGeneratedPreviews(now, 100)
    assert.ok(candidates.every((candidate) => candidate.id !== shared.id && candidate.id !== wardrobeLinked.id))
  })

  await t.test('24시간 전 고아만 claim하고 claim 뒤의 새 이미지 연결은 트랜잭션에서 거절한다', async () => {
    const fresh = await createImage({ createdAt: new Date(now.getTime() - 23 * 60 * 60_000) })
    const orphan = await createImage()
    assert.equal(await imageRepository.claimExpiredGeneratedPreview(fresh.id, now), null)
    const deletion = await imageRepository.claimExpiredGeneratedPreview(orphan.id, now)
    assert.ok(deletion)
    assert.equal((await client.imageAsset.findUniqueOrThrow({ where: { id: orphan.id } })).retention, 'deleting')
    const targetOutfit = await createOutfit()
    await assert.rejects(aiTransaction(async (tx) => {
      await lockGeneratedImageForReference(tx, user.id, orphan.id)
      await tx.outfitGeneration.create({ data: { userId: user.id, outfitId: targetOutfit.id, imageAssetId: orphan.id, status: 'completed' } })
    }), { code: 'OUTFIT_PREVIEW_NOT_FOUND' })
    assert.equal(await client.outfitGeneration.count({ where: { imageAssetId: orphan.id } }), 0)
  })

  await t.test('숨은 고아 플래너 코디의 연결은 정리하고 실제 날짜와 생성 복구 중인 결과는 남긴다', async () => {
    const orphan = await createImage()
    const orphanOutfit = await createOutfit(orphan.id, true)
    const live = await createImage()
    const liveOutfit = await createOutfit(live.id, true)
    const week = await client.plannerWeek.create({ data: { userId: user.id, weekStartsOn: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) } })
    await client.plannerEntry.create({ data: { plannerWeekId: week.id, date: week.weekStartsOn, outfitId: liveOutfit.id } })
    const recoveryJob = await client.aiPreviewJob.create({ data: {
      id: randomUUID(), userId: user.id, requestKeys: [randomUUID()], inputKey: randomUUID(), fingerprint: randomUUID(),
      selectedItemIds: items.map((item) => item.id), status: 'processing', leaseToken: 'integration-recovery',
      leaseUntil: new Date(now.getTime() - 1000), expiresAt: new Date(now.getTime() + 86_400_000),
    } })
    const recovering = await createImage({ aiPreviewJobId: recoveryJob.id })
    const candidates = await imageRepository.findExpiredGeneratedPreviews(now, 100)
    assert.ok(candidates.some((candidate) => candidate.id === orphan.id))
    assert.ok(candidates.every((candidate) => candidate.id !== live.id && candidate.id !== recovering.id))
    assert.ok(await imageRepository.claimExpiredGeneratedPreview(orphan.id, now))
    assert.equal(await client.outfitGeneration.count({ where: { outfitId: orphanOutfit.id } }), 0)
    assert.equal(await imageRepository.claimExpiredGeneratedPreview(live.id, now), null)
    assert.equal(await imageRepository.claimExpiredGeneratedPreview(recovering.id, now), null)
    assert.equal(await client.outfitGeneration.count({ where: { outfitId: liveOutfit.id } }), 1)
  })

  await t.test('이미지 교체 커밋 뒤에는 새 연결만 남고 CF 실패 기록은 다음 배치까지 유지한다', async () => {
    const previous = await createImage()
    const replacement = await createImage({ createdAt: now })
    const outfit = await createOutfit(previous.id)
    const saved = await outfitRepository.update(outfit.id, {
      name: '이미지 교체', style: 'casual', seasons: ['autumn'], items: outfitItems, resetGenerations: false,
      generation: { userId: user.id, imageAssetId: replacement.id, model: 'integration-replacement' },
    })
    assert.equal(await client.outfitGeneration.count({ where: { outfitId: outfit.id, imageAssetId: previous.id } }), 0)
    assert.equal(await client.outfitGeneration.count({ where: { outfitId: outfit.id, imageAssetId: replacement.id } }), 1)
    assert.deepEqual(saved.detachedAssets.map((image) => image.id), [previous.id])
    failCloudflare = true
    try { await imageService.removeGeneratedImage(user.id, previous) }
    finally { failCloudflare = false }
    const failed = await client.imageAsset.findUniqueOrThrow({ where: { id: previous.id } })
    assert.equal(failed.retention, 'deleting')
    assert.ok(failed.expiresAt && failed.expiresAt > now)
    const retryAt = new Date(failed.expiresAt!.getTime() + 1)
    const retried = await imageService.cleanupExpiredGeneratedPreviews({ execute: true, limit: 100, now: retryAt })
    assert.ok(retried.deletedCount >= 1)
    assert.deepEqual(retried.failedAssetIds, [])
    assert.equal(await client.imageAsset.findUnique({ where: { id: previous.id } }), null)
    assert.ok(deletedCloudflareIds.includes(previous.cloudflareImageId))
    assert.ok(await client.imageAsset.findUnique({ where: { id: replacement.id } }))
    assert.equal(await client.outfitGeneration.count({ where: { outfitId: outfit.id, imageAssetId: replacement.id } }), 1)
  })

  await t.test('코디북을 ABD와 새 이미지로 바꿔도 날짜별 ABC·당시 이미지·착용과 체감은 보존한다', async () => {
    const scenario = await createPlannerScenario('코디북 수정 분리')
    const weekStartsOn = '2020-11-02'
    for (const date of ['2020-11-02', '2020-11-03']) {
      await plannerService.setEntry(scenario.owner.id, { weekStartsOn, date, outfitId: scenario.saved.id })
    }
    const first = await scenario.entryAt('2020-11-02')
    const second = await scenario.entryAt('2020-11-03')
    assert.notEqual(first.outfitId, scenario.saved.id)
    assert.notEqual(second.outfitId, scenario.saved.id)
    assert.notEqual(first.outfitId, second.outfitId)
    assert.equal(first.outfit?.plannerOnly, true)
    assert.equal(second.outfit?.plannerOnly, true)

    await plannerService.setEntryWorn(scenario.owner.id, { weekStartsOn, date: '2020-11-02', outfitId: first.outfitId!, worn: true })
    const worn = await scenario.entryAt('2020-11-02')
    assert.ok(worn.wornAt)
    await plannerService.setEntryWearFeeling(scenario.owner.id, {
      weekStartsOn, date: '2020-11-02', outfitId: first.outfitId!, wornAt: worn.wornAt.toISOString(), feeling: 'cold',
    })
    await client.plannerEntry.update({ where: { id: first.id }, data: { wearTemperatureC: 12.5, wearWeatherRecordedAt: now } })
    await outfitService.update(scenario.owner.id, scenario.saved.id, scenario.outfitInput('변경한 ABD', scenario.abd, scenario.replacementImage))

    const after = await scenario.entryAt('2020-11-02')
    assert.deepEqual(entryItemIds(after), [...scenario.abc].sort())
    assert.deepEqual(entryItemIds(await scenario.entryAt('2020-11-03')), [...scenario.abc].sort())
    assert.equal(entryImageId(after), scenario.originalImage.id)
    assert.equal(entryImageId(await scenario.entryAt('2020-11-03')), scenario.originalImage.id)
    assert.equal(after.outfit?.name, scenario.saved.name)
    assert.equal(after.wornAt?.getTime(), worn.wornAt.getTime())
    assert.equal(after.wearFeeling, 'cold')
    assert.equal(after.wearTemperatureC, 12.5)
    const currentBook = await outfitService.get(scenario.owner.id, scenario.saved.id)
    assert.deepEqual(currentBook.items.map((item) => item.wardrobeItemId).sort(), [...scenario.abd].sort())
    assert.equal(currentBook.generations[0]?.imageAssetId, scenario.replacementImage.id)
    assert.equal(await imageRepository.claimExpiredGeneratedPreview(scenario.originalImage.id, now), null)
    assert.equal(deletedCloudflareIds.includes(scenario.originalImage.cloudflareImageId), false)
  })

  await t.test('코디북 수정과 날짜 배정이 겹쳐도 복사한 옷 구성·이미지·소유권은 같은 시점으로 일치한다', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const scenario = await createPlannerScenario(`동시 배정 ${attempt}`)
      const weekStartsOn = '2020-12-07'
      const date = '2020-12-07'
      // 준비용 주 생성은 경합에서 빼고, 실제 사용자 작업인 원본 수정과 날짜 배정을 동시에 실행한다.
      const week = await client.plannerWeek.create({ data: { userId: scenario.owner.id, weekStartsOn: new Date(weekStartsOn) } })
      await Promise.all([
        plannerService.setEntry(scenario.owner.id, { weekStartsOn, date, outfitId: scenario.saved.id }),
        outfitService.update(scenario.owner.id, scenario.saved.id, scenario.outfitInput('수정된 ABD', scenario.abd, scenario.replacementImage)),
      ])

      const entry = await scenario.entryAt(date)
      const copiedItemIds = entryItemIds(entry)
      const copiedImageId = entryImageId(entry)
      assert.ok(copiedImageId)
      const copiedImage = await client.imageAsset.findUniqueOrThrow({ where: { id: copiedImageId } })
      const imageItemIds = (copiedImage.metadata as { selectedItemIds: string[] }).selectedItemIds
      assert.deepEqual([...imageItemIds].sort(), copiedItemIds)
      const isOriginalPair = copiedImageId === scenario.originalImage.id && copiedItemIds.join(',') === [...scenario.abc].sort().join(',')
      const isUpdatedPair = copiedImageId === scenario.replacementImage.id && copiedItemIds.join(',') === [...scenario.abd].sort().join(',')
      assert.ok(isOriginalPair || isUpdatedPair, '수정 전 ABC/사진 또는 수정 후 ABD/사진 중 온전한 한 쌍이어야 합니다.')
      assert.notEqual(entry.outfitId, scenario.saved.id)
      assert.equal(entry.outfit?.userId, scenario.owner.id)
      assert.equal(copiedImage.userId, scenario.owner.id)
      assert.equal(entry.plannerWeekId, week.id)
      assert.equal((await client.plannerWeek.findUniqueOrThrow({ where: { id: entry.plannerWeekId } })).userId, scenario.owner.id)
      const book = await outfitService.get(scenario.owner.id, scenario.saved.id)
      assert.deepEqual(book.items.map((item) => item.wardrobeItemId).sort(), [...scenario.abd].sort())
      assert.equal(book.generations[0]?.imageAssetId, scenario.replacementImage.id)
    }
  })

  await t.test('같은 코디의 재배정과 같은 옷의 사진 교체는 착용·체감·기온을 유지하고 날짜 복사본을 중복 생성하지 않는다', async () => {
    const scenario = await createPlannerScenario('같은 날짜 재저장')
    const weekStartsOn = '2020-12-14'
    const date = '2020-12-14'
    const input = { weekStartsOn, date, outfitId: scenario.saved.id }
    await plannerService.setEntry(scenario.owner.id, input)
    const original = await scenario.entryAt(date)
    assert.ok(original.outfitId)
    await plannerService.setEntryWorn(scenario.owner.id, { ...input, outfitId: original.outfitId, worn: true })
    const worn = await scenario.entryAt(date)
    assert.ok(worn.wornAt)
    await plannerService.setEntryWearFeeling(scenario.owner.id, {
      weekStartsOn, date, outfitId: original.outfitId, wornAt: worn.wornAt.toISOString(), feeling: 'comfortable',
    })
    await client.plannerEntry.update({ where: { id: original.id }, data: { wearTemperatureC: 14, wearWeatherRecordedAt: now } })
    const privateCount = await client.outfit.count({ where: { userId: scenario.owner.id, plannerOnly: true } })
    assert.equal(privateCount, 1)

    await plannerService.setEntry(scenario.owner.id, input)
    await plannerService.setEntry(scenario.owner.id, input)
    const reassigned = await scenario.entryAt(date)
    assert.equal(reassigned.outfitId, original.outfitId)
    assert.equal(reassigned.wornAt?.getTime(), worn.wornAt.getTime())
    assert.equal(reassigned.wearFeeling, 'comfortable')
    assert.equal(reassigned.wearTemperatureC, 14)
    assert.equal(reassigned.wearWeatherRecordedAt?.getTime(), now.getTime())
    assert.equal(await client.outfit.count({ where: { userId: scenario.owner.id, plannerOnly: true } }), privateCount)

    const nextImage = await scenario.imageFor(scenario.abc)
    await plannerService.setDirectEntry(scenario.owner.id, {
      weekStartsOn, date, itemIds: scenario.abc, previewImage: scenario.preview(nextImage), recommendationStyle: 'casual',
    })
    const imageChanged = await scenario.entryAt(date)
    assert.deepEqual(entryItemIds(imageChanged), [...scenario.abc].sort())
    assert.equal(entryImageId(imageChanged), nextImage.id)
    assert.equal(imageChanged.wornAt?.getTime(), worn.wornAt.getTime())
    assert.equal(imageChanged.wearFeeling, 'comfortable')
    assert.equal(imageChanged.wearTemperatureC, 14)
    assert.equal(imageChanged.wearWeatherRecordedAt?.getTime(), now.getTime())
    assert.equal(await client.outfit.count({ where: { userId: scenario.owner.id, plannerOnly: true } }), privateCount)
    assert.equal((await outfitService.get(scenario.owner.id, scenario.saved.id)).generations[0]?.imageAssetId, scenario.originalImage.id)
  })

  await t.test('한 날짜의 옷·AI 이미지 변경과 비우기는 코디북이나 다른 날짜를 바꾸지 않는다', async () => {
    const scenario = await createPlannerScenario('날짜 편집 분리')
    const weekStartsOn = '2020-11-09'
    for (const date of ['2020-11-09', '2020-11-10']) {
      await plannerService.setEntry(scenario.owner.id, { weekStartsOn, date, outfitId: scenario.saved.id })
    }
    const second = await scenario.entryAt('2020-11-10')
    await plannerService.setDirectEntry(scenario.owner.id, {
      weekStartsOn, date: '2020-11-09', itemIds: scenario.abd, previewImage: scenario.preview(scenario.replacementImage),
      recommendationName: '이 날짜만 ABD', recommendationStyle: 'casual',
    })
    assert.deepEqual(entryItemIds(await scenario.entryAt('2020-11-09')), [...scenario.abd].sort())
    assert.equal(entryImageId(await scenario.entryAt('2020-11-09')), scenario.replacementImage.id)
    assert.equal((await scenario.entryAt('2020-11-10')).outfitId, second.outfitId)
    assert.deepEqual(entryItemIds(await scenario.entryAt('2020-11-10')), [...scenario.abc].sort())
    assert.equal(entryImageId(await scenario.entryAt('2020-11-10')), scenario.originalImage.id)

    await plannerService.clearEntry(scenario.owner.id, weekStartsOn, '2020-11-09')
    assert.equal((await scenario.entryAt('2020-11-09')).outfitId, null)
    assert.deepEqual(entryItemIds(await scenario.entryAt('2020-11-10')), [...scenario.abc].sort())
    const currentBook = await outfitService.get(scenario.owner.id, scenario.saved.id)
    assert.deepEqual(currentBook.items.map((item) => item.wardrobeItemId).sort(), [...scenario.abc].sort())
    assert.equal(currentBook.generations[0]?.imageAssetId, scenario.originalImage.id)
  })

  await t.test('코디북 삭제 뒤에도 날짜 코디와 그 AI 이미지를 보관한다', async () => {
    const scenario = await createPlannerScenario('코디북 삭제 분리')
    await plannerService.setEntry(scenario.owner.id, { weekStartsOn: '2020-11-16', date: '2020-11-16', outfitId: scenario.saved.id })
    const before = await scenario.entryAt('2020-11-16')
    await outfitService.remove(scenario.owner.id, scenario.saved.id)
    const after = await scenario.entryAt('2020-11-16')
    assert.equal(after.outfitId, before.outfitId)
    assert.deepEqual(entryItemIds(after), [...scenario.abc].sort())
    assert.equal(entryImageId(after), scenario.originalImage.id)
    assert.ok(await client.imageAsset.findUnique({ where: { id: scenario.originalImage.id } }))
    assert.equal(deletedCloudflareIds.includes(scenario.originalImage.cloudflareImageId), false)
  })

  await t.test('플래너에서 코디북에 저장해도 날짜 코디를 승격하거나 연결 대상을 합치지 않는다', async () => {
    const scenario = await createPlannerScenario('플래너 저장 분리')
    const weekStartsOn = '2020-11-23'
    await plannerService.setDirectEntry(scenario.owner.id, {
      weekStartsOn, date: '2020-11-23', itemIds: scenario.abd, previewImage: scenario.preview(scenario.replacementImage),
      recommendationName: '날짜용 ABD', recommendationStyle: 'casual',
    })
    const before = await scenario.entryAt('2020-11-23')
    assert.ok(before.outfitId)
    const book = await plannerService.savePlannerOutfitToLookbook(scenario.owner.id, before.outfitId)
    assert.notEqual(book.id, before.outfitId)
    assert.equal(book.plannerOnly, false)
    const afterSave = await scenario.entryAt('2020-11-23')
    assert.equal(afterSave.outfitId, before.outfitId)
    assert.equal(afterSave.outfit?.plannerOnly, true)

    const nextImage = await scenario.imageFor(scenario.abd)
    await outfitService.update(scenario.owner.id, book.id, scenario.outfitInput('코디북만 이름·사진 변경', scenario.abd, nextImage))
    assert.equal((await scenario.entryAt('2020-11-23')).outfit?.name, '날짜용 ABD')
    assert.equal(entryImageId(await scenario.entryAt('2020-11-23')), scenario.replacementImage.id)
    await outfitService.remove(scenario.owner.id, book.id)
    assert.deepEqual(entryItemIds(await scenario.entryAt('2020-11-23')), [...scenario.abd].sort())
    assert.equal(entryImageId(await scenario.entryAt('2020-11-23')), scenario.replacementImage.id)
  })

  for (const operation of ['update', 'preview', 'remove'] as const) {
    await t.test(`이전 버전의 코디북 직접 연결 기록도 ${operation} 전에 당시 구성·사진·착용을 분리 보존한다`, async () => {
      const scenario = await createPlannerScenario(`기존 기록 ${operation}`)
      const week = await client.plannerWeek.create({ data: { userId: scenario.owner.id, weekStartsOn: new Date('2020-11-30') } })
      const confirmedAt = new Date('2020-11-30T10:00:00Z')
      const legacy = await client.plannerEntry.create({ data: {
        plannerWeekId: week.id, date: week.weekStartsOn, outfitId: scenario.saved.id, title: '당시 ABC',
        wornAt: confirmedAt, wearFeeling: 'comfortable', wearTemperatureC: 13, wearWeatherRecordedAt: now,
      } })
      if (operation === 'update') {
        await outfitService.update(scenario.owner.id, scenario.saved.id, scenario.outfitInput('새 ABD', scenario.abd, scenario.replacementImage))
      } else if (operation === 'preview') {
        const newImage = await scenario.imageFor(scenario.abc)
        await outfitService.addPreview(scenario.owner.id, scenario.saved.id, scenario.preview(newImage))
      } else {
        await outfitService.remove(scenario.owner.id, scenario.saved.id)
      }

      const after = await scenario.entryAt('2020-11-30')
      assert.notEqual(after.outfitId, scenario.saved.id)
      assert.equal(after.id, legacy.id)
      assert.equal(after.title, '당시 ABC')
      assert.equal(after.outfit?.plannerOnly, true)
      assert.deepEqual(entryItemIds(after), [...scenario.abc].sort())
      assert.equal(entryImageId(after), scenario.originalImage.id)
      assert.equal(after.wornAt?.getTime(), confirmedAt.getTime())
      assert.equal(after.wearFeeling, 'comfortable')
      assert.equal(after.wearTemperatureC, 13)
      assert.equal(await imageRepository.claimExpiredGeneratedPreview(scenario.originalImage.id, now), null)
      assert.equal(deletedCloudflareIds.includes(scenario.originalImage.cloudflareImageId), false)
    })
  }
})
