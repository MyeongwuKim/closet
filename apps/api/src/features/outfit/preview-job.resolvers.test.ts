import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../../app.js'
import { userRepository } from '../user/user.repository.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { outfitRepository } from './outfit.repository.js'
import { previewJobRepository } from './preview-job.repository.js'
import { previewJobService } from './preview-job.service.js'

test('생성 작업의 접수·상태·목록·확인은 모두 로그인해야 실행된다', async (t) => {
  const start = t.mock.method(previewJobService, 'start', async () => { throw new Error('호출하면 안 됨') })
  const get = t.mock.method(previewJobService, 'get', async () => { throw new Error('호출하면 안 됨') })
  const list = t.mock.method(previewJobService, 'list', async () => [])
  const ack = t.mock.method(previewJobService, 'acknowledge', async () => true)
  const latest = t.mock.method(previewJobService, 'latestForItems', async () => null)
  const app = await buildApp()
  t.after(() => app.close())
  for (const query of [
    'mutation { startOutfitPreview(input: { selectedItemIds: ["top", "bottom"], sourceOutfitId: "outfit-test", requestId: "request-test" }) { id } }',
    'query { outfitPreviewJob(id: "job-test") { id } }',
    'query { outfitPreviewJobs { id } }',
    'query { outfitPreviewForItems(selectedItemIds: ["top", "bottom"], style: "casual") { assetId imageUrl mimeType model jobId createdAt } }',
    'mutation { acknowledgeOutfitPreviewJob(id: "job-test") }',
  ]) {
    const response = await app.inject({ method: 'POST', url: '/graphql', payload: { query } })
    assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  }
  for (const fn of [start, get, list, ack, latest]) assert.equal(fn.mock.callCount(), 0)
})

test('소유한 코디북 코디의 저장 조합과 스타일이 일치할 때만 출발 코디를 기록한다', async (t) => {
  const outfitId = '64b000000000000000000001'
  const outfit = {
    id: outfitId, style: 'casual', plannerOnly: false,
    items: [{ wardrobeItemId: 'bottom' }, { wardrobeItemId: 'top' }],
  } as NonNullable<Awaited<ReturnType<typeof outfitRepository.findById>>>
  t.mock.method(userRepository, 'findViewerById', async () => null)
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => [
    { id: 'top', category: 'top', displayImageAsset: { deliveryUrl: 'https://images.example.test/top' } },
    { id: 'bottom', category: 'bottom', displayImageAsset: { deliveryUrl: 'https://images.example.test/bottom' } },
  ] as unknown as Awaited<ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>>)
  t.mock.method(outfitRepository, 'findById', async (userId: string, id: string) =>
    userId === 'owner' && id === outfitId ? outfit : null)
  const enqueue = t.mock.method(previewJobRepository, 'enqueue', async (input: Parameters<typeof previewJobRepository.enqueue>[0]) => ({
    ...input, status: 'queued', createdAt: new Date(), imageAssetId: null,
    model: null, errorCode: null, errorMessage: null,
  }) as unknown as Awaited<ReturnType<typeof previewJobRepository.enqueue>>)

  const input = { selectedItemIds: ['top', 'bottom'], style: 'casual', sourceOutfitId: outfitId }
  await previewJobService.start('owner', { ...input, requestId: 'saved-outfit' })
  await previewJobService.start('owner', { ...input, style: 'minimal', requestId: 'edited-outfit' })
  await previewJobService.start('other-user', { ...input, requestId: 'other-outfit' })

  assert.deepEqual(enqueue.mock.calls.map((call) => call.arguments[0].sourceOutfitId), [outfitId, undefined, undefined])
})
