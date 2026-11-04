import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { ImageAsset, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { imageRepository } from './image.repository.js'

/** 트랜잭션에서 active-job 조회와 claim 쓰기만 관찰해 원격 tombstone의 재시도 보호 범위를 확인한다. */
function fixture(t: TestContext, remoteTombstone: boolean) {
  const now = new Date('2026-11-04T00:00:00Z')
  const asset = {
    id: 'asset', userId: 'owner', aiPreviewJobId: null, updatedAt: new Date('2026-11-03'),
    metadata: { purpose: remoteTombstone ? 'cloudflareOrphanCleanup' : 'outfitPreview' },
  } as unknown as ImageAsset
  const activeQueries: any[] = []
  let writes = 0
  const tx = {
    imageAsset: {
      findFirst: async () => asset,
      updateMany: async () => { writes += 1; return { count: 1 } },
    },
    aiPreviewJob: { findFirst: async (args: any) => { activeQueries.push(args); return args.where.OR.some((condition: any) => condition.userId === 'owner') ? { id: 'same-owner-active-job' } : null } },
    outfitGeneration: { deleteMany: async () => ({ count: 0 }) },
  } as unknown as Prisma.TransactionClient
  const original = prisma.$transaction
  prisma.$transaction = (async (run: (client: Prisma.TransactionClient) => Promise<unknown>) => run(tx)) as typeof original
  t.after(() => { prisma.$transaction = original })
  return { now, activeQueries, writes: () => writes }
}

test('원격 고아 tombstone 재시도도 같은 계정의 진행·복구 작업이 있으면 삭제 claim을 거절한다', async (t) => {
  const state = fixture(t, true)
  assert.equal(await imageRepository.claimExpiredGeneratedPreview('asset', state.now), null)
  assert.deepEqual(state.activeQueries[0].where.status, { in: ['queued', 'processing'] })
  assert.ok(state.activeQueries[0].where.OR.some((condition: any) => condition.userId === 'owner'))
  assert.equal(state.writes(), 0)
})

test('일반 생성 결과는 무관한 계정 내 작업이 아니라 해당 이미지·작업 ID로만 보호한다', async (t) => {
  const state = fixture(t, false)
  assert.ok(await imageRepository.claimExpiredGeneratedPreview('asset', state.now))
  assert.deepEqual(state.activeQueries[0].where.OR, [{ imageAssetId: 'asset' }])
  assert.equal(state.writes(), 1)
})
