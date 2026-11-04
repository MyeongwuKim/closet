import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { outfitRepository, type OutfitImageMutationResult, type outfitInclude } from './outfit.repository.js'
import { outfitService } from './outfit.service.js'
import { imageService } from '../image/image.service.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'

type StoredOutfit = Prisma.OutfitGetPayload<{ include: typeof outfitInclude }>
const generationInput = { userId: 'viewer', imageAssetId: 'new-image', model: 'model' }
const previewInput = { assetId: 'new-image', mimeType: 'image/png', model: 'model' }
const storedImage = { assetId: 'new-image', imageUrl: 'https://fixture.invalid/image.png', mimeType: 'image/png', model: 'model', metadata: { selectedItemIds: ['top', 'bottom'] }, retention: 'permanent' as const }

function outfit(id = 'outfit', imageIds = ['old-one', 'old-two'], plannerOnly = false): StoredOutfit {
  return {
    id, userId: 'viewer', name: '기존 코디', style: 'casual', seasons: ['spring'], source: 'ai', plannerOnly, note: null,
    items: [{ wardrobeItemId: 'top', slot: 'top', layerOrder: 0 }, { wardrobeItemId: 'bottom', slot: 'bottom', layerOrder: 1 }],
    generations: imageIds.map((imageAssetId, index) => ({
      id: `${id}-generation-${index}`, userId: 'viewer', imageAssetId, model: `model-${index}`, status: 'completed',
      requestedAt: new Date(Date.UTC(2026, 0, 10 - index)), imageAsset: { id: imageAssetId, cloudflareImageId: `cf-${imageAssetId}` },
    })),
  } as StoredOutfit
}

type DateReference = { id: string; outfitId: string; wornAt?: Date; wearFeeling?: string; wearTemperatureC?: number }

/** 같은 tx의 쓰기와 새 복사본을 메모리에 기록한다. 원본 교체 전에 날짜별 사진을 보존하는 순서도 확인한다. */
function transactionFixture(t: TestContext, sources = [outfit()], references: DateReference[] = []) {
  const calls: string[] = []
  const records = new Map(sources.map((source) => [source.id, source]))
  const createdData: Array<Record<string, any>> = []
  let updateData: Prisma.OutfitUpdateArgs['data'] | undefined
  const tx = {
    aiLease: { upsert: async () => ({}) },
    wardrobeItem: {
      findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id, archivedAt: null, updatedAt: new Date(0), displayImageAssetId: null, originalImageAssetId: null }),
    },
    imageAsset: {
      findFirst: async ({ where }: { where: { id: string } }) => ({ id: where.id, updatedAt: new Date('2026-01-01T00:00:00Z') }),
      updateMany: async () => { calls.push('lock'); return { count: 1 } },
    },
    outfit: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => records.get(where.id)!,
      findMany: async () => [...records.values()],
      create: async ({ data }: { data: Record<string, any> }) => {
        calls.push('create'); createdData.push(data)
        const copy = { ...outfit(`copy-${createdData.length}`, [], data.plannerOnly), ...data,
          items: data.items.create,
          generations: data.generations ? [{ ...data.generations.create, requestedAt: new Date(), imageAsset: { id: data.generations.create.imageAssetId, cloudflareImageId: `cf-${data.generations.create.imageAssetId}` } }] : [],
        } as StoredOutfit
        records.set(copy.id, copy)
        return copy
      },
      update: async ({ where, data }: Prisma.OutfitUpdateArgs) => {
        calls.push(`update:${where.id}`)
        if (!('updatedAt' in data) || Object.keys(data).length > 1) updateData = data
        const id = where.id
        assert.ok(id)
        const previous = records.get(id)!
        const updated = { ...previous, ...data, items: previous.items, generations: previous.generations } as StoredOutfit
        const generation = (data.generations as { create?: { imageAssetId: string } } | undefined)?.create
        if (generation) updated.generations = [{ ...generation, requestedAt: new Date(), imageAsset: { id: generation.imageAssetId, cloudflareImageId: `cf-${generation.imageAssetId}` } }] as StoredOutfit['generations']
        records.set(where.id!, updated)
        return updated
      },
      delete: async ({ where }: { where: { id: string } }) => { calls.push(`delete:${where.id}`); const deleted = records.get(where.id)!; records.delete(where.id); return deleted },
    },
    plannerEntry: {
      findMany: async ({ where }: { where: { outfitId: string } }) => references.filter((entry) => entry.outfitId === where.outfitId),
      updateMany: async ({ where, data }: { where: { id: string; outfitId: string }; data: { outfitId: string } }) => {
        calls.push('planner')
        const entry = references.find((value) => value.id === where.id && value.outfitId === where.outfitId)
        if (!entry) return { count: 0 }
        Object.assign(entry, data); return { count: 1 }
      },
    },
    outfitGeneration: { deleteMany: async () => { calls.push('unlink-source'); return { count: 1 } } },
    outfitItem: { deleteMany: async () => { calls.push('unlink-items'); return { count: 2 } } },
  }
  const originalTransaction = prisma.$transaction
  const transaction = t.mock.fn(async (operation: unknown) => {
    calls.push('begin')
    const result = await (operation as (client: typeof tx) => Promise<unknown>)(tx)
    calls.push('commit')
    return result
  })
  prisma.$transaction = transaction as typeof prisma.$transaction
  t.after(() => { prisma.$transaction = originalTransaction })
  return { calls, tx, transaction, references, records, createdData, data: () => updateData }
}

test('첫 코디 저장도 이미지 첨부 잠금과 같은 트랜잭션에서 실행한다', async (t) => {
  const fixture = transactionFixture(t)
  await outfitRepository.create({ userId: 'viewer', name: '코디', style: 'casual', seasons: ['spring'], source: 'ai', items: [], generation: generationInput })
  assert.deepEqual(fixture.calls, ['begin', 'lock', 'create', 'commit'])
})

test('같은 옷 구성이어도 새 AI 이미지는 이전 연결 전부와 원자적으로 교체한다', async (t) => {
  const fixture = transactionFixture(t)
  const result = await outfitRepository.update('outfit', { name: '코디', style: 'casual', seasons: ['spring'], items: [], resetGenerations: false, generation: generationInput })
  assert.deepEqual(fixture.calls, ['begin', 'lock', 'update:outfit', 'commit'])
  assert.deepEqual((fixture.data()?.generations as { deleteMany: unknown }).deleteMany, {})
  assert.equal((fixture.data()?.generations as { create: { imageAssetId: string } }).create.imageAssetId, 'new-image')
  assert.deepEqual(result.detachedAssets.map((asset) => asset.id), ['old-one', 'old-two'])
  assert.equal(fixture.transaction.mock.callCount(), 1)
})

test('새 이미지가 기존과 같은 자산이면 그 파일은 삭제 후보에서 제외하고 레거시 중복 연결만 정리한다', async (t) => {
  const fixture = transactionFixture(t)
  const result = await outfitRepository.addGeneration('outfit', { ...generationInput, imageAssetId: 'old-one' })
  assert.deepEqual(result.detachedAssets.map((asset) => asset.id), ['old-two'])
  assert.deepEqual((fixture.data()?.generations as { deleteMany: unknown }).deleteMany, {})
})

test('구성 변경에 새 AI 이미지가 없으면 모든 이전 연결을 같은 저장에서 해제한다', async (t) => {
  const fixture = transactionFixture(t)
  const result = await outfitRepository.update('outfit', { name: '코디', style: 'casual', seasons: ['spring'], items: [], resetGenerations: true })
  assert.deepEqual(fixture.calls, ['begin', 'update:outfit', 'commit'])
  assert.deepEqual(fixture.data()?.generations, { deleteMany: {} })
  assert.deepEqual(result.detachedAssets.map((asset) => asset.id), ['old-one', 'old-two'])
})

test('플래너에서 코디북으로 저장하면 최신 사진을 참조하는 별도 코디를 만들고 날짜는 그대로 둔다', async (t) => {
  const source = outfit('source', ['source-preview', 'source-old'], true)
  const references = [{ id: 'monday', outfitId: source.id }]
  const fixture = transactionFixture(t, [source], references)
  const result = await outfitRepository.copyPlannerOutfitToLookbook(source.id)
  assert.deepEqual(fixture.calls, ['begin', 'update:source', 'lock', 'create', 'commit'])
  assert.notEqual(result.outfit.id, source.id)
  assert.equal(result.outfit.plannerOnly, false)
  assert.equal(fixture.createdData[0].generations.create.imageAssetId, 'source-preview')
  assert.deepEqual(fixture.references, [{ id: 'monday', outfitId: source.id }])
  assert.equal(fixture.records.get(source.id)?.plannerOnly, true)
  assert.deepEqual(result.detachedAssets, [])
})

for (const explicitImage of [false, true]) {
  test(`같은 조합이 코디북에 있으면 ${explicitImage ? '새 사진을 전달해도' : '날짜 사진이 달라도'} 원본과 날짜를 수정하지 않는다`, async (t) => {
    const source = outfit('source', ['source-preview'], true)
    const target = outfit('target', ['target-preview'])
    const references = [{ id: 'monday', outfitId: source.id }]
    const fixture = transactionFixture(t, [source, target], references)
    const result = await outfitRepository.copyPlannerOutfitToLookbook(source.id, explicitImage ? generationInput : undefined)
    assert.equal(result.outfit.id, target.id)
    assert.equal(result.outfit.generations[0].imageAssetId, 'target-preview')
    assert.deepEqual(fixture.calls, ['begin', 'update:source', 'commit'])
    assert.deepEqual(fixture.references, [{ id: 'monday', outfitId: source.id }])
    assert.deepEqual(result.detachedAssets, [])
  })
}

test('기존 직접 연결 일정은 원본 사진 교체 전에 날짜별 복사하며 착용·체감·기온을 보존한다', async (t) => {
  const wornAt = new Date('2026-01-01T12:00:00Z')
  const references = [
    { id: 'monday', outfitId: 'outfit', wornAt, wearFeeling: 'cold', wearTemperatureC: 7 },
    { id: 'wednesday', outfitId: 'outfit' },
  ]
  const fixture = transactionFixture(t, [outfit()], references)
  const result = await outfitRepository.addGeneration('outfit', generationInput)
  assert.deepEqual(fixture.calls, ['begin', 'lock', 'create', 'planner', 'lock', 'create', 'planner', 'lock', 'update:outfit', 'commit'])
  assert.deepEqual(references.map((entry) => entry.outfitId), ['copy-1', 'copy-2'])
  assert.equal(references[0].wornAt, wornAt)
  assert.equal(references[0].wearFeeling, 'cold')
  assert.equal(references[0].wearTemperatureC, 7)
  assert.ok(fixture.createdData.every((data) => data.plannerOnly === true && data.generations.create.imageAssetId === 'old-one'))
  assert.equal(result.outfit.generations[0].imageAssetId, 'new-image')
})

test('코디 삭제도 날짜의 옷·사진을 먼저 복사하고 날짜 연결을 비우지 않는다', async (t) => {
  const fixture = transactionFixture(t, [outfit()], [{ id: 'monday', outfitId: 'outfit' }])
  await outfitRepository.remove('outfit')
  assert.equal(fixture.references[0].outfitId, 'copy-1')
  assert.deepEqual(fixture.calls, ['begin', 'lock', 'create', 'planner', 'unlink-source', 'unlink-items', 'delete:outfit', 'commit'])
  assert.equal(fixture.createdData[0].generations.create.imageAssetId, 'old-one')
})

test('삭제 claim 때문에 새 첨부 잠금을 얻지 못하면 기존 코디를 쓰기 전에 저장을 중단한다', async (t) => {
  const fixture = transactionFixture(t)
  fixture.tx.imageAsset.updateMany = async () => ({ count: 0 })
  await assert.rejects(outfitRepository.addGeneration('outfit', generationInput), { code: 'OUTFIT_PREVIEW_NOT_FOUND' })
  assert.deepEqual(fixture.calls, ['begin'])
})

test('코디북 복사 도중 실패하면 날짜를 옮기거나 원본을 지우지 않고 커밋하지 않는다', async (t) => {
  const source = outfit('source', ['source-preview'], true)
  const fixture = transactionFixture(t, [source], [{ id: 'monday', outfitId: source.id }])
  fixture.tx.outfit.create = async () => { throw new Error('코디북 저장 실패') }
  await assert.rejects(outfitRepository.copyPlannerOutfitToLookbook(source.id, generationInput), { message: '코디북 저장 실패' })
  assert.deepEqual(fixture.calls, ['begin', 'update:source', 'lock'])
  assert.deepEqual(fixture.references, [{ id: 'monday', outfitId: source.id }])
  assert.ok(fixture.records.has(source.id))
})

function mockServiceUpdate(t: TestContext, failSave = false) {
  const current = outfit()
  const calls: string[] = []
  t.mock.method(outfitRepository, 'findById', async () => current)
  t.mock.method(outfitRepository, 'findSavedCandidatesByItems', async () => [])
  t.mock.method(wardrobeRepository, 'findManyOwnedByIds', async () => [{ id: 'top', category: 'top' }, { id: 'bottom', category: 'bottom' }] as Awaited<ReturnType<typeof wardrobeRepository.findManyOwnedByIds>>)
  t.mock.method(imageService, 'getGeneratedImage', async () => storedImage)
  t.mock.method(outfitRepository, 'update', async () => {
    calls.push('save')
    if (failSave) throw new Error('저장 실패')
    return { outfit: current, detachedAssets: [{ id: 'old-one', cloudflareImageId: 'cf-old' }] }
  })
  return { current, calls }
}

const updateInput = { name: '코디', style: 'casual', seasons: ['spring' as const], items: [{ wardrobeItemId: 'top', layerOrder: 0 }, { wardrobeItemId: 'bottom', layerOrder: 1 }], previewImage: previewInput }

test('저장 커밋 뒤 이전 파일을 정리하며 삭제 실패는 저장 성공 응답을 바꾸지 않는다', async (t) => {
  const { current, calls } = mockServiceUpdate(t)
  t.mock.method(imageService, 'removeGeneratedImage', async () => { calls.push('cleanup'); throw new Error('Cloudflare 일시 실패') })
  assert.equal((await outfitService.update('viewer', current.id, updateInput)).id, current.id)
  assert.deepEqual(calls, ['save', 'cleanup'])
})

test('코디 저장 실패에는 이전 파일과 새 생성 원본을 모두 남겨 24시간 고아 정리에 맡긴다', async (t) => {
  const { current, calls } = mockServiceUpdate(t, true)
  const remove = t.mock.method(imageService, 'removeGeneratedImage', async () => { calls.push('cleanup') })
  await assert.rejects(outfitService.update('viewer', current.id, updateInput), { message: '저장 실패' })
  assert.deepEqual(calls, ['save'])
  assert.equal(remove.mock.callCount(), 0)
})

test('본문 방식의 새 업로드도 코디 저장 실패 시 즉시 삭제하지 않는다', async (t) => {
  const current = outfit()
  t.mock.method(outfitRepository, 'findById', async () => current)
  t.mock.method(imageService, 'storeGeneratedImage', async () => ({ id: 'uploaded-new', cloudflareImageId: 'cf-uploaded' }) as Awaited<ReturnType<typeof imageService.storeGeneratedImage>>)
  t.mock.method(outfitRepository, 'addGeneration', async () => { throw new Error('코디 저장 실패') })
  const remove = t.mock.method(imageService, 'removeGeneratedImage', async () => undefined)
  await assert.rejects(outfitService.addPreview('viewer', current.id, { imageBase64: 'fixture', mimeType: 'image/png', model: 'model' }), { message: '코디 저장 실패' })
  assert.equal(remove.mock.callCount(), 0)
})

test('코디북에 같은 조합이 있으면 서비스도 사진 덮어쓰기·플래너 합치기·파일 정리를 수행하지 않는다', async (t) => {
  const source = outfit('source', ['source-old'], true)
  const target = outfit('target', ['target-old'])
  t.mock.method(outfitRepository, 'findById', async () => source)
  t.mock.method(outfitRepository, 'findSavedCandidatesByItems', async () => [target])
  const getImage = t.mock.method(imageService, 'getGeneratedImage', async () => storedImage)
  const add = t.mock.method(outfitRepository, 'addGeneration', async () => { throw new Error('원본 사진 변경 금지') })
  const copy = t.mock.method(outfitRepository, 'copyPlannerOutfitToLookbook', async () => { throw new Error('중복 저장 금지') })
  const remove = t.mock.method(imageService, 'removeGeneratedImage', async () => undefined)
  assert.equal((await outfitService.copyPlannerOutfitToLookbook('viewer', source.id, previewInput)).id, target.id)
  assert.equal(getImage.mock.callCount(), 0)
  assert.equal(copy.mock.callCount(), 0)
  assert.equal(add.mock.callCount(), 0)
  assert.equal(remove.mock.callCount(), 0)
})

for (const failCopy of [false, true]) test(`새 코디북 복사 서비스는 생성 자산을 한 번만 전달하고 ${failCopy ? '실패 시 파일을 보존한다' : '날짜와 독립 저장한다'}`, async (t) => {
  const source = outfit('source', ['source-old'], true)
  const copied = outfit('copied', ['new-image'])
  t.mock.method(outfitRepository, 'findById', async () => source)
  t.mock.method(outfitRepository, 'findSavedCandidatesByItems', async () => [])
  t.mock.method(imageService, 'getGeneratedImage', async () => storedImage)
  const copy = t.mock.method(outfitRepository, 'copyPlannerOutfitToLookbook', async () => {
    if (failCopy) throw new Error('복사 실패')
    return { outfit: copied, detachedAssets: [] } as OutfitImageMutationResult
  })
  const remove = t.mock.method(imageService, 'removeGeneratedImage', async () => undefined)
  if (failCopy) await assert.rejects(outfitService.copyPlannerOutfitToLookbook('viewer', source.id, previewInput), { message: '복사 실패' })
  else assert.equal((await outfitService.copyPlannerOutfitToLookbook('viewer', source.id, previewInput)).id, copied.id)
  assert.deepEqual(copy.mock.calls[0]?.arguments, [source.id, generationInput])
  assert.equal(remove.mock.callCount(), 0)
})
