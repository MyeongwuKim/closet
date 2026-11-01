/** 시간 충전되는 AI 사용권의 최대 보유량과 한 개가 충전되는 간격(ms). */
export const AI_CREDIT_CAPACITY = 5
export const AI_CREDIT_REFILL_MS = 60 * 60_000

export interface AiCreditWalletState {
  balance: number
  /** 마지막으로 반영한 충전 구간의 시작 시각. 최대 보유량이면 null로 타이머를 멈춘다. */
  refillStartedAt: Date | null
}

/**
 * 지나간 한 시간 구간마다 한 개씩 더하고 최대 5개까지만 반환한다. 입력 객체는 변경하지 않는다.
 * 가득 찬 동안의 시간은 저장하지 않는다. 잔액이 남아도 5개 미만이면 기존 충전 간격의 나머지 시간을 유지한다.
 */
export function getRefilledAiCreditWallet(wallet: AiCreditWalletState, now = new Date()) {
  const balance = Math.max(0, Math.min(AI_CREDIT_CAPACITY, wallet.balance))
  if (balance === AI_CREDIT_CAPACITY) return { balance, refillStartedAt: null, nextRefillAt: null }
  const startedAt = wallet.refillStartedAt ?? now
  const elapsed = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / AI_CREDIT_REFILL_MS))
  const nextBalance = Math.min(AI_CREDIT_CAPACITY, balance + elapsed)
  if (nextBalance === AI_CREDIT_CAPACITY) return { balance: nextBalance, refillStartedAt: null, nextRefillAt: null }
  const refillStartedAt = new Date(startedAt.getTime() + elapsed * AI_CREDIT_REFILL_MS)
  return { balance: nextBalance, refillStartedAt, nextRefillAt: new Date(refillStartedAt.getTime() + AI_CREDIT_REFILL_MS) }
}

/** 사용·실패 반환·광고 보상을 잔액에 반영한다. 최대 상태에서 처음 사용하면 그 시각부터 새 충전 구간을 시작한다. */
export function changeAiCreditWallet(wallet: AiCreditWalletState, delta: number, now = new Date()) {
  const current = getRefilledAiCreditWallet(wallet, now)
  const balance = Math.max(0, Math.min(AI_CREDIT_CAPACITY, current.balance + delta))
  return getRefilledAiCreditWallet({ balance, refillStartedAt: balance === AI_CREDIT_CAPACITY ? null : current.refillStartedAt ?? now }, now)
}
