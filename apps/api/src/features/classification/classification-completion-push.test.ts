import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../../app.js'
import { authService } from '../auth/auth.service.js'
import { pushService, type CompletionPushKind } from '../push/push.service.js'
import { classificationService } from './classification.service.js'

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

test('계정이 없는 옷 분석 요청에는 푸시를 보내지 않는다', async (t) => {
  t.mock.method(
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

  assert.equal(response.json().data?.classifyWardrobeImage?.suggestedName, '테스트 옷')
  assert.equal(send.mock.callCount(), 0)
})
