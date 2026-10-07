import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { getAppVariant } from '../config/appVariant.cjs'

const require = createRequire(import.meta.url)
const configureApp = require('../app.config.js')
const base = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo

test('웨어룸은 이름 끝의 식별자와 서로 다른 설치 식별자로 환경을 구분한다', () => {
  const development = getAppVariant('development')
  const local = getAppVariant('local')
  const production = getAppVariant('production')
  assert.equal(development.name, '웨어룸(T)')
  assert.equal(local.name, '웨어룸(L)')
  assert.equal(production.name, '웨어룸')
  assert.equal(new Set([development.identifier, local.identifier, production.identifier]).size, 3)
  assert.equal(new Set([development.scheme, local.scheme, production.scheme]).size, 3)
  assert.equal(getAppVariant().name, local.name)
  assert.throws(() => getAppVariant('typo'), /알 수 없는/)
})

test('Expo 설정은 iOS·Android·딥 링크를 함께 나누고 기존 EAS 연결을 보존한다', () => {
  const previous = process.env.WEAROOM_APP_ENV
  try {
    for (const environment of ['development', 'local', 'production']) {
      process.env.WEAROOM_APP_ENV = environment
      const variant = getAppVariant(environment)
      const config = configureApp({ config: base })
      assert.equal(config.name, variant.name)
      assert.equal(config.ios.bundleIdentifier, variant.identifier)
      assert.equal(config.android.package, variant.identifier)
      assert.equal(config.scheme, variant.scheme)
      assert.equal(config.extra.appEnvironment, environment)
      assert.equal(config.extra.eas.projectId, base.extra.eas.projectId)
    }
  } finally {
    if (previous === undefined) delete process.env.WEAROOM_APP_ENV
    else process.env.WEAROOM_APP_ENV = previous
  }
})
