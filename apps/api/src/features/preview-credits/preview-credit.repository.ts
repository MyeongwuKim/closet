import type { AiCreditKind } from '@closet/types'
import { randomUUID } from 'node:crypto'
import type { AiPreviewJob, Prisma } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { aiTransaction, touchAiMutex } from '../../lib/ai/ai-storage.js'
import { aiInputKey } from '../../lib/ai/ai-execution.js'
import { prisma } from '../../lib/prisma.js'
import { canRefillTestAiCredits, getPreviewCreditDay, getPreviewRewardConfig } from './preview-credit-policy.js'
import { AI_CREDIT_CAPACITY } from './ai-credit-wallet-policy.js'
import { changeAiCreditWalletBalance, readAiCreditWallet } from './ai-credit-wallet.repository.js'

/** 같은 사용자의 이용권 예약·광고 지급·반환을 트랜잭션 안에서 직렬화한다. */
export async function lockCredits(tx: Prisma.TransactionClient, userId: string) {
  await touchAiMutex(tx, `preview-credit:${userId}`, randomUUID(), new Date())
}

/** 추천·룩북 생성은 같은 지갑에서 1개를 예약한다. kind는 소진 오류의 종류만 구분하며 잔액을 분리하지 않는다. */
export async function reservePreviewCredit(tx: Prisma.TransactionClient, userId: string, now = new Date(), kind: AiCreditKind = 'preview') {
  await lockCredits(tx, userId)
  const wallet = await readAiCreditWallet(tx, userId, now)
  if (wallet.balance <= 0) throw new ServiceError('AI 사용권이 없어요. 충전을 기다리거나 광고를 보고 1개를 받아 주세요.', kind === 'recommendation' ? 'RECOMMENDATION_CREDITS_EXHAUSTED' : 'PREVIEW_CREDITS_EXHAUSTED')
  await changeAiCreditWalletBalance(tx, userId, -1, now)
  return { creditDayId: userId, creditSource: 'wallet', creditState: 'reserved' }
}

/** 종료 상태와 같은 트랜잭션에서 예약을 정산한다. 새 예약의 실패는 지갑에, 정책 전환 전 예약은 원래 날짜에 한 번만 반환한다. */
export async function settlePreviewCredit(tx: Prisma.TransactionClient, job: AiPreviewJob, succeeded: boolean) {
  if (job.creditState !== 'reserved' || !job.creditDayId) return
  await lockCredits(tx, job.userId)
  if (!succeeded && job.creditSource === 'wallet') await changeAiCreditWalletBalance(tx, job.userId, 1)
  else if (!succeeded) {
    const field = job.creditSource === 'free' ? 'freeUsed' : 'rewardUsed'
    await tx.previewCreditDay.updateMany({ where: { id: job.creditDayId, [field]: { gt: 0 } }, data: { [field]: { decrement: 1 } } })
  }
  await tx.aiPreviewJob.update({ where: { id: job.id }, data: { creditState: succeeded ? 'consumed' : 'released' } })
}

/** 시간 충전되는 공통 지갑과 광고 번호를 관리한다. Google 거래 번호를 확인해 같은 광고를 중복 지급하지 않는다. */
export const previewCreditRepository = {
  /** 테스트 충전도 기존 사용자 잠금과 지갑 상한을 사용해 잔액을 최대 5개로 채운다. */
  async refillForTest(userId: string) {
    await aiTransaction(async (tx) => {
      await lockCredits(tx, userId)
      await changeAiCreditWalletBalance(tx, userId, AI_CREDIT_CAPACITY)
    })
  },
  /** 추천·룩북 어디서 읽어도 같은 잔액을 반환한다. 조회 시 지나간 시간 충전을 반영하고 다음 충전 시각을 함께 전달한다. */
  async balance(userId: string, _kind: AiCreditKind = 'preview') {
    const now = new Date()
    const config = getPreviewRewardConfig()
    const wallet = await aiTransaction(async (tx) => {
      await lockCredits(tx, userId)
      return readAiCreditWallet(tx, userId, now)
    })
    const pending = config.mode === 'disabled' ? null : await prisma.previewRewardSession.findFirst({ where: { userId, mode: config.mode, adUnitId: config.adUnitId, status: 'pending', watchedAt: { not: null }, validUntil: { gt: now } }, orderBy: { createdAt: 'desc' } })
    return { freeRemaining: wallet.balance, rewardRemaining: 0, totalRemaining: wallet.balance, adRewardsRemaining: null,
      capacity: AI_CREDIT_CAPACITY, nextRefillAt: wallet.nextRefillAt?.toISOString() ?? null, serverNow: now.toISOString(), testRefillAvailable: canRefillTestAiCredits(),
      // 이전 클라이언트용 날짜 필드. 실제 시간 충전에는 nextRefillAt을 사용한다.
      resetsAt: getPreviewCreditDay(userId, now).resetsAt.toISOString(), rewardMode: config.mode, pendingRewardSessionId: pending?.id ?? null }
  },
  /** 지갑이 가득 차지 않았을 때 30분 유효한 광고 번호를 발급한다. 다른 기능에서 받은 미완료 번호도 같은 지갑의 보상으로 재사용한다. */
  async startReward(userId: string, kind: AiCreditKind = 'preview') {
    const config = getPreviewRewardConfig()
    if (config.mode === 'disabled') throw new ServiceError('광고 보상을 아직 준비 중이에요.', 'PREVIEW_REWARD_UNAVAILABLE')
    return aiTransaction(async (tx) => {
      await lockCredits(tx, userId)
      const now = new Date()
      const wallet = await readAiCreditWallet(tx, userId, now)
      if (wallet.balance >= AI_CREDIT_CAPACITY) throw new ServiceError('AI 사용권이 가득 차 있어요.', 'AI_CREDITS_FULL')
      const pending = await tx.previewRewardSession.findFirst({ where: { userId, mode: config.mode, adUnitId: config.adUnitId, status: 'pending', validUntil: { gt: now } }, orderBy: { createdAt: 'desc' } })
      if (pending) return pending
      return tx.previewRewardSession.create({ data: { id: randomUUID(), userId, creditKind: kind, ...config, validUntil: new Date(now.getTime() + 30 * 60_000), expiresAt: new Date(now.getTime() + 2 * 86_400_000) } })
    })
  },
  /** 로그인 사용자가 발급받은 번호만 읽는다. 다른 사용자의 광고 번호와 설정은 노출하지 않는다. */
  async rewardSession(userId: string, id: string) {
    const session = await prisma.previewRewardSession.findFirst({ where: { id, userId, expiresAt: { gt: new Date() } } })
    if (!session) throw new ServiceError('광고 보상 정보를 찾을 수 없어요.', 'PREVIEW_REWARD_NOT_FOUND')
    return session
  },
  /** 앱의 시청 완료를 기록해 다시 실행할 때 같은 보상을 확인한다. 이 기록만으로 운영 사용권을 지급하지 않는다. */
  async markWatched(userId: string, id: string) {
    await prisma.previewRewardSession.updateMany({ where: { id, userId, status: 'pending', validUntil: { gt: new Date() } }, data: { watchedAt: new Date() } })
    return previewCreditRepository.rewardSession(userId, id)
  },
  /** 검증한 광고는 공통 지갑에 1개를 한 번만 지급한다. 일일 상한 없이 최대 보유량 5개를 지키며 기존 충전 간격을 유지한다. */
  async grantReward(input: { sessionId: string; transactionId: string; mode: 'test' | 'production'; adUnitId: string; eventAt: Date }) {
    return aiTransaction(async (tx) => {
      const session = await tx.previewRewardSession.findUnique({ where: { id: input.sessionId } })
      if (!session || session.mode !== input.mode || session.adUnitId !== input.adUnitId) throw new ServiceError('광고 보상 요청이 올바르지 않아요.', 'INVALID_AD_REWARD')
      await lockCredits(tx, session.userId)
      const receiptId = aiInputKey(['admob', input.transactionId])
      const receipt = await tx.previewRewardReceipt.findUnique({ where: { id: receiptId } })
      if (receipt && receipt.sessionId !== session.id) throw new ServiceError('이미 처리한 광고 보상이에요.', 'INVALID_AD_REWARD')
      if (session.status === 'granted') return session
      if (input.eventAt.getTime() < session.createdAt.getTime() - 60_000 || input.eventAt > session.validUntil) throw new ServiceError('광고 보상 시간이 만료됐어요.', 'PREVIEW_REWARD_EXPIRED')
      const now = new Date()
      await tx.previewRewardReceipt.create({ data: { id: receiptId, sessionId: session.id, expiresAt: new Date(now.getTime() + 35 * 86_400_000) } })
      await changeAiCreditWalletBalance(tx, session.userId, 1, now)
      return tx.previewRewardSession.update({ where: { id: session.id }, data: { status: 'granted', rewardedAt: now } })
    })
  },
}
