import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../../app.js'
import { authService } from '../auth/auth.service.js'
import { pushService } from './push.service.js'

test('로그인하지 않은 요청은 토큰 등록과 테스트 발송을 할 수 없다', async (t) => {
  const app = await buildApp()
  t.after(() => app.close())

  for (const query of [
    'mutation { registerMyPushToken(token: "ExpoPushToken[test]", platform: ios) }',
    'mutation { sendTestPushNotification }',
  ]) {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query },
    })
    assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  }
})

test('토큰 등록과 테스트 발송은 인증된 사용자의 계정으로 실행한다', async (t) => {
  t.mock.method(
    authService,
    'getViewer',
    async () => ({ id: 'signed-in-user' }) as Awaited<ReturnType<typeof authService.getViewer>>,
  )
  const register = t.mock.method(
    pushService,
    'register',
    async (userId: string, accessToken: string, token: string) => {
      assert.equal(userId, 'signed-in-user')
      assert.equal(accessToken, 'session-secret')
      assert.equal(token, 'ExpoPushToken[test]')
      return true
    },
  )
  const send = t.mock.method(pushService, 'sendTest', async (userId: string) => {
    assert.equal(userId, 'signed-in-user')
    return true
  })
  const app = await buildApp()
  t.after(() => app.close())

  for (const query of [
    'mutation { registerMyPushToken(token: "ExpoPushToken[test]", platform: ios) }',
    'mutation { sendTestPushNotification }',
  ]) {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { authorization: 'Bearer session-secret' },
      payload: { query },
    })
    assert.equal(response.json().errors, undefined)
  }
  assert.equal(register.mock.callCount(), 1)
  assert.equal(send.mock.callCount(), 1)
})
