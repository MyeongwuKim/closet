import type { Prisma } from '@prisma/client'
import { AI_CREDIT_CAPACITY, changeAiCreditWallet, getRefilledAiCreditWallet } from './ai-credit-wallet-policy.js'

/**
 * 저장한 잔액에 서버 시각까지 지난 충전을 반영한다. 최초 조회는 5개로 시작한다.
 * 이 함수와 changeAiCreditWalletBalance는 호출자가 같은 사용자의 이용권 잠금을 가진 트랜잭션 안에서 사용한다.
 */
export async function readAiCreditWallet(tx: Prisma.TransactionClient, userId: string, now = new Date()) {
  const row = await tx.aiCreditWallet.upsert({ where: { userId }, update: {}, create: { userId, balance: AI_CREDIT_CAPACITY } })
  const wallet = getRefilledAiCreditWallet(row, now)
  if (wallet.balance !== row.balance || wallet.refillStartedAt?.getTime() !== row.refillStartedAt?.getTime()) {
    await tx.aiCreditWallet.update({ where: { userId }, data: { balance: wallet.balance, refillStartedAt: wallet.refillStartedAt } })
  }
  return wallet
}

/** 예약(-1), 실패 반환·광고 보상(+1)을 반영한다. 충전을 먼저 계산하고 최대 5개에서 멈추며 원래 충전 간격을 유지한다. */
export async function changeAiCreditWalletBalance(tx: Prisma.TransactionClient, userId: string, delta: number, now = new Date()) {
  const current = await readAiCreditWallet(tx, userId, now)
  const wallet = changeAiCreditWallet(current, delta, now)
  await tx.aiCreditWallet.update({ where: { userId }, data: { balance: wallet.balance, refillStartedAt: wallet.refillStartedAt } })
  return wallet
}
