import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { getRetryDelay, requestAiJson } from './ai-http.js'

test('Retry-After의 초·날짜·잘못된 값을 구분한다', () => {
  assert.equal(getRetryDelay('3'), 3000)
  assert.equal(getRetryDelay('Thu, 01 Jan 1970 00:00:02 GMT', 1000), 1000)
  assert.equal(getRetryDelay('invalid'), null)
  assert.equal(getRetryDelay(null), null)
  assert.equal(getRetryDelay('-1'), null)
})

test('일시적 429는 서버 대기 지침에 따라 한 번 재시도한다', async (t) => {
  t.mock.method(Math, 'random', () => 0)
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => ++calls === 1
    ? Response.json({ error: { code: 'rate_limit_exceeded' } }, { status: 429, headers: { 'retry-after': '0' } })
    : Response.json({ output_text: '완료' }))
  assert.deepEqual(await requestAiJson('https://api.openai.com/test', {}, { timeoutMs: 1000 }), { output_text: '완료' })
  assert.equal(calls, 2)
})

test('할당량 소진과 인증 실패는 재시도하지 않는다', async (t) => {
  for (const [status, code] of [[429, 'insufficient_quota'], [401, 'invalid_api_key']] as const) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { code } }, { status }))
    await assert.rejects(requestAiJson('https://api.openai.com/test', {}, { timeoutMs: 1000 }), {
      code: status === 429 ? 'AI_PROVIDER_RATE_LIMITED' : 'AI_UPSTREAM_ERROR',
    })
    assert.equal(fetch.mock.callCount(), 1)
    fetch.mock.restore()
  }
})

test('남은 처리 기한보다 Retry-After가 길면 일찍 재요청하지 않는다', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 503, headers: { 'retry-after': '120' } }))
  await assert.rejects(requestAiJson('https://api.openai.com/test', {}, { timeoutMs: 1000 }), { code: 'AI_UPSTREAM_ERROR' })
  assert.equal(fetch.mock.callCount(), 1)
})

test('본문을 읽는 동안 기한이 지나도 시간 초과로 처리한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true, status: 200, headers: new Headers(),
    json: async () => { await delay(20); return {} },
  }) as Response)
  await assert.rejects(requestAiJson('https://api.openai.com/test', {}, { timeoutMs: 5 }), { code: 'AI_TIMEOUT' })
})

test('응답이 유실된 네트워크 오류와 잘못된 성공 본문은 자동 재전송하지 않는다', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('연결 종료') })
  await assert.rejects(requestAiJson('https://api.openai.com/test', {}, { timeoutMs: 1000 }), /연결 종료/)
  assert.equal(fetch.mock.callCount(), 1)
  fetch.mock.restore()
  const invalid = t.mock.method(globalThis, 'fetch', async () => new Response('invalid'))
  await assert.rejects(requestAiJson('https://api.openai.com/test', {}, { timeoutMs: 1000 }), { code: 'AI_INVALID_RESPONSE' })
  assert.equal(invalid.mock.callCount(), 1)
})

test('완료되지 않은 Responses 결과는 텍스트가 있어도 성공 결과로 사용하지 않는다', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'incomplete', output_text: '{}' }))
  await assert.rejects(requestAiJson('https://api.openai.com/test', {}, { timeoutMs: 1000 }), { code: 'AI_INVALID_RESPONSE' })
  assert.equal(fetch.mock.callCount(), 1)
})
