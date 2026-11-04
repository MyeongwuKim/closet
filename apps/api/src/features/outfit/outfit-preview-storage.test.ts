import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../../app.js'
import { ServiceError } from '../../graphql/errors.js'
import { imageService } from '../image/image.service.js'
import { resolveOutfitPreviewImage } from './outfit-preview-storage.js'
import { outfitRepository } from './outfit.repository.js'
import { outfitService } from './outfit.service.js'

const input = { assetId: 'asset-one', imageBase64: '', mimeType: 'image/png' as const, model: 'client-model', imageUrl: 'https://example.test/image.png' }
const stored = { assetId: 'asset-one', imageUrl: input.imageUrl, mimeType: input.mimeType, model: 'server-model', retention: 'permanent' as const, metadata: { selectedItemIds: ['bottom', 'top'] } }

test('기존 생성 자산의 소유권 조회와 옷 구성을 확인하고 원본 번호·서버 모델을 재사용한다', async (t) => {
  const get = t.mock.method(imageService, 'getGeneratedImage', async (owner: string, id: string) => { assert.equal(owner, 'viewer'); assert.equal(id, input.assetId); return stored })
  const upload = t.mock.method(imageService, 'storeGeneratedImage', async () => { throw new Error('원본을 다시 올리면 안 됩니다.') })
  const remove = t.mock.method(imageService, 'removeGeneratedImage', async () => undefined)
  const result = await resolveOutfitPreviewImage('viewer', input, ['top', 'bottom'])
  assert.deepEqual(result, { id: input.assetId, model: stored.model, uploadedAsset: null })
  assert.equal(get.mock.callCount(), 1)
  assert.equal(upload.mock.callCount(), 0)
  assert.equal(remove.mock.callCount(), 0)
})

test('다른 사용자·삭제된 자산의 조회 거절을 그대로 전달하고 새 업로드로 대체하지 않는다', async (t) => {
  t.mock.method(imageService, 'getGeneratedImage', async () => { throw new ServiceError('없는 이미지', 'OUTFIT_PREVIEW_NOT_FOUND') })
  const upload = t.mock.method(imageService, 'storeGeneratedImage', async () => { throw new Error('업로드 금지') })
  await assert.rejects(resolveOutfitPreviewImage('other-viewer', input, ['top', 'bottom']), { code: 'OUTFIT_PREVIEW_NOT_FOUND' })
  assert.equal(upload.mock.callCount(), 0)
})

test('다른 조합·중복된 구성·구성 근거가 없는 자산은 연결하지 않는다', async (t) => {
  const selectedIds: unknown[] = [['top', 'other'], ['top', 'top'], null]
  for (const selectedItemIds of selectedIds) {
    const get = t.mock.method(imageService, 'getGeneratedImage', async () => ({ ...stored, metadata: { selectedItemIds } }) as Awaited<ReturnType<typeof imageService.getGeneratedImage>>)
    await assert.rejects(resolveOutfitPreviewImage('viewer', input, ['top', 'bottom']), { code: 'INVALID_GENERATED_IMAGE' })
    get.mock.restore()
  }
})

test('자산 번호와 본문을 동시에 보내거나 이미지 정보가 비어 있으면 저장하지 않는다', async (t) => {
  const get = t.mock.method(imageService, 'getGeneratedImage', async () => stored)
  const upload = t.mock.method(imageService, 'storeGeneratedImage', async () => { throw new Error('업로드 금지') })
  await assert.rejects(resolveOutfitPreviewImage('viewer', { ...input, imageBase64: 'content' }, ['top', 'bottom']), { code: 'INVALID_GENERATED_IMAGE' })
  await assert.rejects(resolveOutfitPreviewImage('viewer', { imageBase64: '', mimeType: 'image/png', model: 'model' }, ['top', 'bottom']), { code: 'INVALID_GENERATED_IMAGE' })
  assert.equal(get.mock.callCount(), 0)
  assert.equal(upload.mock.callCount(), 0)
})

test('이전 본문 방식도 구성 근거를 기록한 새 이미지로 저장한다', async (t) => {
  const asset = { id: 'uploaded-copy', cloudflareImageId: 'cloudflare-copy' }
  const upload = t.mock.method(imageService, 'storeGeneratedImage', async (...[, data]: Parameters<typeof imageService.storeGeneratedImage>) => {
    assert.deepEqual(data.metadata, { selectedItemIds: ['bottom', 'top'], style: 'casual' })
    return asset as Awaited<ReturnType<typeof imageService.storeGeneratedImage>>
  })
  const remove = t.mock.method(imageService, 'removeGeneratedImage', async () => undefined)
  const result = await resolveOutfitPreviewImage('viewer', { imageBase64: 'content', mimeType: 'image/png', model: ' model ' }, ['top', 'bottom'], 'casual')
  assert.equal(result.model, 'model')
  assert.equal(upload.mock.callCount(), 1)
  assert.equal(remove.mock.callCount(), 0)
})

test('자산 번호 저장 payload는 실제 GraphQL 입력 검증을 통과하고 로그인 검증까지 도달한다', async (t) => {
  const app = await buildApp()
  t.after(() => app.close())
  const previewImage = { assetId: input.assetId, mimeType: input.mimeType, model: input.model }
  const response = await app.inject({ method: 'POST', url: '/graphql', payload: {
    query: 'mutation Save($previewImage: OutfitPreviewImageInput) { savePlannerOutfitToLookbook(outfitId: "outfit-one", previewImage: $previewImage) { id } }',
    variables: { previewImage },
  } })
  assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
})

for (const failSave of [false, true]) {
  test(`기존 코디에 생성 자산을 연결할 때 재업로드하지 않고 ${failSave ? '저장 실패에도 원본을 보존한다' : '같은 번호를 저장한다'}`, async (t) => {
    const outfit = { id: 'outfit-one', style: 'casual', items: [{ wardrobeItemId: 'top' }, { wardrobeItemId: 'bottom' }] } as NonNullable<Awaited<ReturnType<typeof outfitRepository.findById>>>
    t.mock.method(outfitRepository, 'findById', async () => outfit)
    t.mock.method(imageService, 'getGeneratedImage', async () => stored)
    const upload = t.mock.method(imageService, 'storeGeneratedImage', async () => { throw new Error('원본 재업로드 금지') })
    const remove = t.mock.method(imageService, 'removeGeneratedImage', async () => undefined)
    const save = t.mock.method(outfitRepository, 'addGeneration', async (id: string, generation: { userId: string; imageAssetId: string; model: string }) => {
      assert.equal(id, outfit.id)
      assert.deepEqual(generation, { userId: 'viewer', imageAssetId: stored.assetId, model: stored.model })
      if (failSave) throw new Error('저장 실패')
      return { outfit, detachedAssets: [] }
    })
    if (failSave) await assert.rejects(outfitService.addPreview('viewer', outfit.id, input), { message: '저장 실패' })
    else assert.equal((await outfitService.addPreview('viewer', outfit.id, input)).id, outfit.id)
    assert.equal(save.mock.callCount(), 1)
    assert.equal(upload.mock.callCount(), 0)
    assert.equal(remove.mock.callCount(), 0)
  })
}
