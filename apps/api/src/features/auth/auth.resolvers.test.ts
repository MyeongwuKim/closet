import assert from 'node:assert/strict'
import { scryptSync } from 'node:crypto'
import test, { type TestContext } from 'node:test'
import { buildApp } from '../../app.js'
import { pushDeviceRepository } from '../push/push.repository.js'
import type { ViewerRecord } from '../user/user.repository.js'
import { authRepository } from './auth.repository.js'
import { hashSessionToken } from './sessionToken.js'

const loginId = 'auth-test-user'
const password = 'fixture-password'
const viewerId = 'viewer'
const loginMutation = `mutation Login($input: TestLoginInput!) {
  testLogin(input: $input) { accessToken viewer { id } }
}`
const viewerQuery = 'query { me { id } }'

type GraphqlResponse<T> = {
  data?: T | null
  errors?: { extensions: { code: string } }[]
}

function assertGraphqlError(result: GraphqlResponse<unknown>, code: string) {
  assert.equal(result.data, null)
  assert.deepEqual(result.errors?.map((error) => error.extensions.code), [code])
}

/** 로그인과 세션 처리에는 실제 GraphQL·인증 로직을 사용하고 계정과 세션은 메모리에 보관한다. */
async function createAuthFixture(t: TestContext) {
  const now = new Date()
  const viewer: ViewerRecord = {
    id: viewerId,
    displayName: '인증 테스트 사용자',
    email: null,
    isTemporary: true,
    lastLoginAt: null,
    wearWeatherLatitude: null,
    wearWeatherLongitude: null,
    createdAt: now,
    updatedAt: now,
    styleProfile: null,
    settings: null,
    preferredStyles: [],
  }
  const passwordSalt = 'fixture-salt'
  const account = {
    id: 'test-account',
    userId: viewer.id,
    user: viewer,
    loginId,
    passwordSalt,
    passwordHash: scryptSync(password, passwordSalt, 64).toString('hex'),
    createdAt: now,
    updatedAt: now,
  }
  type Session = NonNullable<Awaited<ReturnType<typeof authRepository.findSession>>>
  const sessions = new Map<string, Session>()
  t.mock.method(authRepository, 'findTestAccount', async (id: string) => id === loginId ? account : null)
  t.mock.method(authRepository, 'createTestUser', async () => assert.fail('기존 테스트 계정으로만 로그인한다'))
  const updateLastLogin = t.mock.method(authRepository, 'updateLastLogin', async () => viewer)
  const createSession = t.mock.method(authRepository, 'createSession', async (userId: string, tokenHash: string, expiresAt: Date) => {
    const session = { id: `session-${sessions.size + 1}`, userId, tokenHash, expiresAt, createdAt: now, lastUsedAt: now, user: viewer }
    sessions.set(tokenHash, session)
    return session
  })
  t.mock.method(authRepository, 'findSession', async (tokenHash: string) => sessions.get(tokenHash) ?? null)
  const touchSession = t.mock.method(authRepository, 'touchSession', async () => undefined)
  t.mock.method(authRepository, 'deleteSession', async (tokenHash: string) => ({ count: Number(sessions.delete(tokenHash)) }))
  const deletePushDevices = t.mock.method(pushDeviceRepository, 'deleteForSession', async () => ({ count: 1 }))

  const app = await buildApp()
  t.after(() => app.close())

  async function request<T>(query: string, accessToken?: string, variables?: Record<string, unknown>) {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
      payload: { query, variables },
    })
    assert.equal(response.statusCode, 200)
    return response.json<GraphqlResponse<T>>()
  }

  const login = (attempt: string) => request<{ testLogin: { accessToken: string; viewer: { id: string } } }>(
    loginMutation,
    undefined,
    { input: { loginId, password: attempt } },
  )

  async function signIn() {
    const result = await login(password)
    assert.equal(result.errors, undefined)
    assert.equal(result.data?.testLogin.viewer.id, viewer.id)
    const accessToken = result.data?.testLogin.accessToken
    assert.ok(accessToken)
    return accessToken
  }

  async function assertSignedIn(accessToken: string) {
    const result = await request<{ me: { id: string } }>(viewerQuery, accessToken)
    assert.equal(result.errors, undefined)
    assert.deepEqual(result.data, { me: { id: viewer.id } })
  }

  return { request, login, signIn, assertSignedIn, sessions, updateLastLogin, createSession, touchSession, deletePushDevices }
}

test('잘못된 비밀번호를 거절하고 기존 계정의 로그인 시각과 세션을 변경하지 않는다', async (t) => {
  const fixture = await createAuthFixture(t)
  const accessToken = await fixture.signIn()

  assertGraphqlError(await fixture.login('wrong-password'), 'INVALID_TEST_CREDENTIALS')
  assert.equal(fixture.updateLastLogin.mock.callCount(), 1)
  assert.equal(fixture.createSession.mock.callCount(), 1)
  await fixture.assertSignedIn(accessToken)
})

test('만료된 세션으로 인증을 거절하고 마지막 사용을 갱신하지 않으며 세션을 제거한다', async (t) => {
  const fixture = await createAuthFixture(t)
  const accessToken = await fixture.signIn()
  await fixture.assertSignedIn(accessToken)
  const tokenHash = hashSessionToken(accessToken)
  const session = fixture.sessions.get(tokenHash)
  assert.ok(session)
  session.expiresAt = new Date(0)

  assertGraphqlError(await fixture.request(viewerQuery, accessToken), 'UNAUTHENTICATED')
  assert.equal(fixture.touchSession.mock.callCount(), 1)
  assert.equal(fixture.sessions.has(tokenHash), false)
})

test('로그아웃한 토큰을 다시 사용할 수 없고 다른 세션은 유지된다', async (t) => {
  const fixture = await createAuthFixture(t)
  const accessToken = await fixture.signIn()
  const otherToken = await fixture.signIn()
  await fixture.assertSignedIn(accessToken)

  const result = await fixture.request<{ logout: boolean }>('mutation { logout }', accessToken)
  assert.equal(result.errors, undefined)
  assert.deepEqual(result.data, { logout: true })
  assert.deepEqual(fixture.deletePushDevices.mock.calls.map((call) => call.arguments), [[hashSessionToken(accessToken)]])
  assertGraphqlError(await fixture.request(viewerQuery, accessToken), 'UNAUTHENTICATED')
  await fixture.assertSignedIn(otherToken)
})
