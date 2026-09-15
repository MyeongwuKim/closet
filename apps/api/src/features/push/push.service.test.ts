import assert from 'node:assert/strict'
import test from 'node:test'
import { pushDeviceRepository } from './push.repository.js'
import { pushService } from './push.service.js'

const token = 'ExpoPushToken[test-device_123]'

test('기기 토큰을 현재 사용자와 로그인 세션에 묶어 저장한다', async (t) => {
  const register = t.mock.method(pushDeviceRepository, 'register', async (
    input: Parameters<typeof pushDeviceRepository.register>[0],
  ) => {
    assert.equal(input.userId, 'user-one')
    assert.equal(input.token, token)
    assert.equal(input.platform, 'ios')
    assert.match(input.sessionTokenHash, /^[a-f0-9]{64}$/)
    return {} as Awaited<ReturnType<typeof pushDeviceRepository.register>>
  })

  assert.equal(await pushService.register('user-one', 'session-secret', token, 'ios'), true)
  assert.equal(register.mock.callCount(), 1)
  await assert.rejects(
    pushService.register('user-one', 'session-secret', 'not-a-push-token', 'ios'),
    { code: 'INVALID_PUSH_TOKEN' },
  )
  assert.equal(register.mock.callCount(), 1)
})

test('등록한 기기가 없는 계정에는 테스트 알림을 보내지 않는다', async (t) => {
  t.mock.method(pushDeviceRepository, 'findActiveTokensForUser', async () => [])
  const send = t.mock.method(globalThis, 'fetch', async () => new Response())

  await assert.rejects(pushService.sendTest('user-one'), {
    code: 'PUSH_DEVICE_NOT_REGISTERED',
  })
  assert.equal(send.mock.callCount(), 0)
})

test('현재 계정의 기기에만 테스트 알림을 전송한다', async (t) => {
  const find = t.mock.method(
    pushDeviceRepository,
    'findActiveTokensForUser',
    async (userId: string) => {
      assert.equal(userId, 'user-one')
      return [token]
    },
  )
  const send = t.mock.method(globalThis, 'fetch', async (
    _url: string | URL | Request,
    options?: RequestInit,
  ) => {
    const messages = JSON.parse(String(options?.body)) as Array<{
      to: string
      data: { type: string }
    }>
    assert.deepEqual(messages.map(({ to }) => to), [token])
    assert.equal(messages[0]?.data.type, 'push-test')
    return Response.json({ data: [{ status: 'ok', id: 'ticket-1' }] })
  })

  assert.equal(await pushService.sendTest('user-one'), true)
  assert.equal(find.mock.callCount(), 1)
  assert.equal(send.mock.callCount(), 1)
})

test('Expo가 거절한 알림은 전송 성공으로 처리하지 않는다', async (t) => {
  t.mock.method(pushDeviceRepository, 'findActiveTokensForUser', async () => [token])
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ data: [{ status: 'error', message: 'InvalidCredentials' }] }),
  )
  t.mock.method(console, 'error', () => {})

  await assert.rejects(pushService.sendTest('user-one'), { code: 'PUSH_SEND_FAILED' })
})

test('완료 알림은 등록 기기가 없으면 추천 작업을 방해하지 않는다', async (t) => {
  t.mock.method(pushDeviceRepository, 'findActiveTokensForUser', async () => [])
  const send = t.mock.method(globalThis, 'fetch', async () => new Response())

  assert.equal(
    await pushService.sendCompletion('user-one', 'today-outfit-recommendation'),
    false,
  )
  assert.equal(send.mock.callCount(), 0)
})

test('AI 추천 완료 알림은 해당 계정의 기기에만 전송한다', async (t) => {
  t.mock.method(
    pushDeviceRepository,
    'findActiveTokensForUser',
    async (userId: string) => {
      assert.equal(userId, 'user-one')
      return [token]
    },
  )
  const send = t.mock.method(globalThis, 'fetch', async (
    _url: string | URL | Request,
    options?: RequestInit,
  ) => {
    const messages = JSON.parse(String(options?.body)) as Array<{
      to: string
      title: string
      data: { type: string; kind: string }
    }>
    assert.equal(messages.length, 1)
    assert.equal(messages[0]?.to, token)
    assert.equal(messages[0]?.title, '오늘의 코디 추천이 준비됐어요')
    assert.deepEqual(messages[0]?.data, {
      type: 'ai-completion',
      kind: 'today-outfit-recommendation',
    })
    return Response.json({ data: [{ status: 'ok', id: 'ticket-1' }] })
  })

  assert.equal(
    await pushService.sendCompletion('user-one', 'today-outfit-recommendation'),
    true,
  )
  assert.equal(send.mock.callCount(), 1)
})
