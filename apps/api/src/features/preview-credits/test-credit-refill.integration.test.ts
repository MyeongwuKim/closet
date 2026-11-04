import assert from 'node:assert/strict'
import test from 'node:test'
import { prisma } from '../../lib/prisma.js'
import { ensureAiStorage } from '../../lib/ai/ai-storage.js'
import { previewCreditService } from './preview-credit.service.js'

test('테스트 DB에서 동시 충전은 5개 상한을 지키고 다른 계정과 광고 기록은 변경하지 않는다', { skip: !process.env.TEST_CREDIT_REFILL_INTEGRATION_DATABASE }, async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/closet_credit_refill_test_\d+$/)
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  t.after(async () => { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before; await prisma.$runCommandRaw({ dropDatabase: 1 }); await prisma.$disconnect() })
  await ensureAiStorage()
  const user = await prisma.user.create({ data: { displayName: '충전 테스트 계정' } })
  const other = await prisma.user.create({ data: { displayName: '다른 테스트 계정' } })
  await prisma.aiCreditWallet.create({ data: { userId: user.id, balance: 0, refillStartedAt: new Date() } })
  await prisma.aiCreditWallet.create({ data: { userId: other.id, balance: 2, refillStartedAt: new Date() } })
  const results = await Promise.all(Array.from({ length: 4 }, () => previewCreditService.refillForTest(user.id)))
  for (const result of results) {
    assert.equal(result.totalRemaining, 5)
    assert.equal(result.nextRefillAt, null)
    assert.equal(result.testRefillAvailable, true)
  }
  const stored = await prisma.aiCreditWallet.findUniqueOrThrow({ where: { userId: user.id } })
  assert.equal(stored.balance, 5)
  assert.equal(stored.refillStartedAt, null)
  assert.equal((await prisma.aiCreditWallet.findUniqueOrThrow({ where: { userId: other.id } })).balance, 2)
  assert.equal(await prisma.previewRewardSession.count(), 0)
  assert.equal(await prisma.previewRewardReceipt.count(), 0)
})
