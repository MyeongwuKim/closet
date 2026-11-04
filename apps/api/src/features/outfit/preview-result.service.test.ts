import assert from 'node:assert/strict'
import test from 'node:test'
import { ServiceError } from '../../graphql/errors.js'
import { imageRepository } from '../image/image.repository.js'
import { imageService } from '../image/image.service.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { outfitResolvers } from './outfit.resolvers.js'
import { previewJobRepository } from './preview-job.repository.js'
import { previewJobService } from './preview-job.service.js'
import type { GraphQLContext } from '../../graphql/context.js'

const userId = 'viewer-preview-result'
const items = [
  { id: 'top', category: 'top', displayImageAsset: { deliveryUrl: 'https://fixture.invalid/top.png' } },
  { id: 'bottom', category: 'bottom', displayImageAsset: { deliveryUrl: 'https://fixture.invalid/bottom.png' } },
] as Awaited<ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>>
const asset = {
  id: 'stored-result', aiPreviewJobId: 'expired-job', createdAt: new Date('2025-01-01T00:00:00.000Z'),
} as NonNullable<Awaited<ReturnType<typeof imageRepository.findLatestGeneratedPreviewForItems>>>
const image = { assetId: asset.id, imageUrl: 'https://fixture.invalid/result.png', mimeType: 'image/png', model: 'fixture-model', metadata: null, retention: 'permanent' as const }

test('오래되거나 알림을 확인한 작업도 영속 이미지로 찾고 생성·접수 없이 반환한다', async (t) => {
  const owned = t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => items)
  const latest = t.mock.method(imageRepository, 'findLatestGeneratedPreviewForItems', async () => asset)
  const read = t.mock.method(imageService, 'getGeneratedImage', async () => image)
  const enqueue = t.mock.method(previewJobRepository, 'enqueue', async () => { throw new Error('새 작업을 접수하면 안 됩니다.') })
  const list = t.mock.method(previewJobRepository, 'listOwned', async () => { throw new Error('미확인 작업 목록을 사용하면 안 됩니다.') })
  const result = await previewJobService.latestForItems(userId, ['bottom', 'top', 'bottom'], ' casual ')
  assert.deepEqual(owned.mock.calls[0]?.arguments, [userId, ['bottom', 'top']])
  assert.deepEqual(latest.mock.calls[0]?.arguments, [userId, ['bottom', 'top'], 'casual'])
  assert.deepEqual(read.mock.calls[0]?.arguments, [userId, asset.id])
  assert.deepEqual(result, { assetId: image.assetId, imageUrl: image.imageUrl, mimeType: image.mimeType, model: image.model, jobId: 'expired-job', createdAt: '2025-01-01T00:00:00.000Z' })
  assert.equal(enqueue.mock.callCount(), 0)
  assert.equal(list.mock.callCount(), 0)
})

test('해당 계정과 옷 조합의 완료 이미지가 없으면 null을 반환한다', async (t) => {
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => items)
  const latest = t.mock.method(imageRepository, 'findLatestGeneratedPreviewForItems', async () => null)
  const read = t.mock.method(imageService, 'getGeneratedImage', async () => { throw new Error('이미지가 없으면 조회하지 않습니다.') })
  assert.equal(await previewJobService.latestForItems(userId, ['top', 'bottom'], '  '), null)
  assert.equal(latest.mock.calls[0]?.arguments[2], null)
  assert.equal(read.mock.callCount(), 0)
})

test('내 활성 옷이나 기본 구성을 검증하지 못하면 이미지 저장소에 접근하지 않는다', async (t) => {
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => [items[0]!])
  const latest = t.mock.method(imageRepository, 'findLatestGeneratedPreviewForItems', async () => asset)
  await assert.rejects(previewJobService.latestForItems(userId, ['top', 'someone-elses-bottom']), { code: 'INVALID_OUTFIT_PREVIEW_ITEMS' })
  await assert.rejects(previewJobService.latestForItems(userId, ['top']), { code: 'INVALID_OUTFIT_PREVIEW_ITEMS' })
  await assert.rejects(previewJobService.latestForItems(userId, ['top', 'bottom'], 'x'.repeat(101)), { code: 'INVALID_OUTFIT_PREVIEW_REQUEST' })
  assert.equal(latest.mock.callCount(), 0)
})

test('조회 후보를 찾은 직후 이미지가 삭제됐으면 null이며 새 생성을 하지 않는다', async (t) => {
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => items)
  t.mock.method(imageRepository, 'findLatestGeneratedPreviewForItems', async () => asset)
  t.mock.method(imageService, 'getGeneratedImage', async () => { throw new ServiceError('없음', 'OUTFIT_PREVIEW_NOT_FOUND') })
  assert.equal(await previewJobService.latestForItems(userId, ['top', 'bottom']), null)
})

test('일시 저장소 오류는 결과 없음으로 숨기지 않고 재시도 가능한 오류로 전달한다', async (t) => {
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => items)
  t.mock.method(imageRepository, 'findLatestGeneratedPreviewForItems', async () => asset)
  t.mock.method(imageService, 'getGeneratedImage', async () => { throw new Error('일시 연결 실패') })
  await assert.rejects(previewJobService.latestForItems(userId, ['top', 'bottom']), { message: '일시 연결 실패' })
})

test('이전 이미지에 작업 번호가 없더라도 asset 번호로 복원한다', async (t) => {
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => items)
  t.mock.method(imageRepository, 'findLatestGeneratedPreviewForItems', async () => ({ ...asset, aiPreviewJobId: null }))
  t.mock.method(imageService, 'getGeneratedImage', async () => image)
  const result = await previewJobService.latestForItems(userId, ['top', 'bottom'])
  assert.equal(result?.jobId, null)
  assert.equal(result?.assetId, asset.id)
})

test('GraphQL 조회는 요청자가 보낸 계정 대신 로그인 계정의 조합만 전달한다', async (t) => {
  const latest = t.mock.method(previewJobService, 'latestForItems', async () => null)
  const context = { getViewer: async () => ({ id: userId }) } as GraphQLContext
  assert.equal(await outfitResolvers.Query.outfitPreviewForItems(null, { selectedItemIds: ['top', 'bottom'], style: 'casual', userId: 'other' } as { selectedItemIds: string[]; style: string }, context), null)
  assert.deepEqual(latest.mock.calls[0]?.arguments, [userId, ['top', 'bottom'], 'casual'])
})
