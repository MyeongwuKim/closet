import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../../app.js'
import { previewCreditService } from './preview-credit.service.js'

test('생성권 조회·광고 접수·로컬 보상도 로그인 없이 실행되지 않는다', async (t) => {
  const app = await buildApp()
  t.after(() => app.close())
  for (const query of ['query { previewCredits(kind: recommendation) { totalRemaining } }', 'mutation { startPreviewReward(kind: recommendation) { id } }', 'query { previewCredits { totalRemaining } }', 'query { previewRewardSession(id: "test-session") { id } }', 'mutation { startPreviewReward { id } }', 'mutation { markPreviewRewardWatched(id: "test-session") { id } }', 'mutation { completeTestPreviewReward(id: "test-session") { id } }']) {
    const response = await app.inject({ method: 'POST', url: '/graphql', payload: { query } })
    assert.equal(response.json().errors?.[0]?.extensions?.code, 'UNAUTHENTICATED')
  }
})

test('테스트 보상은 운영 모드에서 DB 조회 전에 차단된다', async (t) => {
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  t.after(() => { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before })
  await assert.rejects(previewCreditService.completeTestReward('user', 'session-test'), { code: 'TEST_REWARD_DISABLED' })
})
