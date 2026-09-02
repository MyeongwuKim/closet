import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import ts from 'typescript'

async function importTypeScript(relativePath) {
  const sourceUrl = new URL(relativePath, import.meta.url)
  const source = await readFile(sourceUrl, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourceUrl.pathname,
  })
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  return import(moduleUrl)
}

const { captureCurrentLocation } = await importTypeScript(
  '../src/webview/bridge/locationCapture.ts',
)
const { CLOSET_WEBVIEW_BRIDGE_SCRIPT } = await importTypeScript(
  '../src/webview/bridge/injectedScript.ts',
)
const { parseNativeBridgeRequest } = await importTypeScript(
  '../src/webview/bridge/messageGuards.ts',
)

function createDependencies(overrides = {}) {
  return {
    hasServicesEnabled: async () => true,
    getPermission: async () => ({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    }),
    requestPermission: async () => ({
      granted: true,
      canAskAgain: true,
      status: 'granted',
    }),
    getLastKnownPosition: async () => null,
    getCurrentPosition: async () => ({
      coords: { latitude: 37.5665, longitude: 126.978, accuracy: 30 },
      timestamp: 1_725_252_000_000,
    }),
    ...overrides,
  }
}

test('위치 서비스가 꺼져 있으면 권한 요청 없이 상태를 반환한다', async () => {
  let permissionCheckCount = 0
  const result = await captureCurrentLocation(
    createDependencies({
      hasServicesEnabled: async () => false,
      getPermission: async () => {
        permissionCheckCount += 1
        return { granted: true, canAskAgain: true, status: 'granted' }
      },
    }),
  )

  assert.deepEqual(result, { status: 'services-disabled' })
  assert.equal(permissionCheckCount, 0)
})

test('결정되지 않은 위치 권한은 요청하고 거절 상태를 구분한다', async () => {
  const result = await captureCurrentLocation(
    createDependencies({
      getPermission: async () => ({
        granted: false,
        canAskAgain: true,
        status: 'undetermined',
      }),
      requestPermission: async () => ({
        granted: false,
        canAskAgain: false,
        status: 'denied',
      }),
    }),
  )

  assert.deepEqual(result, {
    status: 'permission-denied',
    canAskAgain: false,
  })
})

test('사용 가능한 최근 좌표를 새 위치 조회보다 먼저 사용한다', async () => {
  let currentPositionCount = 0
  const cached = {
    coords: { latitude: 37.57, longitude: 126.98, accuracy: 45 },
    timestamp: 1_725_252_000_000,
  }
  const result = await captureCurrentLocation(
    createDependencies({
      getLastKnownPosition: async () => cached,
      getCurrentPosition: async () => {
        currentPositionCount += 1
        return cached
      },
    }),
  )

  assert.equal(result.status, 'available')
  assert.equal(result.latitude, cached.coords.latitude)
  assert.equal(result.longitude, cached.coords.longitude)
  assert.equal(currentPositionCount, 0)
})

test('주입된 API가 검증 가능한 현재 위치 요청을 보내고 결과를 받는다', async () => {
  const messages = []
  const timers = new Map()
  let timerSequence = 0
  const context = createContext({
    window: {},
    DOMException,
    Date,
    setTimeout(callback) {
      timers.set(++timerSequence, callback)
      return timerSequence
    },
    clearTimeout(id) {
      timers.delete(id)
    },
  })
  context.window.ReactNativeWebView = {
    postMessage(raw) {
      messages.push(parseNativeBridgeRequest(raw))
    },
  }
  runInContext(CLOSET_WEBVIEW_BRIDGE_SCRIPT, context)

  const pending = context.window.ClosetNative.getCurrentLocation()
  const message = messages.at(-1)
  assert.equal(message.type, 'closet:native-current-location')
  assert.ok(message.id)

  context.window.__CLOSET_NATIVE_BRIDGE_RESPONSE__(message.id, {
    ok: true,
    data: {
      status: 'available',
      latitude: 37.5665,
      longitude: 126.978,
      accuracy: 30,
      timestamp: 1_725_252_000_000,
    },
  })

  assert.equal((await pending).status, 'available')
  assert.equal(timers.size, 0)
})
