import assert from 'node:assert/strict'
import test from 'node:test'
import type { ImageAsset } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { cloudflareImagesClient } from './cloudflare-images.client.js'
import { imageRepository, type CreateImageAssetData } from './image.repository.js'
import { imageService } from './image.service.js'

const userId = 'owner'
const url = 'https://images.invalid/generated/public'
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')

function asset(overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    id: 'asset', userId, cloudflareImageId: 'cloud-image', kind: 'outfitGenerated', uploadStatus: 'ready',
    retention: 'temporary', expiresAt: new Date('2020-01-01'), deliveryVariant: 'public', deliveryUrl: url,
    originalFilename: null, storageFilename: 'generated.png', mimeType: 'image/png', width: null, height: null,
    metadata: { model: 'test-model', purpose: 'outfitPreview', selectedItemIds: ['top', 'bottom'] },
    aiPreviewJobId: 'job', createdAt: new Date('2020-01-01'), updatedAt: new Date('2020-01-01'),
    ...overrides,
  }
}

test('생성 응답은 예전 temporary 옵션이 있어도 처음부터 permanent/null로 저장한다', async (t) => {
  t.mock.method(cloudflareImagesClient, 'uploadImage', async () => ({ id: 'cloud-image', variants: [url] }))
  const inputs: CreateImageAssetData[] = []
  t.mock.method(imageRepository, 'create', async (data: CreateImageAssetData) => { inputs.push(data); return asset({ retention: 'permanent', expiresAt: null }) })
  for (const temporary of [true, false, undefined]) {
    await imageService.storeGeneratedImage(userId, { imageBase64: png, mimeType: 'image/png', model: 'test-model', temporary, jobId: 'job' })
  }
  assert.equal(inputs.length, 3)
  for (const input of inputs) {
    assert.equal(input.retention, 'permanent')
    assert.equal(input.expiresAt, null)
    assert.equal(input.aiPreviewJobId, 'job')
  }
})

test('저장소는 생성 이미지의 조회 만료를 비우고 일반 업로드의 기존 정책은 유지한다', async (t) => {
  const calls: any[] = []
  const original = prisma.imageAsset.create
  prisma.imageAsset.create = (async (args: unknown) => { calls.push(args); return asset() }) as unknown as typeof original
  t.after(() => { prisma.imageAsset.create = original })
  const input = { userId, kind: 'outfitGenerated' as const, cloudflareImageId: 'cloud', storageFilename: 'image.png', retention: 'temporary' as const, expiresAt: new Date('2020-01-01') }
  await imageRepository.create(input)
  assert.equal(calls[0].data.retention, 'permanent')
  assert.equal(calls[0].data.expiresAt, null)
  await imageRepository.create({ ...input, kind: 'wardrobeOriginal' })
  assert.equal(calls[1].data.retention, 'temporary')
  assert.equal(calls[1].data.expiresAt, input.expiresAt)
})

test('이미 1시간 넘게 지난 임시 생성 결과도 삭제 claim 전에는 작업 ID 유무와 무관하게 조회한다', async (t) => {
  let current = asset()
  t.mock.method(imageRepository, 'findOwnedById', async (owner: string, id: string) => { assert.equal(owner, userId); assert.equal(id, 'asset'); return current })
  const promote = t.mock.method(imageRepository, 'markGeneratedPreviewPermanent', async (owner: string, id: string) => { assert.equal(owner, userId); assert.equal(id, 'asset'); return { count: 1 } })
  for (const aiPreviewJobId of ['job', null]) {
    current = asset({ aiPreviewJobId })
    const result = await imageService.getGeneratedImage(userId, 'asset')
    assert.equal(result.imageUrl, url)
    assert.equal(result.retention, 'permanent')
  }
  assert.equal(promote.mock.callCount(), 2)
})

test('조회 만료 메타데이터가 없는 결과는 단순 조회에서 다시 쓰지 않는다', async (t) => {
  t.mock.method(imageRepository, 'findOwnedById', async () => asset({ retention: 'permanent', expiresAt: null }))
  const promote = t.mock.method(imageRepository, 'markGeneratedPreviewPermanent', async () => { throw new Error('불필요한 변경') })
  assert.equal((await imageService.getGeneratedImage(userId, 'asset')).retention, 'permanent')
  assert.equal(promote.mock.callCount(), 0)
})

test('중단 작업의 이미지 조회는 만료 필터 없이 본인의 준비된 생성 결과만 찾는다', async (t) => {
  let query: any
  const original = prisma.imageAsset.findFirst
  prisma.imageAsset.findFirst = (async (args: unknown) => { query = args; return asset() }) as unknown as typeof original
  t.after(() => { prisma.imageAsset.findFirst = original })
  await imageRepository.findByPreviewJob(userId, 'job')
  assert.deepEqual(query.where, { userId, aiPreviewJobId: 'job', kind: 'outfitGenerated', uploadStatus: 'ready', retention: { in: ['permanent', 'temporary'] } })
})

test('없음·다른 종류·미완료·삭제 중·모델 누락 결과는 보관 정책 변경과 관계없이 거절한다', async (t) => {
  let current: ImageAsset | null = null
  t.mock.method(imageRepository, 'findOwnedById', async () => current)
  const promote = t.mock.method(imageRepository, 'markGeneratedPreviewPermanent', async () => ({ count: 1 }))
  for (const value of [null, asset({ kind: 'wardrobeOriginal' }), asset({ uploadStatus: 'pending' }), asset({ retention: 'deleting' }), asset({ metadata: {} })]) {
    current = value
    await assert.rejects(imageService.getGeneratedImage(userId, 'asset'), { code: 'OUTFIT_PREVIEW_NOT_FOUND' })
  }
  assert.equal(promote.mock.callCount(), 0)
})

test('예전 조회 만료 해제와 rollback은 1시간 기한을 다시 만들지 않는다', async (t) => {
  const calls: any[] = []
  const original = prisma.imageAsset.updateMany
  prisma.imageAsset.updateMany = (async (args: unknown) => { calls.push(args); return { count: 1 } }) as unknown as typeof original
  t.after(() => { prisma.imageAsset.updateMany = original })
  await imageService.retainGeneratedPreview(userId, 'asset')
  await imageService.restoreGeneratedPreviewExpiration('asset')
  assert.equal(calls[0].where.userId, userId)
  for (const call of calls) {
    assert.deepEqual(call.data, { retention: 'permanent', expiresAt: null })
    assert.equal(call.where.expiresAt, undefined)
    assert.equal(call.where.kind, 'outfitGenerated')
    assert.equal(call.where.uploadStatus, 'ready')
  }
})

test('코디 삭제·이미지 교체 뒤에는 생성 작업 원본도 참조가 없다는 claim을 얻으면 정리한다', async (t) => {
  const current = asset()
  let shared = true
  t.mock.method(imageRepository, 'claimGeneratedImageDeletion', async () => shared ? null : { asset: current, leaseUntil: new Date('2030-01-01') })
  const remoteDelete = t.mock.method(cloudflareImagesClient, 'deleteImage', async () => undefined)
  const removedIds: string[] = []
  const remove = t.mock.method(imageRepository, 'removeClaimedGeneratedPreview', async (claim: Parameters<typeof imageRepository.removeClaimedGeneratedPreview>[0]) => { removedIds.push(claim.asset.id); return { count: 1 } })
  const pointer = { id: 'asset', cloudflareImageId: 'untrusted-other-image' }
  await imageService.removeGeneratedImage(userId, pointer)
  assert.equal(remoteDelete.mock.callCount(), 0)
  assert.equal(remove.mock.callCount(), 0)
  shared = false
  await imageService.removeGeneratedImage(userId, pointer)
  assert.equal(remoteDelete.mock.calls[0].arguments[0], current.cloudflareImageId)
  assert.deepEqual(removedIds, [current.id])
})

test('최신 완료 결과 조회는 ID 중복·순서를 정리하고 스타일을 정확히 비교한다', async (t) => {
  const original = prisma.imageAsset.findMany
  const calls: any[] = []
  prisma.imageAsset.findMany = (async (args: unknown) => {
    calls.push(args)
    return [asset({ id: 'different-style', metadata: { selectedItemIds: ['top', 'bottom'], style: 'classic' } }), asset({ id: 'match', metadata: { selectedItemIds: ['bottom', 'top', 'top'], style: ' casual ' } })]
  }) as unknown as typeof original
  t.after(() => { prisma.imageAsset.findMany = original })
  const result = await imageRepository.findLatestGeneratedPreviewForItems(userId, ['top', 'bottom', 'top'], 'casual')
  assert.equal(result?.id, 'match')
  assert.deepEqual(calls[0].where, { userId, kind: 'outfitGenerated', uploadStatus: 'ready', retention: { in: ['permanent', 'temporary'] } })
  assert.deepEqual(calls[0].orderBy, [{ createdAt: 'desc' }, { id: 'desc' }])
})

test('작업 TTL보다 오래되고 목록 첫 100개 뒤의 완료 결과도 찾아 복원한다', async (t) => {
  const original = prisma.imageAsset.findMany
  const calls: any[] = []
  prisma.imageAsset.findMany = (async (args: unknown) => {
    calls.push(args)
    return calls.length === 1
      ? Array.from({ length: 100 }, (_, index) => asset({ id: `new-${index}`, metadata: { selectedItemIds: ['other', 'items'] } }))
      : [asset({ id: 'old-match', aiPreviewJobId: null, metadata: { selectedItemIds: ['bottom', 'top'] } })]
  }) as unknown as typeof original
  t.after(() => { prisma.imageAsset.findMany = original })
  const result = await imageRepository.findLatestGeneratedPreviewForItems(userId, ['top', 'bottom'], null)
  assert.equal(result?.id, 'old-match')
  assert.deepEqual(calls[1].cursor, { id: 'new-99' })
  assert.equal(calls[1].skip, 1)
})
