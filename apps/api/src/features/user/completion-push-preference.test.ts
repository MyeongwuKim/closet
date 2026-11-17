import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma, PrismaClient } from '@prisma/client'

test('완료 알림은 기존 기본값을 유지하고 본인 설정만 독립적으로 저장·조회한다', async (t) => {
  let stored: { completionPushEnabled?: boolean; rediscoveryPushEnabled: boolean; enabled: boolean } | null = null
  const upsert = t.mock.fn(async (args: Prisma.UserSettingsUpsertArgs) => {
    assert.equal(args.where.userId, 'owner')
    stored = { rediscoveryPushEnabled: true, enabled: true, ...stored, completionPushEnabled: args.update.completionPushEnabled as boolean }
    return stored
  })
  const scope = globalThis as typeof globalThis & { prisma?: PrismaClient }
  const previous = scope.prisma
  scope.prisma = {
    userSettings: { findUnique: async () => stored, upsert },
    user: { findUnique: async () => ({ id: 'owner', settings: stored, styleProfile: null, preferredStyles: [], isTemporary: true }) },
  } as unknown as PrismaClient
  t.after(() => { if (previous === undefined) delete scope.prisma; else scope.prisma = previous })
  const { userService, toViewerResponse } = await import('./user.service.js')
  const { pushDeviceRepository } = await import('../push/push.repository.js')
  const { userRepository } = await import('./user.repository.js')

  assert.equal(await pushDeviceRepository.isCompletionPushEnabled('owner'), true)
  assert.equal(toViewerResponse((await userRepository.findViewerById('owner'))!).completionPushEnabled, true)
  stored = { rediscoveryPushEnabled: true, enabled: true }
  assert.equal(await pushDeviceRepository.isCompletionPushEnabled('owner'), true, '필드가 없는 기존 문서도 허용 기본값을 유지한다')
  for (const value of [undefined, null, 'false', 0]) {
    await assert.rejects(userService.setCompletionPushEnabled('owner', value as unknown as boolean), { code: 'INVALID_COMPLETION_PUSH_PREFERENCE' })
  }
  assert.equal(upsert.mock.callCount(), 0)
  const disabled = await userService.setCompletionPushEnabled('owner', false)
  assert.equal(toViewerResponse(disabled).completionPushEnabled, false)
  assert.equal(await pushDeviceRepository.isCompletionPushEnabled('owner'), false)
  assert.equal(toViewerResponse(disabled).rediscoveryPushEnabled, true)
  assert.equal(toViewerResponse(disabled).wearReminderPreferences.enabled, true)
  assert.deepEqual(upsert.mock.calls[0].arguments[0].update, { completionPushEnabled: false })
  const enabled = await userService.setCompletionPushEnabled('owner', true)
  assert.equal(toViewerResponse(enabled).completionPushEnabled, true)
  assert.equal(await pushDeviceRepository.isCompletionPushEnabled('owner'), true)

  const { authService } = await import('../auth/auth.service.js')
  const { buildApp } = await import('../../app.js')
  const app = await buildApp()
  t.after(() => app.close())
  const query = 'mutation { setCompletionPushEnabled(enabled: false) { id completionPushEnabled rediscoveryPushEnabled } }'
  const unauthenticated = await app.inject({ method: 'POST', url: '/graphql', payload: { query } })
  assert.equal(unauthenticated.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  t.mock.method(authService, 'getViewer', async () => enabled)
  const response = await app.inject({ method: 'POST', url: '/graphql', headers: { authorization: 'Bearer test-session' }, payload: { query } })
  assert.equal(response.json().errors, undefined)
  assert.deepEqual(response.json().data.setCompletionPushEnabled, { id: 'owner', completionPushEnabled: false, rediscoveryPushEnabled: true })
})
