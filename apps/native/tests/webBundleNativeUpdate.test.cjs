const assert = require('node:assert/strict')
const test = require('node:test')
const { load } = require('./webBundleHarness.cjs')
const compare = load('src/version/compareVersions.ts')

function harness({ enabled = true, channel = 'dev', platform = 'ios', version = '0.1.0', response, fail = false, cached = null } = {}) {
  let stored = cached && JSON.stringify(cached)
  return load('src/nativeUpdate/nativeUpdatePolicy.ts', {
    'expo-secure-store': { getItemAsync: async () => stored, setItemAsync: async (_, value) => { stored = value } },
    'react-native': { Platform: { OS: platform } },
    '../config/nativeUpdateConfig': { NATIVE_UPDATE_CONFIG: { checksEnabled: enabled, appVariant: channel, currentVersion: version, policyUrl: 'https://bundles.example.test/native/latest.json' } },
    '../version/compareVersions': compare,
  }, { fetch: async () => { if (fail) throw new Error('offline'); return { ok: true, json: async () => response } } })
}
const policy = {
  schemaVersion: 1, channel: 'dev',
  platforms: {
    ios: { enabled: true, minimumVersion: '0.1.1', storeUrl: 'https://apps.apple.com/app/id123' },
    android: { enabled: true, minimumVersion: '0.1.2', storeUrl: 'https://play.google.com/store/apps/details?id=test.app' },
  },
}

test('requires an update only below the enabled minimum for the current platform', async () => {
  const ios = await harness({ response: policy }).resolveNativeUpdateRequirement()
  assert.equal(ios.minimumVersion, '0.1.1')
  assert.equal(ios.storeUrl, policy.platforms.ios.storeUrl)
  assert.equal(await harness({ response: policy, version: '0.1.1' }).resolveNativeUpdateRequirement(), null)
  assert.equal((await harness({ response: policy, platform: 'android' }).resolveNativeUpdateRequirement()).minimumVersion, '0.1.2')
  assert.equal(await harness({ response: policy, enabled: false }).resolveNativeUpdateRequirement(), null)
})

test('wrong channel and non-store URLs cannot force an update', async () => {
  for (const response of [ { ...policy, channel: 'prod' }, { ...policy, platforms: { ...policy.platforms, ios: { ...policy.platforms.ios, storeUrl: 'https://example.test/phishing' } } } ]) {
    assert.equal(await harness({ response }).resolveNativeUpdateRequirement(), null)
  }
})

test('uses validated channel-specific cache offline, and a disabled policy permits entry', async () => {
  assert.equal((await harness({ fail: true, cached: policy }).resolveNativeUpdateRequirement()).minimumVersion, '0.1.1')
  assert.equal(await harness({ fail: true, cached: { ...policy, channel: 'prod' } }).resolveNativeUpdateRequirement(), null)
  const disabled = { ...policy, platforms: { ...policy.platforms, ios: { ...policy.platforms.ios, enabled: false, storeUrl: null } } }
  assert.equal(await harness({ response: disabled }).resolveNativeUpdateRequirement(), null)
})
