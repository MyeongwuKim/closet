import assert from 'node:assert/strict'
import test from 'node:test'
import { recommendationCreditRepository } from './recommendation-credit.repository.js'
import { withRecommendationCredit } from './recommendation-credit.service.js'

test('저장한 추천 설명은 연산과 추가 정산 없이 재사용한다', async (t) => {
  t.mock.method(recommendationCreditRepository, 'reserve', async () => ({ id: 'request', token: 'token', resultText: '{"headline":"저장한 추천"}' }))
  const settle = t.mock.method(recommendationCreditRepository, 'settle', async () => true)
  const result = await withRecommendationCredit('user', {}, async () => { throw new Error('실행되면 안 됨') })
  assert.deepEqual(result, { headline: '저장한 추천' })
  assert.equal(settle.mock.callCount(), 0)
})

test('추천 API 실패·기본 설명 대체 시 예약 횟수를 반환한다', async (t) => {
  t.mock.method(recommendationCreditRepository, 'reserve', async () => ({ id: 'request', token: 'token', resultText: null }))
  const settle = t.mock.method(recommendationCreditRepository, 'settle', async () => true)
  assert.equal(await withRecommendationCredit('user', {}, async () => null), null)
  assert.equal(settle.mock.calls[0]!.arguments[3], null)
  await assert.rejects(withRecommendationCredit('user', {}, async () => { throw new Error('실패') }), /실패/)
  assert.equal(settle.mock.calls[1]!.arguments[3], null)
})

test('예약이 만료되어 정산하지 못한 결과는 성공으로 반환하지 않는다', async (t) => {
  t.mock.method(recommendationCreditRepository, 'reserve', async () => ({ id: 'request', token: 'token', resultText: null }))
  t.mock.method(recommendationCreditRepository, 'settle', async () => false)
  await assert.rejects(withRecommendationCredit('user', {}, async () => ({ headline: '추천' })), { code: 'AI_INTERRUPTED' })
})

test('중복 요청은 처리 중인 추천 결과를 기다리고 AI를 다시 호출하지 않는다', async (t) => {
  const { ServiceError } = await import('../../graphql/errors.js')
  let calls = 0
  t.mock.method(recommendationCreditRepository, 'reserve', async () => {
    if (++calls === 1) throw new ServiceError('처리 중', 'AI_BUSY')
    return { id: 'request', token: 'token', resultText: '{"headline":"완료한 추천"}' }
  })
  assert.deepEqual(await withRecommendationCredit('user', {}, async () => { throw new Error('중복 호출') }), { headline: '완료한 추천' })
  assert.equal(calls, 2)
})
