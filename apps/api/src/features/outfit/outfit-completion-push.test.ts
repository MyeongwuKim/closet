import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { buildApp } from '../../app.js'
import { authService } from '../auth/auth.service.js'
import { pushService, type CompletionPushKind } from '../push/push.service.js'
import { previewJobService } from './preview-job.service.js'
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
    async () => ({ ready: true, style: null }) as Awaited<ReturnType<typeof todayOutfitRecommendationService.recommend>>,
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
      query: 'query { todayOutfitRecommendation(input: { date: "2026-09-14", season: autumn }) { ready style } }',
    },
  })

  assert.equal(response.json().data?.todayOutfitRecommendation?.ready, true)
  assert.equal(response.json().data?.todayOutfitRecommendation?.style, null)
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

test('코디 추천 완료를 알리고 이전 이미지 API도 영속 작업의 결과를 반환한다', async (t) => {
  mockViewer(t)
  t.mock.method(
    outfitRecommendationService,
    'recommend',
    async () => ({ source: 'ai' }) as Awaited<ReturnType<typeof outfitRecommendationService.recommend>>,
  )
  t.mock.method(previewJobService, 'generateAndWait', async () => ({
    imageBase64: '', assetId: 'asset-1', imageUrl: 'https://images.example.test/asset-1',
    mimeType: 'image/png', model: 'image-model', metadata: { model: 'image-model' },
  }))
  const kinds: string[] = []
  t.mock.method(pushService, 'sendCompletion', async (
    userId: string,
    kind: CompletionPushKind,
  ) => {
    assert.equal(userId, 'user-one')
    kinds.push(kind)
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
  assert.deepEqual(kinds, ['outfit-recommendation'])
})

test('GraphQL 코디 추천 모드를 그대로 서비스에 전달한다', async (t) => {
  mockViewer(t)
  const recommend = t.mock.method(
    outfitRecommendationService,
    'recommend',
    async (requestedUserId: string, input: { mode?: 'items' | 'colors' | null }) => {
      assert.equal(requestedUserId, 'user-one')
      assert.equal(input.mode, 'colors')
      return { source: 'fallback' } as Awaited<ReturnType<typeof outfitRecommendationService.recommend>>
    },
  )
  t.mock.method(pushService, 'sendCompletion', async () => true)
  const app = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: { authorization: 'Bearer session-secret' },
    payload: {
      query: 'query { outfitRecommendation(input: { selectedItemIds: ["item-1"], targetCategory: shoes, mode: colors }) { source } }',
    },
  })

  assert.equal(response.json().data?.outfitRecommendation?.source, 'fallback')
  assert.equal(recommend.mock.callCount(), 1)
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

test('이전 이미지 API는 작업 서비스의 오류를 GraphQL에 전달한다', async (t) => {
  mockViewer(t)
  t.mock.method(previewJobService, 'generateAndWait', async () => { throw new Error('image generation failed') })
  const app = await buildApp()
  t.after(() => app.close())
  const response = await app.inject({ method: 'POST', url: '/graphql', headers: { authorization: 'Bearer session-secret' }, payload: {
    query: 'mutation { generateOutfitPreview(input: { selectedItemIds: ["item-1", "item-2"] }) { mimeType } }',
  } })
  assert.equal(response.json().errors?.[0]?.extensions?.code, 'OUTFIT_PREVIEW_GENERATION_FAILED')
})
