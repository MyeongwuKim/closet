const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const test = require('node:test')
const { load } = require('./webBundleHarness.cjs')
const { getAppVariant } = require('../config/appVariant.cjs')
const runtime = require('../../../config/web-bundle-runtime.json')

function configure(environment, baseUrl, platform = 'ios') {
  const module = { exports: {} }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.config.js'), 'utf8'), {
    module, URL,
    process: { env: { WEAROOM_APP_ENV: environment, EXPO_PUBLIC_WEB_BUNDLE_BASE_URL: baseUrl, CLOSET_BUILD_PLATFORM: platform } },
    require(name) {
      if (name === './config/appVariant.cjs') return { getAppVariant }
      if (name === '../../config/web-bundle-runtime.json') return runtime
      if (name === './app-versions.json') return { dev: { ios: '0.1.1', android: '0.1.2' }, prod: { ios: '0.1.3', android: '0.1.4' } }
      throw new Error(name)
    },
  })
  return module.exports({ config: {} })
}

test('selected environment defines only its runtime URL and per-platform native version', () => {
  for (const [environment, prefix, version] of [['local', '', '0.1.1'], ['development', '', '0.1.1'], ['production', 'runtime/v1/', '0.1.3']]) {
    const config = configure(environment, 'https://selected.example.test/')
    assert.equal(config.extra.webBundleManifestUrl, `https://selected.example.test/${prefix}latest/manifest.json`)
    assert.equal(config.extra.nativeUpdatePolicyUrl, 'https://selected.example.test/native/latest.json')
    assert.equal(config.extra.webBundleUpdatesEnabled, environment !== 'local')
    assert.equal(config.version, version)
    const resolved = load('src/config/webBundleUpdateConfig.ts', {
      'expo-constants': { expoConfig: config },
      'expo-application': { nativeApplicationVersion: '0.1.9' },
    }).WEB_BUNDLE_UPDATE_CONFIG
    assert.equal(resolved.nativeVersion, '0.1.9')
    assert.equal(resolved.channel, environment === 'production' ? 'prod' : 'dev')
    assert.equal(resolved.updatesEnabled, environment !== 'local')
  }
  assert.equal(configure('production', 'https://prod.example.test', 'android').version, '0.1.4')
})

test('remote app config fails on a missing or non-HTTPS URL; local needs no R2', () => {
  assert.throws(() => configure('production', ''), /EXPO_PUBLIC_WEB_BUNDLE_BASE_URL/)
  assert.throws(() => configure('development', 'http://localhost:4000'), /HTTPS/)
  assert.equal(configure('local', '').extra.webBundleUpdatesEnabled, false)
})
