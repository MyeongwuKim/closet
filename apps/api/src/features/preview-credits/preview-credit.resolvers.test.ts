import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../../app.js'
import { previewCreditService } from './preview-credit.service.js'
import { previewCreditRepository } from './preview-credit.repository.js'
import { canRefillTestAiCredits } from './preview-credit-policy.js'
import { previewCreditResolvers } from './preview-credit.resolvers.js'
import type { GraphQLContext } from '../../graphql/context.js'

test('생성권 조회·광고 접수·로컬 보상도 로그인 없이 실행되지 않는다', async (t) => {
  const app = await buildApp()
  t.after(() => app.close())
  for (const query of ['query { previewCredits(kind: recommendation) { totalRemaining } }', 'mutation { startPreviewReward(kind: recommendation) { id } }', 'query { previewCredits { totalRemaining } }', 'query { previewRewardSession(id: "test-session") { id } }', 'mutation { startPreviewReward { id } }', 'mutation { markPreviewRewardWatched(id: "test-session") { id } }', 'mutation { completeTestPreviewReward(id: "test-session") { id } }', 'mutation { refillTestAiCredits { totalRemaining } }']) {
    const response = await app.inject({ method: 'POST', url: '/graphql', payload: { query } })
    assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  }
})

test('테스트 충전은 운영 모드에서 저장소 접근 전에 차단된다', async (t) => {
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  t.after(() => { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before })
  const refill = t.mock.method(previewCreditRepository, 'refillForTest', async () => {})
  assert.equal(canRefillTestAiCredits(), false)
  await assert.rejects(previewCreditService.refillForTest('user'), { code: 'TEST_CREDIT_REFILL_DISABLED' })
  assert.equal(refill.mock.callCount(), 0)
})

test('개발용 충전은 요청 인자가 아닌 로그인한 계정의 지갑만 변경한다', async (t) => {
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  t.after(() => { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before })
  const users: string[] = []
  t.mock.method(previewCreditRepository, 'refillForTest', async (userId: string) => { users.push(userId) })
  t.mock.method(previewCreditRepository, 'balance', async (userId: string) => {
    assert.equal(userId, 'current-user')
    return { freeRemaining: 5, rewardRemaining: 0, totalRemaining: 5, capacity: 5, nextRefillAt: null, serverNow: new Date().toISOString(), resetsAt: new Date().toISOString(), adRewardsRemaining: null, rewardMode: 'test' as const, pendingRewardSessionId: null, testRefillAvailable: true }
  })
  const context = { getViewer: async () => ({ id: 'current-user' }) } as GraphQLContext
  const result = await previewCreditResolvers.Mutation.refillTestAiCredits(null, { userId: 'other-user' }, context)
  assert.deepEqual(users, ['current-user'])
  assert.equal((result as { totalRemaining: number }).totalRemaining, 5)
})

test('테스트 보상은 운영 모드에서 DB 조회 전에 차단된다', async (t) => {
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  t.after(() => { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before })
  await assert.rejects(previewCreditService.completeTestReward('user', 'session-test'), { code: 'TEST_REWARD_DISABLED' })
})
