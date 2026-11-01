import assert from 'node:assert/strict'
import test from 'node:test'
import { AI_CREDIT_REFILL_MS, changeAiCreditWallet, getRefilledAiCreditWallet } from './ai-credit-wallet-policy.js'

const start = new Date('2026-11-01T14:30:00Z')
const after = (minutes: number) => new Date(start.getTime() + minutes * 60_000)

test('5개 보유 시 충전을 멈추고 처음 사용한 시점부터 한 시간 뒤 충전한다', () => {
  const full = getRefilledAiCreditWallet({ balance: 5, refillStartedAt: null }, start)
  assert.equal(full.nextRefillAt, null)
  const used = changeAiCreditWallet(full, -1, start)
  assert.equal(used.balance, 4)
  assert.equal(used.nextRefillAt!.getTime(), start.getTime() + AI_CREDIT_REFILL_MS)
  assert.equal(getRefilledAiCreditWallet(used, after(59)).balance, 4)
  assert.equal(getRefilledAiCreditWallet(used, after(60)).balance, 5)
})

test('앱이 꺼진 동안 지난 충전 시간을 한 번에 반영하고 남은 충전 시간을 보존한다', () => {
  const wallet = { balance: 0, refillStartedAt: start }
  const refilled = getRefilledAiCreditWallet(wallet, after(150))
  assert.equal(refilled.balance, 2)
  assert.equal(refilled.nextRefillAt!.getTime(), after(180).getTime())
  assert.equal(changeAiCreditWallet(refilled, -1, after(160)).nextRefillAt!.getTime(), after(180).getTime())
  assert.equal(wallet.balance, 0)
})

test('자정에 추가 지급하지 않고 최대치에서 보낸 시간은 다음 사용 시 이월하지 않는다', () => {
  const empty = { balance: 0, refillStartedAt: start }
  assert.equal(getRefilledAiCreditWallet(empty, after(30)).balance, 0)
  const full = getRefilledAiCreditWallet(empty, after(600))
  assert.equal(full.balance, 5)
  assert.equal(changeAiCreditWallet(full, -1, after(601)).nextRefillAt!.getTime(), after(661).getTime())
})

test('광고 보상과 실패 반환도 최대 5개를 넘지 않고 남은 충전 간격을 유지한다', () => {
  const wallet = { balance: 0, refillStartedAt: start }
  const rewarded = changeAiCreditWallet(wallet, 1, after(30))
  assert.equal(rewarded.balance, 1)
  assert.equal(rewarded.nextRefillAt!.getTime(), after(60).getTime())
  const full = changeAiCreditWallet({ balance: 4, refillStartedAt: start }, 1, after(30))
  assert.equal(full.balance, 5)
  assert.equal(full.nextRefillAt, null)
  assert.equal(changeAiCreditWallet(full, 1, after(30)).balance, 5)
})
