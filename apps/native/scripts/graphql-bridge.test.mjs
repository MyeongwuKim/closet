import assert from 'node:assert/strict'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import {
  cancelNativeGraphqlRequest,
  handleNativeGraphqlRequest,
} from '../src/webview/bridge/graphqlBridge.ts'
import { createClosetWebViewBridgeScript } from '../src/webview/bridge/injectedScript.ts'
import { parseNativeBridgeRequest } from '../src/webview/bridge/messageGuards.ts'

function createBridge(beginPreviewSubmission, supportsWardrobeCutout = false) {
  const messages = []
  const inFlight = []
  const timers = new Map()
  let timerId = 0
  const context = createContext({
    window: {},
    DOMException,
    setTimeout(callback) {
      timers.set(++timerId, callback)
      return timerId
    },
    clearTimeout(id) { timers.delete(id) },
  })
  const webViewRef = {
    current: { injectJavaScript: (script) => runInContext(script, context) },
  }
  context.window.ReactNativeWebView = {
    postMessage(raw) {
      const message = parseNativeBridgeRequest(raw)
      messages.push(message)
      if (message?.type === 'closet:native-graphql') {
        inFlight.push(handleNativeGraphqlRequest(message, webViewRef, 'native-session-token', beginPreviewSubmission))
      } else if (message?.type === 'closet:native-cancel-graphql') {
        cancelNativeGraphqlRequest(message.id)
      }
    },
  }
  runInContext(createClosetWebViewBridgeScript(Boolean(beginPreviewSubmission), supportsWardrobeCutout), context)
  return { native: context.window.ClosetNative, context, messages, timers, inFlight }
}

test('지원 빌드만 옷 배경 제거를 노출하고 취소 뒤 늦은 응답을 무시한다', async () => {
  assert.equal(createBridge().native.removeWardrobePhotoBackground, undefined)
  const bridge = createBridge(undefined, true)
  const controller = new AbortController()
  const pending = bridge.native.removeWardrobePhotoBackground('dGVzdA==', controller.signal)
  const request = bridge.messages.at(-1)
  assert.equal(request.type, 'closet:native-wardrobe-cutout')
  assert.equal(request.imageBase64, 'dGVzdA==')
  assert.equal(bridge.timers.size, 1)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  bridge.context.window.__CLOSET_NATIVE_BRIDGE_RESPONSE__(request.id, { ok: true, data: { imageBase64: 'late' } })
  assert.equal(bridge.timers.size, 0)

  const next = bridge.native.removeWardrobePhotoBackground('dGVzdA==')
  bridge.context.window.__CLOSET_NATIVE_BRIDGE_RESPONSE__(bridge.messages.at(-1).id, { ok: true, data: { imageBase64: 'cutout' } })
  assert.equal((await next).imageBase64, 'cutout')
  assert.equal(bridge.timers.size, 0)
  assert.equal(parseNativeBridgeRequest(JSON.stringify({ ...request, imageBase64: 'file:///not-an-image' })), null)
})

const startPreview = 'mutation StartOutfitPreview($input: StartOutfitPreviewInput!) { startOutfitPreview(input: $input) { id } }'
const previewVariables = { input: { requestId: 'preview-request-1', selectedItemIds: ['top', 'bottom'] } }

test('룩북 접수 응답을 받을 때까지 iOS 백그라운드 실행 시간을 유지한다', async (t) => {
  const steps = []
  const bridge = createBridge(async () => {
    steps.push('begin')
    return async () => { steps.push('end') }
  })
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.deepEqual(steps, ['begin'])
    assert.deepEqual(JSON.parse(options.body), { query: startPreview, variables: previewVariables })
    steps.push('fetch')
    return Response.json({ data: { startOutfitPreview: { id: 'queued-job' } } })
  })

  const response = await bridge.native.requestPreviewStart(startPreview, previewVariables)
  await Promise.all(bridge.inFlight)
  assert.equal(response.payload.data.startOutfitPreview.id, 'queued-job')
  assert.deepEqual(steps, ['begin', 'fetch', 'end'])
  assert.equal(bridge.timers.size, 0)
})

test('룩북 접수 전에 웹이 취소하면 API 전송 없이 백그라운드 실행 시간을 반환한다', async (t) => {
  let grantTime
  const started = new Promise((resolve) => { grantTime = resolve })
  const release = t.mock.fn(async () => {})
  const bridge = createBridge(() => started)
  const send = t.mock.method(globalThis, 'fetch', async () => { throw new Error('요청을 보내면 안 됨') })
  const controller = new AbortController()
  const pending = bridge.native.requestPreviewStart(startPreview, previewVariables, controller.signal)
  controller.abort()
  grantTime(release)

  await assert.rejects(pending, { name: 'AbortError' })
  await Promise.all(bridge.inFlight)
  assert.equal(send.mock.callCount(), 0)
  assert.equal(release.mock.callCount(), 1)
  assert.equal(bridge.timers.size, 0)
})

test('WebView 요청을 고정된 API로 보내고 네이티브 세션과 조회 결과를 전달한다', async (t) => {
  let sent
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url, options }
    return Response.json({ data: { wardrobeItems: [{ id: 'saved-item' }] } })
  })
  const bridge = createBridge()
  const query = 'query WardrobeItems { wardrobeItems { id } }'
  const response = await bridge.native.requestGraphql(query, { category: 'top' })

  const baseUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '')
  assert.equal(sent.url, `${baseUrl}/graphql`)
  assert.equal(sent.options.headers.authorization, 'Bearer native-session-token')
  assert.deepEqual(JSON.parse(sent.options.body), { query, variables: { category: 'top' } })
  assert.equal(response.ok, true)
  assert.equal(response.payload.data.wardrobeItems[0].id, 'saved-item')
  assert.equal(bridge.timers.size, 0)
})

test('GraphQL 인증 오류와 HTTP 상태를 웹의 기존 오류 처리에 전달한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    errors: [{ message: '세션 만료', extensions: { code: 'UNAUTHENTICATED' } }],
  }, { status: 401 }))
  const bridge = createBridge()
  const response = await bridge.native.requestGraphql('query { me { id } }')

  assert.equal(response.ok, false)
  assert.equal(response.status, 401)
  assert.equal(response.payload.errors[0].extensions.code, 'UNAUTHENTICATED')
})

test('네트워크 실패를 빈 데이터로 바꾸지 않고 오류로 전달한다', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network unavailable') })
  const bridge = createBridge()
  await assert.rejects(bridge.native.requestGraphql('query { me { id } }'), /API 서버에 연결하지 못했어요/)
  assert.equal(bridge.timers.size, 0)
})

test('취소 신호와 시간 초과가 실제 네이티브 요청을 중단한다', async (t) => {
  for (const mode of ['abort', 'timeout']) {
    await t.test(mode, async (t) => {
      let nativeSignal
      t.mock.method(globalThis, 'fetch', (_url, { signal }) => {
        nativeSignal = signal
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
        })
      })
      const bridge = createBridge()
      const controller = new AbortController()
      const pending = bridge.native.requestGraphql('query { me { id } }', undefined, controller.signal)
      if (mode === 'abort') controller.abort()
      else bridge.timers.values().next().value()

      await assert.rejects(pending, mode === 'abort' ? { name: 'AbortError' } : /timed out/)
      assert.equal(nativeSignal.aborted, true)
      assert.equal(bridge.timers.size, 0)
      await Promise.all(bridge.inFlight)
    })
  }
})

test('이미 취소된 요청은 네이티브로 보내지 않는다', async () => {
  const bridge = createBridge()
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    bridge.native.requestGraphql('query { me { id } }', undefined, controller.signal),
    { name: 'AbortError' },
  )
  assert.equal(bridge.messages.filter((message) => message?.type === 'closet:native-graphql').length, 0)
})

test('잘못된 GraphQL 브리지 메시지를 거부한다', () => {
  const valid = { type: 'closet:native-graphql', id: 'request-1', query: 'query { me { id } }' }
  assert.deepEqual(parseNativeBridgeRequest(JSON.stringify(valid)), valid)
  for (const invalid of [
    { ...valid, id: '' },
    { ...valid, query: ' ' },
    { ...valid, query: 1 },
    { ...valid, variables: [] },
    { ...valid, variables: null },
    { ...valid, finishPreviewInBackground: true },
    { ...valid, query: startPreview, variables: previewVariables, finishPreviewInBackground: 'true' },
  ]) {
    assert.equal(parseNativeBridgeRequest(JSON.stringify(invalid)), null)
  }
})

test('기존 앱 정보 브리지도 응답 후 대기 상태를 정리한다', async () => {
  const bridge = createBridge()
  const pending = bridge.native.getAppInfo()
  const message = bridge.messages.at(-1)
  bridge.context.window.__CLOSET_NATIVE_BRIDGE_RESPONSE__(message.id, { ok: true, data: { platform: 'ios' } })
  assert.equal((await pending).platform, 'ios')
  assert.equal(bridge.timers.size, 0)
})
