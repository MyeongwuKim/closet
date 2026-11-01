import { changeAiCreditWalletBalance } from './ai-credit-wallet.repository.js'
import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { aiInputKey } from '../../lib/ai/ai-execution.js'
import { aiTransaction } from '../../lib/ai/ai-storage.js'
import { getPreviewCreditDay } from './preview-credit-policy.js'
import { lockCredits, reservePreviewCredit } from './preview-credit.repository.js'

const RESERVATION_MS = 4 * 60_000

/** 추천 실패·만료 시 사용권 1개를 지갑에 돌려준다. 이전 날짜별 예약은 원래 날짜의 잔액으로 반환한다. 호출자는 사용자 잠금과 상태 전환을 함께 수행한다. */
async function refund(tx: Prisma.TransactionClient, use: { userId: string; creditDayId: string; creditSource: string }) {
  if (use.creditSource === 'wallet') { await changeAiCreditWalletBalance(tx, use.userId, 1); return }
  const field = use.creditSource === 'free' ? 'freeUsed' : 'rewardUsed'
  await tx.previewCreditDay.updateMany({ where: { id: use.creditDayId, [field]: { gt: 0 } }, data: { [field]: { decrement: 1 } } })
}

/**
 * 추천 입력별 횟수 예약과 성공 결과를 보관한다. 같은 날 동일 입력은 저장한 설명을 재사용한다.
 * 처리 중 요청은 중복 실행하지 않으며, 서버 중단으로 4분이 지난 예약은 다음 추천 요청에서 반환한다.
 * items는 호출한 서비스가 현재 옷장 데이터에서 붙이므로 저장 결과에는 날짜 객체나 이미지 URL을 담지 않는다.
 */
export const recommendationCreditRepository = {
  /** 사용자별 예약을 직렬화하고 미완료 예약을 정리한다. 시간 충전·광고 보상으로 채운 지갑에서 1개를 예약한다. */
  async reserve(userId: string, input: unknown) {
    return aiTransaction(async (tx) => {
      await lockCredits(tx, userId)
      const now = new Date()
      const day = getPreviewCreditDay(userId, now, 'recommendation')
      const id = aiInputKey([day.id, input])
      const expired = await tx.recommendationCreditUse.findMany({ where: { userId, state: 'reserved', leaseUntil: { lte: now } } })
      for (const use of expired) {
        await refund(tx, use)
        await tx.recommendationCreditUse.update({ where: { id: use.id }, data: { state: 'released' } })
      }
      const existing = await tx.recommendationCreditUse.findUnique({ where: { id } })
      if (existing?.state === 'consumed' && existing.resultText !== null) return { id, token: existing.token, resultText: existing.resultText }
      if (existing?.state === 'reserved') throw new ServiceError('같은 코디를 추천하고 있어요. 잠시 후 다시 확인해 주세요.', 'AI_BUSY')
      const credit = await reservePreviewCredit(tx, userId, now, 'recommendation')
      const token = randomUUID()
      const data = { userId, creditDayId: credit.creditDayId, creditSource: credit.creditSource, token,
        state: 'reserved', resultText: null, leaseUntil: new Date(now.getTime() + RESERVATION_MS),
        expiresAt: new Date(day.resetsAt.getTime() + 35 * 86_400_000) }
      await tx.recommendationCreditUse.upsert({ where: { id }, create: { id, ...data }, update: data })
      return { id, token, resultText: null }
    })
  },

  /** 현재 예약 토큰에만 성공 결과를 저장하거나 횟수를 반환한다. 중복 완료·실패 보고는 이미 처리한 횟수를 바꾸지 않는다. */
  async settle(userId: string, id: string, token: string, resultText: string | null) {
    return aiTransaction(async (tx) => {
      await lockCredits(tx, userId)
      const use = await tx.recommendationCreditUse.findUnique({ where: { id } })
      if (!use || use.userId !== userId || use.token !== token || use.state !== 'reserved') return false
      const expired = use.leaseUntil <= new Date()
      if (resultText === null || expired) await refund(tx, use)
      await tx.recommendationCreditUse.update({ where: { id }, data: {
        state: resultText === null || expired ? 'released' : 'consumed', resultText: expired ? null : resultText,
      } })
      return !expired
    })
  },
}
