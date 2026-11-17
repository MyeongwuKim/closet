import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { ViewerRecord } from '../user/user.repository.js'

test('재발견 푸시의 동의·검사 시각·원자적 예약과 설정 저장 계약', async (t) => {
  const now = new Date('2026-11-15T00:00:00Z')
  let stored: { rediscoveryPushEnabled: boolean; rediscoveryPushNextAt: Date | null } | null = null
  const read = t.mock.fn(async (_args: Prisma.UserSettingsFindManyArgs) => [])
  const update = t.mock.fn(async (_args: Prisma.UserSettingsUpdateManyArgs) => ({ count: 1 }))
  const upsert = t.mock.fn(async (args: Prisma.UserSettingsUpsertArgs) => {
    stored = { rediscoveryPushEnabled: args.create.rediscoveryPushEnabled as boolean, rediscoveryPushNextAt: args.create.rediscoveryPushNextAt as Date | null }
    return stored
  })
  const scope = globalThis as typeof globalThis & { prisma?: PrismaClient }
  const previous = scope.prisma
  scope.prisma = {
    userSettings: { findMany: read, updateMany: update, findUnique: async () => stored, upsert },
    user: { findUnique: async () => ({ id: 'owner', isTemporary: true, settings: stored, styleProfile: null, preferredStyles: [] } as unknown as ViewerRecord) },
  } as unknown as PrismaClient
  t.after(() => { if (previous === undefined) delete scope.prisma; else scope.prisma = previous })
  const { rediscoveryPushRepository: repository } = await import('./rediscovery-push.repository.js')
  const { userRepository } = await import('../user/user.repository.js')
  const { userService, toViewerResponse } = await import('../user/user.service.js')

  await repository.findDue(now)
  const filter = read.mock.calls[0].arguments[0].where
  assert.equal(filter?.rediscoveryPushEnabled, true)
  assert.deepEqual(filter?.OR, [{ rediscoveryPushNextAt: { lte: now } }, { rediscoveryPushNextAt: null }, { rediscoveryPushNextAt: { isSet: false } }])
  const reserved = new Date('2026-11-22T00:00:00Z')
  assert.equal(await repository.claim('owner', now, reserved), true)
  assert.equal(update.mock.calls[0].arguments[0].where?.userId, 'owner')
  assert.equal(update.mock.calls[0].arguments[0].where?.rediscoveryPushEnabled, true)
  await repository.retryTomorrow('owner', reserved, new Date('2026-11-16T00:00:00Z'))
  assert.deepEqual(update.mock.calls[1].arguments[0].where, { userId: 'owner', rediscoveryPushEnabled: true, rediscoveryPushNextAt: reserved })

  assert.equal(toViewerResponse({ settings: null, styleProfile: null, preferredStyles: [] } as unknown as ViewerRecord).rediscoveryPushEnabled, false)
  const enabled = await userService.setRediscoveryPushEnabled('owner', true)
  assert.equal(toViewerResponse(enabled).rediscoveryPushEnabled, true)
  assert.equal(upsert.mock.calls[0].arguments[0].where.userId, 'owner')
  assert.equal((stored as { rediscoveryPushNextAt: Date } | null)?.rediscoveryPushNextAt.getUTCHours(), 0)
  await userRepository.setRediscoveryPushEnabled('owner', true)
  assert.equal(upsert.mock.callCount(), 1, '같은 동의 값으로 재요청해도 주간 예약을 초기화하지 않는다')
  const disabled = await userService.setRediscoveryPushEnabled('owner', false)
  assert.equal(toViewerResponse(disabled).rediscoveryPushEnabled, false)
  assert.equal((stored as { rediscoveryPushNextAt: Date | null } | null)?.rediscoveryPushNextAt, null)
})
