import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { buildApp } from '../../app.js'
import { authService } from '../auth/auth.service.js'
import { imageService } from '../image/image.service.js'
import { pushService, type CompletionPushKind } from '../push/push.service.js'
import { outfitPreviewService } from './outfit-preview.service.js'
import { outfitRecommendationService } from './outfit-recommendation.service.js'
import { todayOutfitRecommendationService } from './today-outfit-recommendation.service.js'

function mockViewer(t: TestContext) {
  t.mock.method(
    authService,
    'getViewer',
    async () => ({ id: 'user-one' }) as Awaited<ReturnType<typeof authService.getViewer>>,
  )
}

test('오늘의 코디 추천이 준비되면 요청한 계정에 완료 알림을 보낸다', async (t) => {
  mockViewer(t)
  t.mock.method(
    todayOutfitRecommendationService,
    'recommend',
    async () => ({ ready: true }) as Awaited<ReturnType<typeof todayOutfitRecommendationService.recommend>>,
  )
  const send = t.mock.method(pushService, 'sendCompletion', async (userId: string, kind: CompletionPushKind) => {
    assert.equal(userId, 'user-one')
    assert.equal(kind, 'today-outfit-recommendation')
    return true
  })
  const app = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: { authorization: 'Bearer session-secret' },
    payload: {
      query: 'query { todayOutfitRecommendation(input: { date: "2026-09-14", season: autumn }) { ready } }',
    },
  })

  assert.equal(response.json().data?.todayOutfitRecommendation?.ready, true)
  assert.equal(send.mock.callCount(), 1)
})

test('추천할 코디가 없으면 완료 알림을 보내지 않는다', async (t) => {
  mockViewer(t)
  t.mock.method(
    todayOutfitRecommendationService,
    'recommend',
    async () => ({ ready: false }) as Awaited<ReturnType<typeof todayOutfitRecommendationService.recommend>>,
  )
  const send = t.mock.method(pushService, 'sendCompletion', async () => true)
  const app = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: { authorization: 'Bearer session-secret' },
    payload: {
      query: 'query { todayOutfitRecommendation(input: { date: "2026-09-14", season: autumn }) { ready } }',
    },
  })

  assert.equal(response.json().data?.todayOutfitRecommendation?.ready, false)
  assert.equal(send.mock.callCount(), 0)
})

test('코디 추천과 AI 이미지 생성 완료도 각각 알린다', async (t) => {
  mockViewer(t)
  t.mock.method(
    outfitRecommendationService,
    'recommend',
    async () => ({ source: 'ai' }) as Awaited<ReturnType<typeof outfitRecommendationService.recommend>>,
  )
  t.mock.method(
    outfitPreviewService,
    'generate',
    async () => ({
      imageBase64: 'generated-image',
      mimeType: 'image/png',
      model: 'image-model',
    }),
  )
  t.mock.method(imageService, 'storeGeneratedImage', async () => ({ id: 'asset-1' }) as Awaited<ReturnType<typeof imageService.storeGeneratedImage>>)
  t.mock.method(imageService, 'getGeneratedImage', async () => ({
    assetId: 'asset-1',
    imageUrl: 'https://images.example.test/asset-1',
    mimeType: 'image/png',
    model: 'image-model',
    metadata: { model: 'image-model' },
  }))
  const kinds: string[] = []
  let previewPushData: Record<string, string> | undefined
  t.mock.method(pushService, 'sendCompletion', async (
    userId: string,
    kind: CompletionPushKind,
    data?: Record<string, string>,
  ) => {
    assert.equal(userId, 'user-one')
    kinds.push(kind)
    if (kind === 'outfit-preview') previewPushData = data
    return true
  })
  const app = await buildApp()
  t.after(() => app.close())

  const headers = { authorization: 'Bearer session-secret' }
  const recommendation = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers,
    payload: {
      query: 'query { outfitRecommendation(input: { selectedItemIds: ["item-1"], targetCategory: shoes }) { source } }',
    },
  })
  const preview = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers,
    payload: {
      query: 'mutation { generateOutfitPreview(input: { selectedItemIds: ["item-1"] }) { mimeType } }',
    },
  })

  assert.equal(recommendation.json().data?.outfitRecommendation?.source, 'ai')
  assert.equal(preview.json().data?.generateOutfitPreview?.mimeType, 'image/png')
  assert.deepEqual(kinds, ['outfit-recommendation', 'outfit-preview'])
  assert.equal(previewPushData?.previewAssetId, 'asset-1')
  assert.match(previewPushData?.path ?? '', /^\/lookbook\/new\?/)
})

test('완료 알림 전송 실패는 추천 결과를 실패로 바꾸지 않는다', async (t) => {
  mockViewer(t)
  t.mock.method(
    todayOutfitRecommendationService,
    'recommend',
    async () => ({ ready: true }) as Awaited<ReturnType<typeof todayOutfitRecommendationService.recommend>>,
  )
  t.mock.method(pushService, 'sendCompletion', async () => {
    throw new Error('Expo unavailable')
  })
  t.mock.method(console, 'warn', () => {})
  const app = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: { authorization: 'Bearer session-secret' },
    payload: {
      query: 'query { todayOutfitRecommendation(input: { date: "2026-09-14", season: autumn }) { ready } }',
    },
  })

  assert.equal(response.json().data?.todayOutfitRecommendation?.ready, true)
  assert.equal(response.json().errors, undefined)
})

test('AI 이미지 생성에 실패하면 다시 시도할 화면이 담긴 실패 알림을 보낸다', async (t) => {
  mockViewer(t)
  t.mock.method(outfitPreviewService, 'generate', async () => {
    throw new Error('image generation failed')
  })
  let failureData: Record<string, string> | undefined
  const send = t.mock.method(
    pushService,
    'sendFailure',
    async (userId: string, kind: string, data?: Record<string, string>) => {
      assert.equal(userId, 'user-one')
      assert.equal(kind, 'outfit-preview')
      failureData = data
      return true
    },
  )
  const app = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: { authorization: 'Bearer session-secret' },
    payload: {
      query: 'mutation { generateOutfitPreview(input: { selectedItemIds: ["item-1", "item-2"] }) { mimeType } }',
    },
  })

  assert.ok(response.json().errors)
  assert.equal(send.mock.callCount(), 1)
  assert.match(failureData?.path ?? '', /preview=failed/)
  assert.match(failureData?.path ?? '', /items=item-1%2Citem-2/)
})
