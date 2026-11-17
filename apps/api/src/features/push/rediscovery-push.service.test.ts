import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { buildApp } from '../../app.js'
import { wardrobeRediscoveryService } from '../wardrobe/wardrobe-rediscovery.service.js'
import { pushService } from './push.service.js'
import { pushDeviceRepository } from './push.repository.js'
import { rediscoveryPushRepository as repository } from './rediscovery-push.repository.js'
import { sendDueRediscoveryPushes } from './rediscovery-push.service.js'
import { isRediscoveryPushHour, nextRediscoveryMorning, REDISCOVERY_PUSH_INTERVAL_MS } from './rediscovery-push.rules.js'

const now = new Date('2026-11-15T00:00:00Z')
const rediscovery = (items = true) => ({ day: '2026-11-15', items: items ? [{ item: { id: 'item' } }] : [] }) as Awaited<ReturnType<typeof wardrobeRediscoveryService.get>>

function setup(t: TestContext) {
  const claimed = new Set<string>()
  const due = t.mock.method(repository, 'findDue', async () => [{ userId: 'consenting-user' }])
  const claim = t.mock.method(repository, 'claim', async (userId: string, _now: Date, reservedUntil: Date) => {
    assert.equal(reservedUntil.getTime() - _now.getTime(), REDISCOVERY_PUSH_INTERVAL_MS)
    if (claimed.has(userId)) return false
    claimed.add(userId)
    return true
  })
  const current = t.mock.method(repository, 'isCurrent', async () => true)
  const retry = t.mock.method(repository, 'retryTomorrow', async () => {})
  const get = t.mock.method(wardrobeRediscoveryService, 'get', async () => rediscovery())
  const send = t.mock.method(pushService, 'sendRediscovery', async () => true)
  return { due, claim, current, retry, get, send }
}

test('한국 시간 오전 9시부터 오후 8시 전까지만 발송하며 다음 검사는 한국 시간 다음 오전 9시다', async (t) => {
  const fixture = setup(t)
  assert.equal(isRediscoveryPushHour(new Date('2026-11-14T23:59:00Z')), false)
  assert.equal(isRediscoveryPushHour(now), true)
  assert.equal(isRediscoveryPushHour(new Date('2026-11-15T10:59:00Z')), true)
  assert.equal(isRediscoveryPushHour(new Date('2026-11-15T11:00:00Z')), false)
  assert.equal(nextRediscoveryMorning(new Date('2026-11-14T23:00:00Z')).toISOString(), now.toISOString())
  assert.equal(nextRediscoveryMorning(now).toISOString(), '2026-11-16T00:00:00.000Z')
  assert.equal(await sendDueRediscoveryPushes(new Date('2026-11-15T11:00:00Z')), 0)
  assert.equal(fixture.due.mock.callCount(), 0)
})

test('여러 worker가 같은 계정을 읽어도 선점한 한 worker만 푸시를 보낸다', async (t) => {
  const fixture = setup(t)
  assert.deepEqual(await Promise.all([sendDueRediscoveryPushes(now), sendDueRediscoveryPushes(now)]), [1, 0])
  assert.equal(fixture.send.mock.callCount(), 1)
  assert.equal(fixture.send.mock.calls[0].arguments[0], 'consenting-user')
  assert.equal(fixture.get.mock.callCount(), 1)
  assert.equal(fixture.retry.mock.callCount(), 0)
})

test('계절·착용·보류 조건에 맞는 옷이 없으면 발송하지 않고 다음 아침에 다시 검사한다', async (t) => {
  const fixture = setup(t)
  fixture.get.mock.mockImplementation(async () => rediscovery(false))
  assert.equal(await sendDueRediscoveryPushes(now), 0)
  assert.equal(fixture.send.mock.callCount(), 0)
  assert.equal(fixture.retry.mock.calls[0].arguments[2]?.toISOString(), '2026-11-16T00:00:00.000Z')
})

test('후보를 조회하는 사이 수신 동의를 취소하면 발송하지 않는다', async (t) => {
  const fixture = setup(t)
  fixture.current.mock.mockImplementation(async () => false)
  assert.equal(await sendDueRediscoveryPushes(now), 0)
  assert.equal(fixture.send.mock.callCount(), 0)
})

test('활성 로그인 기기가 없으면 다음 아침에 재검사하며 전송 실패는 주간 예약을 유지한다', async (t) => {
  const fixture = setup(t)
  fixture.send.mock.mockImplementation(async () => false)
  assert.equal(await sendDueRediscoveryPushes(now), 0)
  assert.equal(fixture.retry.mock.callCount(), 1)
  fixture.due.mock.mockImplementation(async () => [{ userId: 'second-user' }])
  fixture.send.mock.mockImplementation(async () => { throw new Error('provider failure') })
  t.mock.method(console, 'warn', () => {})
  assert.equal(await sendDueRediscoveryPushes(now), 0)
  assert.equal(fixture.retry.mock.callCount(), 1)
})

test('재발견 푸시는 활성 세션 기기에 전용 경로와 옷 개수에 무관한 문구를 보낸다', async (t) => {
  t.mock.method(pushDeviceRepository, 'findActiveTokensForUser', async () => ['ExpoPushToken[test]'])
  const send = t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, options?: RequestInit) => {
    const messages = JSON.parse(String(options?.body))
    assert.equal(messages[0].title, '옷장에 잠들어 있던 옷을 확인해보세요!')
    assert.deepEqual(messages[0].data, { type: 'wardrobe-rediscovery', path: '/closet/rediscovery' })
    return Response.json({ data: [{ status: 'ok' }] })
  })
  assert.equal(await pushService.sendRediscovery('owner'), true)
  assert.equal(send.mock.callCount(), 1)
})

test('재발견 수신 동의 변경은 로그인하지 않으면 저장하지 않는다', async (t) => {
  const app = await buildApp()
  t.after(() => app.close())
  const response = await app.inject({ method: 'POST', url: '/graphql', payload: { query: 'mutation { setWardrobeRediscoveryPushEnabled(enabled: true) { rediscoveryPushEnabled } }' } })
  assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
})
