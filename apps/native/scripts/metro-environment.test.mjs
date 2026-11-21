import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const config = require('../metro.config.js')
const publicEnvironmentPath = fileURLToPath(new URL('../config/publicEnvironment.cjs', import.meta.url))

test('개발용 환경 모듈은 Expo의 환경 파일 병합 대신 실행 시 주입된 공개 값을 사용한다', () => {
  const resolution = config.resolver.resolveRequest({}, 'expo/virtual/env', 'ios')
  assert.equal(resolution.type, 'sourceFile')
  assert.equal(resolution.filePath, publicEnvironmentPath)

  for (const apiUrl of ['http://localhost:4000', 'https://dev.example.com', 'https://api.example.com']) {
    const selectedEnvironment = { EXPO_PUBLIC_API_URL: apiUrl }
    const exports = {}
    runInNewContext(readFileSync(resolution.filePath, 'utf8'), { exports, process: { env: selectedEnvironment } })
    assert.equal(exports.env, selectedEnvironment)
    assert.equal(exports.env.EXPO_PUBLIC_API_URL, apiUrl)
  }
})

test('일반 모듈은 Metro의 기존 해석 경로를 유지한다', () => {
  const expected = { type: 'sourceFile', filePath: '/fixture/react.js' }
  const context = {
    resolveRequest(receivedContext, moduleName, platform) {
      assert.equal(receivedContext, context)
      assert.equal(moduleName, 'react')
      assert.equal(platform, 'ios')
      return expected
    },
  }
  assert.equal(config.resolver.resolveRequest(context, 'react', 'ios'), expected)
})

test('Xcode 빌드는 선택한 채널의 내장 웹 번들을 사용한다', () => {
  const previousIsolation = process.env.CLOSET_IOS_ISOLATED_WEB_BUNDLE
  const previousEnvironment = process.env.WEAROOM_APP_ENV
  process.env.CLOSET_IOS_ISOLATED_WEB_BUNDLE = '1'
  try {
    for (const channel of ['development', 'production']) {
      process.env.WEAROOM_APP_ENV = channel
      const resolution = config.resolver.resolveRequest({
        resolveRequest: (_context, filePath) => filePath,
      }, '../generated/webBundle', 'ios')
      assert.equal(resolution, fileURLToPath(new URL(`../.native-web-build/${channel}/webBundle.ts`, import.meta.url)))
    }
  } finally {
    if (previousIsolation === undefined) delete process.env.CLOSET_IOS_ISOLATED_WEB_BUNDLE
    else process.env.CLOSET_IOS_ISOLATED_WEB_BUNDLE = previousIsolation
    if (previousEnvironment === undefined) delete process.env.WEAROOM_APP_ENV
    else process.env.WEAROOM_APP_ENV = previousEnvironment
  }
})
