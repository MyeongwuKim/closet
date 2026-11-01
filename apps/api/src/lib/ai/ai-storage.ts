import { Prisma } from '@prisma/client'
import { setTimeout as delay } from 'node:timers/promises'
import { prisma } from '../prisma.js'

/** db push가 먼저 일반 인덱스를 만들었어도 AI 전용 만료 필드의 TTL로 갱신한다. */
async function ensureTtlIndex(collection: string, field: string, name: string) {
  try {
    await prisma.$runCommandRaw({ createIndexes: collection, indexes: [{ key: { [field]: 1 }, name, expireAfterSeconds: 0 }] })
  } catch (error) {
    if (!/IndexOptionsConflict|already exists with different|equivalent index already exists/i.test(String(error))) throw error
    await prisma.$runCommandRaw({ collMod: collection, index: { keyPattern: { [field]: 1 }, expireAfterSeconds: 0 } })
  }
}

/** MongoDB 트랜잭션의 쓰기 충돌·동시 최초 생성만 다시 시도한다. API 호출 같은 외부 처리는 콜백에 넣지 않는다. */
export async function aiTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { maxWait: 5000, timeout: 10_000 })
    } catch (error) {
      const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined
      if (attempt >= 5 || !['P2034', 'P2002'].includes(code ?? '')) throw error
      await delay(20 * (attempt + 1) + Math.random() * 30)
    }
  }
}

/**
 * AI 전용 컬렉션에 만료 문서 정리용 TTL 인덱스만 추가한다. 기존 서비스 문서는 변경하지 않으며 ImageAsset에는 작업 결과 조회 인덱스만 추가한다.
 * MongoDB의 기본 _id 유일 인덱스가 작업 키·사용량 키·실행 슬롯의 중복 생성을 막는다.
 */
export async function ensureAiStorage() {
  // 사용자별 지갑은 만료시키지 않는다. 첫 예약 트랜잭션 전에 컬렉션만 준비한다.
  try { await prisma.$runCommandRaw({ create: 'AiCreditWallet' }) }
  catch (error) { if (!/NamespaceExists|already exists/i.test(String(error))) throw error }
  for (const collection of ['AiExecution', 'AiQuota', 'AiPreviewJob', 'PreviewCreditDay', 'PreviewRewardSession', 'PreviewRewardReceipt', 'RecommendationCreditUse']) {
    await ensureTtlIndex(collection, 'expiresAt', 'ai_expires_ttl')
  }
  await ensureTtlIndex('AiLease', 'leaseUntil', 'ai_lease_ttl')
  await prisma.$runCommandRaw({ createIndexes: 'ImageAsset', indexes: [{ key: { userId: 1, aiPreviewJobId: 1 }, name: 'ai_preview_result' }] })
  await prisma.$runCommandRaw({ createIndexes: 'PreviewRewardSession', indexes: [{ key: { userId: 1, status: 1, validUntil: 1 }, name: 'preview_reward_pending' }] })
  await prisma.$runCommandRaw({
    createIndexes: 'AiPreviewJob',
    indexes: [
      { key: { userId: 1, status: 1, createdAt: -1 }, name: 'ai_user_jobs' },
      { key: { status: 1, leaseUntil: 1 }, name: 'ai_pending_jobs' },
      { key: { requestKeys: 1 }, name: 'ai_request_keys' },
    ],
  })
}

/** 한 트랜잭션에서 같은 키에 대한 결정을 직렬화한다. 외부 요청을 기다리는 동안 유지하는 잠금은 아니다. */
export async function touchAiMutex(tx: Prisma.TransactionClient, id: string, token: string, now: Date) {
  await tx.aiLease.upsert({ where: { id }, create: { id, token, leaseUntil: now }, update: { token, leaseUntil: now } })
}
