import assert from 'node:assert/strict'
import test from 'node:test'
import type { PrismaClient, Prisma as PrismaTypes } from '@prisma/client'

const databaseUrl = process.env.TEST_DATABASE_URL?.trim()

/** 빈 closet_account_test_숫자 DB만 사용한다. CF는 대체하고 자신이 만든 전용 DB만 종료 시 제거한다. */
test('실제 MongoDB에서 탈퇴의 원자성·전체 세션 폐기·사진 재시도·다른 계정 보존을 확인한다', {
  skip: databaseUrl ? false : 'TEST_DATABASE_URL이 없어 실제 DB 검사를 실행하지 않았습니다.',
}, async t => {
  const target = new URL(databaseUrl!)
  assert.ok(['mongodb:', 'mongodb+srv:'].includes(target.protocol))
  assert.match(target.pathname, /^\/closet_account_test_\d+$/)
  const globals = globalThis as typeof globalThis & { prisma?: PrismaClient }
  assert.equal(globals.prisma, undefined)
  const previousUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = databaseUrl
  const { PrismaClient, Prisma } = await import('@prisma/client')
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl! } } })
  globals.prisma = client
  let ownsDatabase = false
  t.after(async () => {
    try { if (ownsDatabase) await client.$runCommandRaw({ dropDatabase: 1 }) }
    finally {
      await client.$disconnect()
      delete globals.prisma
      if (previousUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = previousUrl
    }
  })
  const inventory = await client.$runCommandRaw({ listCollections: 1, nameOnly: true }) as { cursor?: { firstBatch?: unknown[] } }
  assert.deepEqual(inventory.cursor?.firstBatch, [], '기존 데이터가 있는 DB는 사용하지 않습니다.')
  ownsDatabase = true
  for (const model of Prisma.dmmf.datamodel.models) await client.$runCommandRaw({ create: model.dbName ?? model.name })

  const { accountDeletionService } = await import('./account-deletion.service.js')
  const { accountDeletionRepository } = await import('./account-deletion.repository.js')
  const { imageRepository } = await import('../image/image.repository.js')
  const { cloudflareImagesClient } = await import('../image/cloudflare-images.client.js')
  const { cleanupDeletedAccountImage } = await import('./account-image-cleanup.worker.js')
  const { hashSessionToken } = await import('../auth/sessionToken.js')
  const { aiInputKey } = await import('../../lib/ai/ai-execution.js')
  const { buildApp } = await import('../../app.js')
  const owner = await client.user.create({ data: {
    displayName: '탈퇴 통합 테스트', email: 'deletion@example.invalid',
    testAccount: { create: { loginId: 'delete_integration', passwordHash: 'test-only', passwordSalt: 'test-only' } },
    settings: { create: { completionPushEnabled: false } }, styleProfile: { create: { heightCm: 170 } },
    preferredStyles: { create: { style: 'casual' } },
  } })
  const other = await client.user.create({ data: { displayName: '보존 계정' } })
  const otherItem = await client.wardrobeItem.create({ data: { userId: other.id, name: '다른 계정의 옷' } })
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 86_400_000)
  for (const token of ['owner-session-A', 'owner-session-B']) await client.userSession.create({ data: { userId: owner.id, tokenHash: hashSessionToken(token), expiresAt } })
  await client.userSession.create({ data: { userId: other.id, tokenHash: hashSessionToken('other-session'), expiresAt } })
  await client.pushDevice.create({ data: { userId: owner.id, sessionTokenHash: hashSessionToken('owner-session-A'), expoPushToken: 'ExponentPushToken[integration-only]', platform: 'ios' } })
  await client.oAuthAccount.create({ data: { userId: owner.id, provider: 'google', providerAccountId: 'integration-only' } })
  const photo = await client.imageAsset.create({ data: { userId: owner.id, cloudflareImageId: 'account-owned-photo', kind: 'wardrobeOriginal', uploadStatus: 'ready' } })
  const generated = await client.imageAsset.create({ data: { userId: owner.id, cloudflareImageId: 'account-owned-ai', kind: 'outfitGenerated', uploadStatus: 'ready' } })
  const item = await client.wardrobeItem.create({ data: { userId: owner.id, name: '탈퇴 테스트 옷', category: 'top', displayImageAssetId: photo.id } })
  const outfit = await client.outfit.create({ data: { userId: owner.id, name: '탈퇴 테스트 코디', style: 'casual',
    items: { create: { wardrobeItemId: item.id, slot: 'top' } },
    generations: { create: { userId: owner.id, imageAssetId: generated.id, status: 'completed' } },
  } })
  const week = await client.plannerWeek.create({ data: { userId: owner.id, weekStartsOn: new Date('2026-11-02'),
    entries: { create: { date: new Date('2026-11-02'), outfitId: outfit.id, wornAt: now, wearFeeling: 'comfortable', wearTemperatureC: 15 } },
  } })
  await client.wardrobeRediscovery.create({ data: { userId: owner.id, day: '2026-11-17', itemIds: [item.id], impressions: {} } })
  await client.aiCreditWallet.create({ data: { userId: owner.id, balance: 2 } })
  await client.previewCreditDay.create({ data: { id: 'owned-day', userId: owner.id, day: '2026-11-17', expiresAt } })
  await client.previewRewardSession.create({ data: { id: 'owned-reward', userId: owner.id, mode: 'test', adUnitId: 'test', validUntil: expiresAt, expiresAt } })
  await client.previewRewardReceipt.create({ data: { id: 'owned-receipt', sessionId: 'owned-reward', expiresAt } })
  await client.recommendationCreditUse.create({ data: { id: 'owned-credit', userId: owner.id, creditDayId: owner.id, creditSource: 'wallet', state: 'reserved', token: 'owned-token', leaseUntil: expiresAt, expiresAt } })
  await client.aiPreviewJob.create({ data: { id: 'owned-job', userId: owner.id, requestKeys: ['owned-request'], inputKey: 'owned-input', fingerprint: 'owned-fingerprint', selectedItemIds: [item.id], status: 'processing', leaseToken: 'owned-lease', leaseUntil: expiresAt, expiresAt } })
  await client.aiExecution.create({ data: { id: 'owned-execution', userId: owner.id, kind: 'preview', status: 'processing', leaseToken: 'owned-lease', leaseUntil: expiresAt, cacheUntil: now, expiresAt } })
  await client.aiLease.create({ data: { id: 'global:0', token: 'owned-lease', leaseUntil: expiresAt } })
  await client.aiQuota.create({ data: { id: aiInputKey([owner.id, 'preview']), minuteStart: now, minuteCount: 1, dayStart: now, dayCount: 1, expiresAt } })

  // 커밋 직전에 실패시켜 자식 레코드·세션·삭제 큐가 함께 복원되는지 확인한다.
  const transaction = client.$transaction
  client.$transaction = (async (operation: unknown, options?: { maxWait?: number; timeout?: number }) => transaction.call(client, async (tx: PrismaTypes.TransactionClient) => {
    await (operation as (tx: PrismaTypes.TransactionClient) => Promise<unknown>)(tx)
    throw new Error('integration rollback')
  }, options)) as typeof transaction
  try { await assert.rejects(accountDeletionService.deleteAccount(owner.id, '회원탈퇴'), /integration rollback/) }
  finally { client.$transaction = transaction }
  assert.ok(await client.user.findUnique({ where: { id: owner.id } }))
  assert.equal(await client.userSession.count({ where: { userId: owner.id } }), 2)
  assert.equal(await client.wardrobeItem.count({ where: { userId: owner.id } }), 1)
  assert.equal(await client.accountImageCleanup.count(), 0)

  const app = await buildApp()
  t.after(() => app.close())
  const request = (query: string, token: string) => app.inject({ method: 'POST', url: '/graphql', headers: { authorization: `Bearer ${token}` }, payload: { query } })
  const invalid = await request('mutation { deleteMyAccount(confirmation: "취소") }', 'owner-session-A')
  assert.equal(invalid.json().errors[0].extensions.code, 'ACCOUNT_DELETION_CONFIRMATION_REQUIRED')
  const removed = await request('mutation { deleteMyAccount(confirmation: "회원탈퇴") }', 'owner-session-A')
  assert.deepEqual(removed.json().data, { deleteMyAccount: true })
  for (const token of ['owner-session-A', 'owner-session-B']) {
    const oldSession = await request('query { me { id } }', token)
    assert.equal(oldSession.json().errors[0].extensions.code, 'UNAUTHENTICATED')
  }
  assert.equal(await client.user.findUnique({ where: { id: owner.id } }), null)
  assert.equal(await client.testAccount.count({ where: { userId: owner.id } }), 0)
  assert.equal(await client.plannerEntry.count({ where: { plannerWeekId: week.id } }), 0)
  assert.equal(await client.outfitItem.count({ where: { outfitId: outfit.id } }), 0)
  assert.equal(await client.previewRewardReceipt.count({ where: { sessionId: 'owned-reward' } }), 0)
  for (const model of Prisma.dmmf.datamodel.models.filter(model => model.fields.some(field => field.name === 'userId'))) {
    const rawUserId = model.name === 'AiExecution' ? owner.id : { $oid: owner.id }
    const field = model.fields.find(field => field.name === 'userId')!
    const result = await client.$runCommandRaw({ count: model.dbName ?? model.name, query: { [field.dbName ?? field.name]: rawUserId } }) as { n: number }
    assert.equal(result.n, 0, `${model.name}에 탈퇴 계정 데이터가 남아 있습니다.`)
  }
  assert.equal(await client.aiQuota.count(), 0)
  assert.equal(await client.accountImageCleanup.count(), 2)
  assert.deepEqual(await client.wardrobeItem.findUnique({ where: { id: otherItem.id } }), otherItem)
  assert.deepEqual((await request('query { me { id } }', 'other-session')).json().data, { me: { id: other.id } })
  await assert.rejects(imageRepository.create({ userId: owner.id, kind: 'outfitGenerated', cloudflareImageId: 'late-file', storageFilename: 'late.png' }), { code: 'UNAUTHENTICATED' })

  const raceOwner = await client.user.create({ data: { displayName: '동시 삭제 테스트' } })
  await Promise.allSettled([
    imageRepository.create({ userId: raceOwner.id, kind: 'outfitGenerated', cloudflareImageId: 'race-file', storageFilename: 'race.png' }),
    accountDeletionRepository.deleteOwnedAccount(raceOwner.id),
  ])
  assert.equal(await client.user.findUnique({ where: { id: raceOwner.id } }), null)
  assert.equal(await client.imageAsset.count({ where: { userId: raceOwner.id } }), 0)

  let fail = true
  const deletedFiles: string[] = []
  t.mock.method(cloudflareImagesClient, 'deleteImage', async (id: string) => { if (fail) throw new Error('CF fixture failure'); deletedFiles.push(id) })
  await cleanupDeletedAccountImage()
  assert.ok(await client.accountImageCleanup.count() >= 2)
  fail = false
  await client.accountImageCleanup.updateMany({ data: { retryAt: new Date(0) } })
  for (let attempt = 0; attempt < 5; attempt += 1) if (!await cleanupDeletedAccountImage()) break
  assert.equal(await client.accountImageCleanup.count(), 0)
  assert.ok(deletedFiles.includes('account-owned-photo') && deletedFiles.includes('account-owned-ai'))
})
