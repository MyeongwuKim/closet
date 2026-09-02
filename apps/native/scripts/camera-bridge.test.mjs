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

const { captureWardrobePhoto } = await importTypeScript(
  '../src/webview/bridge/cameraCapture.ts',
)
const { CLOSET_WEBVIEW_BRIDGE_SCRIPT } = await importTypeScript(
  '../src/webview/bridge/injectedScript.ts',
)
const { parseNativeBridgeRequest } = await importTypeScript(
  '../src/webview/bridge/messageGuards.ts',
)

test('카메라 권한은 촬영 요청 안에서 확인하고 거부 시 카메라를 열지 않는다', async () => {
  let launchCount = 0
  const result = await captureWardrobePhoto({
    requestPermission: async () => ({ granted: false, canAskAgain: false }),
    launch: async () => {
      launchCount += 1
      return { canceled: true, assets: null }
    },
  })

  assert.deepEqual(result, {
    status: 'permission-denied',
    canAskAgain: false,
  })
  assert.equal(launchCount, 0)
})

test('사용자가 카메라를 닫으면 취소 결과를 반환한다', async () => {
  const result = await captureWardrobePhoto({
    requestPermission: async () => ({ granted: true, canAskAgain: true }),
    launch: async () => ({ canceled: true, assets: null }),
  })

  assert.deepEqual(result, { status: 'cancelled' })
})

test('촬영 결과를 WebView가 복원할 수 있는 JPEG 데이터로 정규화한다', async () => {
  let normalizedSource
  const result = await captureWardrobePhoto({
    requestPermission: async () => ({ granted: true, canAskAgain: true }),
    launch: async () => ({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/IMG_1234.HEIC',
          fileName: 'IMG_1234.HEIC',
          width: 3024,
          height: 4032,
        },
      ],
    }),
    normalize: async (asset) => {
      normalizedSource = asset
      return {
        base64: 'captured-image',
        fileSize: 1234,
        width: 1536,
        height: 2048,
      }
    },
  })

  assert.equal(normalizedSource.uri, 'file:///cache/IMG_1234.HEIC')
  assert.deepEqual(result, {
    status: 'captured',
    asset: {
      base64: 'captured-image',
      mimeType: 'image/jpeg',
      fileName: 'IMG_1234.jpg',
      fileSize: 1234,
      width: 1536,
      height: 2048,
    },
  })
})

test('비정상 촬영 결과와 Expo 예외를 일반 취소와 구분한다', async (t) => {
  await t.test('base64 누락', async () => {
    const result = await captureWardrobePhoto({
      requestPermission: async () => ({ granted: true, canAskAgain: true }),
      launch: async () => ({
        canceled: false,
        assets: [{ uri: 'file:///cache/photo.jpg', width: 1, height: 1 }],
      }),
      normalize: async () => ({ width: 1, height: 1 }),
    })

    assert.equal(result.status, 'error')
    assert.equal(result.code, 'CAMERA_CAPTURE_INVALID_RESULT')
  })

  await t.test('Expo 호출 실패', async () => {
    const result = await captureWardrobePhoto({
      requestPermission: async () => ({ granted: true, canAskAgain: true }),
      launch: async () => {
        throw Object.assign(new Error('카메라를 열 수 없음'), {
          code: 'ERR_CAMERA_UNAVAILABLE',
        })
      },
    })

    assert.deepEqual(result, {
      status: 'error',
      code: 'ERR_CAMERA_UNAVAILABLE',
      message: '카메라를 열 수 없음',
    })
  })
})

test('주입된 API가 검증 가능한 카메라 요청을 보내고 상태 결과를 받는다', async () => {
  const messages = []
  const timers = new Map()
  let timerSequence = 0
  const context = createContext({
    window: {},
    DOMException,
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

  const pending = context.window.ClosetNative.captureWardrobePhoto()
  const message = messages.at(-1)
  assert.equal(message.type, 'closet:native-capture-wardrobe-photo')
  assert.ok(message.id)

  context.window.__CLOSET_NATIVE_BRIDGE_RESPONSE__(message.id, {
    ok: true,
    data: { status: 'cancelled' },
  })

  assert.equal((await pending).status, 'cancelled')
  assert.equal(timers.size, 0)
  assert.equal(
    parseNativeBridgeRequest(
      JSON.stringify({
        type: 'closet:native-capture-wardrobe-photo',
        id: '',
      }),
    ),
    null,
  )
})
