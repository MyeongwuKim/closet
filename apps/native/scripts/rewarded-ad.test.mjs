import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import ts from 'typescript'

async function importTypeScript(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}
const { presentRewardedAd } = await importTypeScript('../src/ads/presentRewardedAd.ts')
const { CLOSET_WEBVIEW_BRIDGE_SCRIPT } = await importTypeScript('../src/webview/bridge/injectedScript.ts')
const { parseNativeBridgeRequest } = await importTypeScript('../src/webview/bridge/messageGuards.ts')

function driver() {
  const listeners = new Map()
  let showCount = 0
  const subscribe = (name) => (callback) => { listeners.set(name, callback); return () => listeners.delete(name) }
  return { listeners, get showCount() { return showCount },
    ad: { onLoaded: subscribe('loaded'), onEarned: subscribe('earned'), onClosed: subscribe('closed'), onError: subscribe('error'), load() {}, async show() { showCount += 1 } },
  }
}

test('광고는 로드 후 한 번 표시하고 보상 이벤트 뒤 닫혀야 earned를 반환한다', async () => {
  const fixture = driver()
  const result = presentRewardedAd(fixture.ad)
  fixture.listeners.get('loaded')()
  fixture.listeners.get('loaded')()
  fixture.listeners.get('earned')()
  fixture.listeners.get('closed')()
  assert.deepEqual(await result, { status: 'earned' })
  assert.equal(fixture.showCount, 1)
  assert.equal(fixture.listeners.size, 0)
})

test('중간 종료·광고 오류·로드 시간 초과에는 보상 성공을 반환하지 않는다', async () => {
  for (const event of ['closed', 'error', 'timeout']) {
    const fixture = driver()
    const result = presentRewardedAd(fixture.ad, { loadTimeoutMs: 5, totalTimeoutMs: 50 })
    if (event !== 'timeout') fixture.listeners.get(event)()
    assert.equal((await result).status, event === 'closed' ? 'cancelled' : 'unavailable')
    assert.equal(fixture.listeners.size, 0)
    assert.equal(fixture.showCount, 0)
  }
})

test('네이티브 표시 실패도 리스너를 정리하고 생성권 성공으로 보고하지 않는다', async () => {
  const fixture = driver()
  fixture.ad.show = async () => { throw new Error('not available') }
  const result = presentRewardedAd(fixture.ad)
  fixture.listeners.get('loaded')()
  assert.equal((await result).status, 'unavailable')
  assert.equal(fixture.listeners.size, 0)
})

test('광고 브리지는 서버 세션 번호를 전달하고 네이티브 응답으로 완료된다', async () => {
  const sent = []
  const window = { ReactNativeWebView: { postMessage: (message) => sent.push(JSON.parse(message)) } }
  const context = createContext({ window, setTimeout: () => 1, clearTimeout() {} })
  runInContext(CLOSET_WEBVIEW_BRIDGE_SCRIPT, context)
  const result = window.ClosetNative.showRewardedAd('session-test-123')
  const request = sent.at(-1)
  assert.equal(request.type, 'closet:native-rewarded-ad')
  assert.equal(request.sessionId, 'session-test-123')
  assert.equal(parseNativeBridgeRequest(JSON.stringify(request)).sessionId, request.sessionId)
  assert.equal(parseNativeBridgeRequest(JSON.stringify({ ...request, sessionId: 'https://untrusted.test/' })), null)
  window.__CLOSET_NATIVE_BRIDGE_RESPONSE__(request.id, { ok: true, data: { status: 'earned' } })
  assert.equal((await result).status, 'earned')
  assert.equal(typeof window.ClosetNative.openAdPrivacyOptions, 'function')
})

/** 네이티브 런타임처럼 AbortSignal.timeout을 제공하지 않고 실제 광고 브리지의 요청·정리 흐름을 실행한다. */
async function rewardedBridgeFixture({ request } = {}) {
  const source = await readFile(new URL('../src/webview/bridge/rewardedAdBridge.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const timers = new Map()
  const calls = []
  const replies = []
  let adCalls = 0
  let sequence = 0
  const session = { id: 'reward-session-native', mode: 'test', adUnitId: 'test-unit', status: 'pending', watchedAt: null, validUntil: new Date(Date.now() + 60_000).toISOString() }
  const context = createContext({
    exports: {}, Error, AbortController, AbortSignal: {},
    setTimeout(callback, ms) { assert.equal(ms, 15_000); const id = ++sequence; timers.set(id, callback); return id },
    clearTimeout(id) { timers.delete(id) },
    require(name) {
      if (name === '../../api/nativeGraphql') return { fetchNativeGraphql: async (query, variables, token, signal) => {
        assert.equal(variables.id, session.id)
        assert.equal(token, 'test-access-token')
        assert.ok(signal instanceof AbortSignal)
        calls.push({ query, signal })
        if (request) return request(query, signal)
        return { ok: true, json: async () => ({ data: { session: { ...session, status: query.includes('CompleteTest') ? 'granted' : 'pending' } } }) }
      } }
      if (name === '../../ads/rewardedAds') return {
        showPreviewRewardedAd: async () => { adCalls++; return { status: 'earned' } }, showAdPrivacyOptions: async () => {},
      }
      if (name === './responses') return { postNativeBridgeResponse: (_ref, id, response) => replies.push({ id, response }) }
      throw new Error(`Unexpected import: ${name}`)
    },
  })
  runInContext(outputText, context)
  return { timers, calls, replies, get adCalls() { return adCalls },
    run: () => context.exports.handleNativeRewardedAd({ id: 'bridge-request', sessionId: session.id }, {}, 'test-access-token'),
  }
}

test('AbortSignal.timeout이 없는 앱에서도 세션 조회 후 광고 표시·테스트 보상 완료가 연결된다', async () => {
  const fixture = await rewardedBridgeFixture()
  await fixture.run()
  assert.equal(fixture.adCalls, 1)
  assert.equal(fixture.calls.length, 3)
  assert.match(fixture.calls[0].query, /query PreviewRewardSession/)
  assert.match(fixture.calls[1].query, /mutation MarkPreviewRewardWatched/)
  assert.match(fixture.calls[2].query, /mutation CompleteTestPreviewReward/)
  assert.equal(fixture.replies[0].response.ok, true)
  assert.equal(fixture.replies[0].response.data.status, 'earned')
  assert.equal(fixture.timers.size, 0)
  assert.ok(fixture.calls.every(({ signal }) => !signal.aborted))
})

test('광고 세션 조회가 지연되면 요청을 중단하고 광고·보상 지급을 실행하지 않는다', async () => {
  const fixture = await rewardedBridgeFixture({ request: (_query, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  }) })
  const work = fixture.run()
  assert.equal(fixture.timers.size, 1)
  fixture.timers.values().next().value()
  await work
  assert.equal(fixture.adCalls, 0)
  assert.equal(fixture.calls.length, 1)
  assert.equal(fixture.calls[0].signal.aborted, true)
  assert.equal(fixture.replies[0].response.ok, false)
  assert.match(fixture.replies[0].response.error, /확인이 지연되고 있어요/)
  assert.equal(fixture.timers.size, 0)
})

test('광고 보상 보고가 실패해도 예약 타이머를 남기거나 지급 성공을 반환하지 않는다', async () => {
  const fixture = await rewardedBridgeFixture({ request: async (query) => {
    if (query.includes('mutation')) throw new Error('보상 서버 연결 실패')
    return { ok: true, json: async () => ({ data: { session: { id: 'reward-session-native', mode: 'test', adUnitId: 'test-unit', status: 'pending', watchedAt: null } } }) }
  } })
  await fixture.run()
  assert.equal(fixture.adCalls, 1)
  assert.equal(fixture.calls.length, 2)
  assert.equal(fixture.replies[0].response.ok, false)
  assert.equal(fixture.replies[0].response.error, '보상 서버 연결 실패')
  assert.equal(fixture.timers.size, 0)
})
