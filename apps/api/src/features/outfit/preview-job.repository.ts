import { randomUUID } from 'node:crypto'
import type { AiPreviewJob } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { prisma } from '../../lib/prisma.js'
import { aiTransaction, touchAiMutex } from '../../lib/ai/ai-storage.js'
import { reservePreviewCredit, settlePreviewCredit } from '../preview-credits/preview-credit.repository.js'
import { lockWardrobeItemsForReference } from '../wardrobe/wardrobe-image-lifecycle.js'

export const PREVIEW_JOB_LEASE_MS = 90_000

/** 생성 요청·진행 임대·결과 자산 ID를 MongoDB에 보관한다. 모든 상태 변경은 현재 작업 토큰을 확인한다. */
export const previewJobRepository = {
  /** 재전송·진행 중 작업을 재사용한다. 새 작업은 옷 사진 정리와 같은 잠금을 잡은 뒤 사용권을 예약해 등록한다. */
  enqueue(input: { id: string; userId: string; requestKey: string; inputKey: string; fingerprint: string; selectedItemIds: string[]; style: string | null }) {
    return aiTransaction(async (tx) => {
      const now = new Date()
      await touchAiMutex(tx, 'preview-queue', randomUUID(), now)
      const existing = await tx.aiPreviewJob.findFirst({ where: { userId: input.userId, requestKeys: { has: input.requestKey } } })
      if (existing) {
        if (existing.inputKey !== input.inputKey) throw new ServiceError('같은 요청 번호로 다른 코디를 생성할 수 없어요.', 'AI_IDEMPOTENCY_CONFLICT')
        return existing
      }
      const active = await tx.aiPreviewJob.findFirst({ where: { userId: input.userId, fingerprint: input.fingerprint, status: { in: ['queued', 'processing'] }, expiresAt: { gt: now } } })
      if (active) {
        if (active.requestKeys.length >= 50) throw new ServiceError('요청이 많아요. 진행 중인 작업을 확인해 주세요.', 'AI_BUSY')
        return tx.aiPreviewJob.update({ where: { id: active.id }, data: { requestKeys: { push: input.requestKey } } })
      }
      if (await tx.aiPreviewJob.count({ where: { userId: input.userId, status: { in: ['queued', 'processing'] }, expiresAt: { gt: now } } }) >= 3 ||
        await tx.aiPreviewJob.count({ where: { status: { in: ['queued', 'processing'] }, expiresAt: { gt: now } } }) >= 100) {
        throw new ServiceError('진행 중인 AI 작업이 많아요. 완료 후 다시 시도해 주세요.', 'AI_BUSY')
      }
      await lockWardrobeItemsForReference(tx, input.userId, input.selectedItemIds)
      const credit = await reservePreviewCredit(tx, input.userId, now)
      return tx.aiPreviewJob.create({ data: {
        ...credit,
        id: input.id, userId: input.userId, requestKeys: [input.requestKey], inputKey: input.inputKey,
        fingerprint: input.fingerprint, selectedItemIds: input.selectedItemIds, style: input.style,
        status: 'queued', leaseToken: null, leaseUntil: null, requestStartedAt: null,
        acknowledgedAt: null, expiresAt: new Date(now.getTime() + 86_400_000),
      } })
    })
  },
  /** 소유한 미만료 작업 한 건을 읽는다. 다른 사용자 또는 만료된 ID에는 null을 반환한다. */
  findOwned(userId: string, id: string) {
    return prisma.aiPreviewJob.findFirst({ where: { id, userId, expiresAt: { gt: new Date() } } })
  },
  /** 확인하지 않은 미만료 작업을 최신순으로 최대 10개 반환해 앱 재실행 시 상태 안내에 사용한다. */
  listOwned(userId: string) {
    return prisma.aiPreviewJob.findMany({ where: { userId, acknowledgedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 10 })
  },
  /** 소유한 완료·실패·중단 작업에 확인 시각만 기록한다. 진행 중 작업이나 이미지 자산은 변경하지 않는다. */
  acknowledge(userId: string, id: string) {
    return prisma.aiPreviewJob.updateMany({ where: { id, userId, status: { in: ['completed', 'failed', 'interrupted'] } }, data: { acknowledgedAt: new Date() } })
  },
  /** 대기 중 한 작업을 비교·갱신으로 가져온다. 다른 서버가 먼저 가져갔으면 null이다. */
  async claim() {
    const now = new Date()
    const job = await prisma.aiPreviewJob.findFirst({ where: { status: 'queued', expiresAt: { gt: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }, orderBy: { createdAt: 'asc' } })
    if (!job) return null
    const leaseToken = randomUUID()
    const claimed = await prisma.aiPreviewJob.updateMany({ where: { id: job.id, status: 'queued' }, data: { status: 'processing', leaseToken, leaseUntil: new Date(now.getTime() + PREVIEW_JOB_LEASE_MS), attempts: { increment: 1 } } })
    return claimed.count === 1 ? { ...job, status: 'processing' as const, leaseToken, attempts: job.attempts + 1 } : null
  },
  /** 처리 임대가 끊긴 작업을 최대 20개 찾는다. 재대기·중단·완료 판정은 복구 처리기가 수행한다. */
  expired() {
    return prisma.aiPreviewJob.findMany({ where: { status: 'processing', leaseUntil: { lte: new Date() } }, take: 20 })
  },
  /** 현재 토큰이 맡은 처리 중 작업의 임대를 90초 연장한다. 이미 완료되거나 다른 토큰으로 넘어간 작업은 변경하지 않는다. */
  renew(id: string, leaseToken: string) {
    return prisma.aiPreviewJob.updateMany({ where: { id, leaseToken, status: 'processing' }, data: { leaseUntil: new Date(Date.now() + PREVIEW_JOB_LEASE_MS) } })
  },
  /** 외부 이미지 API 전송 직전에 기록한다. 이 시점 뒤의 중단은 자동 재생성하지 않는다. */
  markRequestStarted(id: string, leaseToken: string) {
    return prisma.aiPreviewJob.updateMany({ where: { id, leaseToken, status: 'processing', leaseUntil: { gt: new Date() } }, data: { requestStartedAt: new Date() } })
  },
  /** 같은 처리 토큰에만 결과 자산을 연결하고 사용권을 정산한다. 작업 정리 기한과 생성 이미지의 영구 보관은 독립적이다. */
  complete(job: Pick<AiPreviewJob, 'id' | 'leaseToken'>, imageAssetId: string, model: string, expiredOnly = false, expiresAt?: Date) {
    return aiTransaction(async (tx) => {
      const current = await tx.aiPreviewJob.findUnique({ where: { id: job.id } })
      const result = await tx.aiPreviewJob.updateMany({ where: { id: job.id, leaseToken: job.leaseToken, status: 'processing', ...(expiredOnly ? { leaseUntil: { lte: new Date() } } : {}) }, data: { status: 'completed', imageAssetId, model, leaseUntil: null, errorCode: null, errorMessage: null, ...(expiresAt ? { expiresAt } : {}) } })
      if (result.count === 1 && current) await settlePreviewCredit(tx, current, true)
      return result
    })
  },
  /** 전송 전 중단이나 실행 자리 부족은 잠시 대기시킨다. 이미 전송한 요청에는 사용하지 않는다. */
  requeue(job: Pick<AiPreviewJob, 'id' | 'leaseToken'>, expiredOnly = false) {
    return prisma.aiPreviewJob.updateMany({ where: { id: job.id, leaseToken: job.leaseToken, status: 'processing', requestStartedAt: null, ...(expiredOnly ? { leaseUntil: { lte: new Date() } } : {}) }, data: { status: 'queued', leaseToken: null, leaseUntil: new Date(Date.now() + 3000) } })
  },
  /** 현재 처리 토큰의 작업에 실패·중단 사유를 기록한다. 자동 재전송하지 않으며 복구 시에는 만료 임대만 변경한다. */
  fail(job: Pick<AiPreviewJob, 'id' | 'leaseToken'>, status: 'failed' | 'interrupted', errorCode: string, errorMessage: string, expiredOnly = false) {
    return aiTransaction(async (tx) => {
      const current = await tx.aiPreviewJob.findUnique({ where: { id: job.id } })
      const result = await tx.aiPreviewJob.updateMany({ where: { id: job.id, leaseToken: job.leaseToken, status: 'processing', ...(expiredOnly ? { leaseUntil: { lte: new Date() } } : {}) }, data: { status, errorCode, errorMessage, leaseUntil: null } })
      if (result.count === 1 && current) await settlePreviewCredit(tx, current, false)
      return result
    })
  },
}
