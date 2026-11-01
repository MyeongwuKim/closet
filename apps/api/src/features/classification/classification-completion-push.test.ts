import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../../app.js'
import { authService } from '../auth/auth.service.js'
import { pushService, type CompletionPushKind } from '../push/push.service.js'
import { classificationService } from './classification.service.js'
import { aiExecutor, createAiExecutor } from '../../lib/ai/ai-execution.js'

test('로그인한 사용자의 옷 분석이 끝나면 해당 계정에 알림을 보낸다', async (t) => {
  t.mock.method(
    authService,
    'getViewer',
    async () => ({ id: 'user-one' }) as Awaited<ReturnType<typeof authService.getViewer>>,
  )
  t.mock.method(
    classificationService,
    'classify',
    async () => ({ suggestedName: '테스트 옷' }) as Awaited<ReturnType<typeof classificationService.classify>>,
  )
  const send = t.mock.method(pushService, 'sendCompletion', async (userId: string, kind: CompletionPushKind) => {
    assert.equal(userId, 'user-one')
    assert.equal(kind, 'wardrobe-classification')
    return true
  })
  const app = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: { authorization: 'Bearer session-secret' },
    payload: {
      query: 'mutation { classifyWardrobeImage(input: { imageBase64: "dGVzdA==", mimeType: "image/jpeg" }) { suggestedName } }',
    },
  })

  assert.equal(response.json().data?.classifyWardrobeImage?.suggestedName, '테스트 옷')
  assert.equal(send.mock.callCount(), 1)
})

test('로그인하지 않은 옷 분석은 AI와 푸시를 실행하지 않는다', async (t) => {
  const classify = t.mock.method(
    classificationService,
    'classify',
    async () => ({ suggestedName: '테스트 옷' }) as Awaited<ReturnType<typeof classificationService.classify>>,
  )
  const send = t.mock.method(pushService, 'sendCompletion', async () => true)
  const app = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    payload: {
      query: 'mutation { classifyWardrobeImage(input: { imageBase64: "dGVzdA==", mimeType: "image/jpeg" }) { suggestedName } }',
    },
  })

  assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  assert.equal(classify.mock.callCount(), 0)
  assert.equal(send.mock.callCount(), 0)
})

test('분류와 별도로 투명 옷 사진을 다시 요청할 수 있다', async (t) => {
  t.mock.method(
    authService,
    'getViewer',
    async () => ({ id: 'user-one' }) as Awaited<ReturnType<typeof authService.getViewer>>,
  )
  const createCutout = t.mock.method(
    classificationService,
    'createCutout',
    async () => ({ imageBase64: 'cG5n', mimeType: 'image/png' }),
  )
  const app = await buildApp()
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: { authorization: 'Bearer session-secret' },
    payload: {
      query: 'mutation { removeWardrobeImageBackground(input: { imageBase64: "dGVzdA==", mimeType: "image/jpeg" }) { imageBase64 mimeType } }',
    },
  })

  assert.equal(response.json().errors, undefined)
  assert.deepEqual(response.json().data?.removeWardrobeImageBackground, {
    imageBase64: 'cG5n',
    mimeType: 'image/png',
  })
  assert.equal(createCutout.mock.callCount(), 1)
})


test('사이즈표 분석도 로그인하지 않으면 AI를 실행하지 않는다', async (t) => {
  const analyze = t.mock.method(classificationService, 'analyzeSizeChart', async () => ({ rows: [], notes: [], model: 'mock' }))
  const app = await buildApp()
  t.after(() => app.close())
  const response = await app.inject({ method: 'POST', url: '/graphql', payload: {
    query: 'mutation { analyzeGarmentSizeChart(input: { imageBase64: "dGVzdA==", mimeType: "image/jpeg", category: top }) { model } }',
  } })
  assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  assert.equal(analyze.mock.callCount(), 0)
})

test('같은 사진의 중복 요청과 캐시 재조회는 분류와 완료 알림을 한 번만 실행한다', async (t) => {
  t.mock.method(aiExecutor, 'run', createAiExecutor().run)
  t.mock.method(authService, 'getViewer', async () => ({ id: 'cache-viewer' }))
  const classify = t.mock.method(classificationService, 'classify', async () => ({
    suggestedName: '같은 셔츠',
  }) as Awaited<ReturnType<typeof classificationService.classify>>)
  const send = t.mock.method(pushService, 'sendCompletion', async () => true)
  const app = await buildApp()
  t.after(() => app.close())
  const request = (filename: string) => app.inject({
    method: 'POST', url: '/graphql', headers: { authorization: 'Bearer local-test' },
    payload: { query: `mutation { classifyWardrobeImage(input: { imageBase64: "dGVzdA==", mimeType: "image/jpeg", filename: "${filename}" }) { suggestedName } }` },
  })
  for (const response of await Promise.all([request('one.jpg'), request('two.jpg')])) {
    assert.equal(response.json().data?.classifyWardrobeImage.suggestedName, '같은 셔츠')
  }
  assert.equal((await request('three.jpg')).json().errors, undefined)
  assert.equal(classify.mock.callCount(), 1)
  assert.equal(send.mock.callCount(), 1)
})
