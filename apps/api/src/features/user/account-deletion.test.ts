import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { accountDeletionService } from './account-deletion.service.js'
import { accountDeletionRepository } from './account-deletion.repository.js'
import { accountImageCleanupRepository } from './account-image-cleanup.repository.js'
import { cleanupDeletedAccountImage } from './account-image-cleanup.worker.js'
import { cloudflareImagesClient } from '../image/cloudflare-images.client.js'
import { imageRepository } from '../image/image.repository.js'
import { imageService } from '../image/image.service.js'
import { ServiceError } from '../../graphql/errors.js'

test('명시적 최종 확인이 있어야 본인 탈퇴를 실행하며 없는 계정은 거절한다', async t => {
  let exists = true
  const remove = t.mock.method(accountDeletionRepository, 'deleteOwnedAccount', async (id: string) => { assert.equal(id, 'owner'); return exists })
  await assert.rejects(accountDeletionService.deleteAccount('owner', ''), { code: 'ACCOUNT_DELETION_CONFIRMATION_REQUIRED' })
  assert.equal(remove.mock.callCount(), 0)
  assert.equal(await accountDeletionService.deleteAccount('owner', '회원탈퇴'), true)
  exists = false
  await assert.rejects(accountDeletionService.deleteAccount('owner', '회원탈퇴'), { code: 'UNAUTHENTICATED' })
})

test('탈퇴 GraphQL은 인증된 본인만 사용하고 임의 사용자 ID는 받지 않는다', async t => {
  const { buildApp } = await import('../../app.js')
  const { authService } = await import('../auth/auth.service.js')
  const app = await buildApp()
  t.after(() => app.close())
  const remove = t.mock.method(accountDeletionService, 'deleteAccount', async (id: string, confirmation: string) => { assert.equal(id, 'owner'); assert.equal(confirmation, '회원탈퇴'); return true })
  const query = 'mutation { deleteMyAccount(confirmation: "회원탈퇴") }'
  const anonymous = await app.inject({ method: 'POST', url: '/graphql', payload: { query } })
  assert.equal(anonymous.json().errors[0].extensions.code, 'UNAUTHENTICATED')
  assert.equal(remove.mock.callCount(), 0)
  t.mock.method(authService, 'getViewer', async () => ({ id: 'owner' }))
  const own = await app.inject({ method: 'POST', url: '/graphql', payload: { query } })
  assert.deepEqual(own.json().data, { deleteMyAccount: true })
  const forbidden = await app.inject({ method: 'POST', url: '/graphql', payload: { query: 'mutation { deleteMyAccount(userId: "other", confirmation: "회원탈퇴") }' } })
  assert.equal(forbidden.json().errors[0].extensions.code, 'GRAPHQL_VALIDATION_FAILED')
})

test('탈퇴한 계정의 늦은 이미지 저장은 자산을 만들지 않는다', async t => {
  const create = t.mock.fn(async () => assert.fail('이미지를 복원하면 안 됩니다.'))
  const originalTransaction = prisma.$transaction
  prisma.$transaction = (async (operation: unknown) => (operation as (tx: Prisma.TransactionClient) => Promise<unknown>)({
    aiLease: { upsert: async () => ({}) }, user: { updateMany: async () => ({ count: 0 }) }, imageAsset: { create },
  } as unknown as Prisma.TransactionClient)) as typeof originalTransaction
  t.after(() => { prisma.$transaction = originalTransaction })
  await assert.rejects(imageRepository.create({ userId: 'deleted', cloudflareImageId: 'late', kind: 'outfitGenerated', storageFilename: 'late.png' }), { code: 'UNAUTHENTICATED' })
  assert.equal(create.mock.callCount(), 0)
})

for (const fail of [false, true]) {
  test(`원격 사진 삭제 ${fail ? '실패는 큐에서 재시도한다' : '성공만 큐에서 제거한다'}`, async t => {
    t.mock.method(accountImageCleanupRepository, 'claim', async () => ({ cloudflareImageId: 'owned-photo', leaseToken: 'lease' }))
    const remove = t.mock.method(cloudflareImagesClient, 'deleteImage', async (id: string) => { assert.equal(id, 'owned-photo'); if (fail) throw new Error('CF unavailable') })
    const complete = t.mock.method(accountImageCleanupRepository, 'complete', async () => ({ count: 1 }))
    const retry = t.mock.method(accountImageCleanupRepository, 'retry', async () => ({ count: 1 }))
    assert.equal(await cleanupDeletedAccountImage(), true)
    assert.equal(remove.mock.callCount(), 1)
    assert.equal(complete.mock.callCount(), Number(!fail))
    assert.equal(retry.mock.callCount(), Number(fail))
  })
}

test('탈퇴와 겹친 업로드의 원격 삭제까지 실패하면 영속 큐에 남긴다', async t => {
  t.mock.method(cloudflareImagesClient, 'createDirectUpload', async () => ({ id: 'late-upload', uploadURL: 'https://upload.invalid' }))
  t.mock.method(imageRepository, 'create', async () => { throw new ServiceError('로그인이 필요해요.', 'UNAUTHENTICATED') })
  t.mock.method(cloudflareImagesClient, 'deleteImage', async () => { throw new Error('CF unavailable') })
  const queue = t.mock.method(accountImageCleanupRepository, 'enqueue', async (id: string) => { assert.equal(id, 'late-upload') })
  await assert.rejects(imageService.prepareUpload('deleted', { kind: 'wardrobeOriginal', mimeType: 'image/png' }), { code: 'UNAUTHENTICATED' })
  assert.equal(queue.mock.callCount(), 1)
})
