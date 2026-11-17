import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma, PrismaClient } from '@prisma/client'

test('계정 정보는 본인의 이름·이메일·로그인 ID만 반환하고 비밀번호를 조회하지 않는다', async (t) => {
  let account: { displayName: string; email: string | null; testAccount: { loginId: string } | null } | null = {
    displayName: '계정 사용자', email: null, testAccount: { loginId: 'account_test' },
  }
  const find = t.mock.fn(async (input: Prisma.UserFindUniqueArgs) => {
    assert.deepEqual(input, { where: { id: 'owner' }, select: {
      displayName: true, email: true, testAccount: { select: { loginId: true } },
    } })
    return account
  })
  const scope = globalThis as typeof globalThis & { prisma?: PrismaClient }
  const previous = scope.prisma
  scope.prisma = { user: { findUnique: find } } as unknown as PrismaClient
  t.after(() => { if (previous === undefined) delete scope.prisma; else scope.prisma = previous })
  const { userService } = await import('./user.service.js')
  assert.deepEqual(await userService.getAccountInfo('owner'), {
    displayName: '계정 사용자', email: null, loginId: 'account_test',
  })
  account = { displayName: '이메일 사용자', email: 'account@example.com', testAccount: null }
  assert.deepEqual(await userService.getAccountInfo('owner'), {
    displayName: '이메일 사용자', email: 'account@example.com', loginId: null,
  })
  account = null
  await assert.rejects(userService.getAccountInfo('owner'), { code: 'UNAUTHENTICATED' })

  const { buildApp } = await import('../../app.js')
  const { authService } = await import('../auth/auth.service.js')
  const app = await buildApp()
  t.after(() => app.close())
  const query = 'query { myAccount { displayName email loginId } }'
  const beforeAuth = find.mock.callCount()
  const anonymous = await app.inject({ method: 'POST', url: '/graphql', payload: { query } })
  assert.equal(anonymous.json().errors[0].extensions.code, 'UNAUTHENTICATED')
  assert.equal(find.mock.callCount(), beforeAuth)
  t.mock.method(authService, 'getViewer', async () => ({ id: 'owner' }))
  account = { displayName: '본인', email: null, testAccount: { loginId: 'owner_login' } }
  const authorized = await app.inject({ method: 'POST', url: '/graphql', headers: { authorization: 'Bearer owner-session' }, payload: { query } })
  assert.equal(authorized.json().errors, undefined)
  assert.deepEqual(authorized.json().data.myAccount, { displayName: '본인', email: null, loginId: 'owner_login' })
  const forbiddenFields = await app.inject({ method: 'POST', url: '/graphql', headers: { authorization: 'Bearer owner-session' }, payload: {
    query: 'query { myAccount(userId: "other-user") { passwordHash } }',
  } })
  assert.ok(forbiddenFields.json().errors.every((error: { extensions: { code: string } }) => error.extensions.code === 'GRAPHQL_VALIDATION_FAILED'))
})
