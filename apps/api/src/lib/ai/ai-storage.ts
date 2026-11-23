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

/** Prisma가 같은 인덱스를 다른 이름으로 생성했으면 재사용한다. 호환되지 않는 설정은 시작 오류로 남긴다. */
async function ensureQueryIndex(collection: string, key: Record<string, 1 | -1>, name: string) {
  try {
    await prisma.$runCommandRaw({ createIndexes: collection, indexes: [{ key, name }] })
  } catch (error) {
    if (!/IndexOptionsConflict\): Index already exists with a different name:/i.test(String(error))) throw error
  }
}

/** MongoDB 쓰기 충돌·동시 최초 생성만 재시도한다. 기본 제한은 10초이며 계정 일괄 삭제는 timeout을 늘린다. 외부 호출은 콜백에 넣지 않는다. */
export async function aiTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, options: { timeout?: number } = {}): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { maxWait: 5000, timeout: options.timeout ?? 10_000 })
    } catch (error) {
      const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined
      if (attempt >= 5 || !['P2034', 'P2002'].includes(code ?? '')) throw error
      await delay(20 * (attempt + 1) + Math.random() * 30)
    }
  }
}

/**
 * AI 전용 컬렉션의 TTL과 작업·이미지·보상 조회 인덱스를 준비한다. 기존 서비스 문서는 변경하지 않는다.
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
  await ensureQueryIndex('ImageAsset', { userId: 1, aiPreviewJobId: 1 }, 'ai_preview_result')
  await ensureQueryIndex('PreviewRewardSession', { userId: 1, status: 1, validUntil: 1 }, 'preview_reward_pending')
  await ensureQueryIndex('AiPreviewJob', { userId: 1, status: 1, createdAt: -1 }, 'ai_user_jobs')
  await ensureQueryIndex('AiPreviewJob', { status: 1, leaseUntil: 1 }, 'ai_pending_jobs')
  await ensureQueryIndex('AiPreviewJob', { requestKeys: 1 }, 'ai_request_keys')
}

/** 한 트랜잭션에서 같은 키에 대한 결정을 직렬화한다. 외부 요청을 기다리는 동안 유지하는 잠금은 아니다. */
export async function touchAiMutex(tx: Prisma.TransactionClient, id: string, token: string, now: Date) {
  await tx.aiLease.upsert({ where: { id }, create: { id, token, leaseUntil: now }, update: { token, leaseUntil: now } })
}
