const assert = require('node:assert/strict')
const test = require('node:test')
const { createHash } = require('node:crypto')
const { load } = require('./webBundleHarness.cjs')
const { zipSync, strToU8 } = require('fflate')
const compare = load('src/version/compareVersions.ts')
const checker = load('src/webBundle/webBundleVersionChecker.ts', { '../version/compareVersions': compare })
const errors = load('src/webBundle/webBundleErrors.ts')
const config = { channel: 'dev', runtimePrefix: '', updatesEnabled: true, nativeVersion: '0.1.0', requiresMinimumNativeVersion: true, publicOrigin: 'https://bundles.example.test', manifestUrl: 'https://bundles.example.test/latest/manifest.json' }
const manifest = { version: '0.1.1', minimumNativeVersion: '0.1.0', channel: 'dev', bundleUrl: 'https://bundles.example.test/releases/0.1.1/web-ui.zip', entryPath: 'index.html', entryUrl: null, readySignalRequired: true }

function loader({ update = manifest, active = null, enabled = true, installError = false, failedVersions = [] } = {}) {
  let installs = 0
  const module = load('src/webBundle/webBundleLoader.ts', {
    'expo-file-system': { File: class { async text() { return '<html>verified</html>' } } },
    'react-native': { Platform: { OS: 'ios' } },
    '../config/webBundleUpdateConfig': { WEB_BUNDLE_UPDATE_CONFIG: { ...config, updatesEnabled: enabled } },
    '../generated/webBundle': { WEB_BUNDLE_HTML: '<html>embedded</html>', WEB_BUNDLE_BASE_URL: 'https://closet.native/' },
    './webBundleManifest': { fetchWebBundleManifest: async () => update },
    './webBundleStorage': {
      prepareWebBundleStorage: async () => ({ active, failedVersions }),
      installWebBundle: async value => { installs++; if (installError) throw new Error('hash mismatch'); return { ...value, entryUri: 'file:///verified/index.html', pending: true } },
      rollbackWebBundle: async () => active,
      confirmWebBundleReady: async () => {},
    },
    './webBundleVersionChecker': checker,
  })
  return { ...module, installs: () => installs }
}

test('local uses embedded without fetching or installing', async () => {
  const h = loader({ enabled: false })
  assert.equal((await h.resolveWebBundle()).kind, 'embedded')
  assert.equal(h.installs(), 0)
})

test('rejects wrong channel, incompatible native version, future series and failed versions', async () => {
  for (const update of [ { ...manifest, channel: 'prod' }, { ...manifest, minimumNativeVersion: '0.1.2' }, { ...manifest, version: '0.2.0' }, { ...manifest, minimumNativeVersion: null } ]) {
    const h = loader({ update })
    assert.equal((await h.resolveWebBundle()).kind, 'embedded')
    assert.equal(h.installs(), 0)
  }
  const h = loader({ failedVersions: ['0.1.1'] })
  assert.equal((await h.resolveWebBundle()).kind, 'embedded')
})

test('installs only a newer verified release; concurrent callers share one installation', async () => {
  const h = loader()
  const [a, b] = await Promise.all([h.resolveWebBundle(), h.resolveWebBundle()])
  assert.equal(a.source.html, '<html>verified</html>')
  assert.equal(a, b)
  assert.equal(h.installs(), 1)
  for (const version of ['0.1.1', '0.1.2']) {
    const cached = loader({ active: { ...manifest, version } })
    assert.equal((await cached.resolveWebBundle()).version, version)
    assert.equal(cached.installs(), 0)
  }
})

test('download/verification failure keeps cached bundle and never opens remote HTML', async () => {
  const active = { ...manifest, version: '0.1.0' }
  const h = loader({ active, installError: true })
  const resolved = await h.resolveWebBundle()
  assert.equal(resolved.version, '0.1.0')
  assert.ok(resolved.source.html)
  assert.equal(resolved.source.uri, undefined)
  assert.equal((await h.rollbackResolvedWebBundle({ ...resolved, version: '0.1.1' })).version, '0.1.0')
})

test('rejects a ZIP from a different origin before downloading', async () => {
  const h = loader({ update: { ...manifest, bundleUrl: 'https://other.example.test/file.zip' } })
  assert.equal((await h.resolveWebBundle()).kind, 'embedded')
  assert.equal(h.installs(), 0)
})

function storageHarness({ wrongHash = false, unsafe = false } = {}) {
  const files = new Map()
  const dirs = new Set(['file:///documents', 'file:///cache'])
  const uri = (...args) => args.map(x => typeof x === 'string' ? x : x.uri).join('/').replace(/([^:])\/{2,}/g, '$1/').replace(/\/$/, '')
  class Directory {
    constructor(...args) { this.uri = uri(...args) }
    get exists() { return dirs.has(this.uri) }
    create() { dirs.add(this.uri) }
    delete() { for (const key of [...files.keys()]) if (key.startsWith(this.uri + '/')) files.delete(key); dirs.delete(this.uri) }
    rename(name) {
      const next = this.uri.slice(0, this.uri.lastIndexOf('/') + 1) + name
      for (const [key, value] of [...files]) if (key.startsWith(this.uri + '/')) { files.set(next + key.slice(this.uri.length), value); files.delete(key) }
      dirs.delete(this.uri); dirs.add(next); this.uri = next
    }
    list() { return [...dirs].filter(x => x.startsWith(this.uri + '/') && !x.slice(this.uri.length + 1).includes('/')).map(x => new Directory(x)) }
  }
  class File {
    constructor(...args) { this.uri = uri(...args) }
    get exists() { return files.has(this.uri) }
    get size() { return files.get(this.uri)?.byteLength ?? 0 }
    create() { files.set(this.uri, new Uint8Array()) }
    write(bytes) { files.set(this.uri, typeof bytes === 'string' ? Buffer.from(bytes) : bytes) }
    async text() { return Buffer.from(files.get(this.uri)).toString() }
    async bytes() { return files.get(this.uri) }
    delete() { files.delete(this.uri) }
    move(destination) { files.set(destination.uri, files.get(this.uri)); files.delete(this.uri); this.uri = destination.uri }
  }
  const bytes = zipSync({ [unsafe ? '../escape.html' : 'index.html']: strToU8('<html>local</html>') })
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  let downloads = 0
  const module = load('src/webBundle/webBundleStorage.ts', {
    'expo-file-system': { File, Directory, Paths: { document: 'file:///documents', cache: 'file:///cache' } },
    'expo/fetch': { fetch: async () => { downloads++; return { ok: true, headers: new Headers(), arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } } },
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digest: async (_, data) => { const hash = createHash('sha256').update(data).digest(); return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength) } },
    'fflate': require('fflate'),
    '../config/webBundleUpdateConfig': { WEB_BUNDLE_UPDATE_CONFIG: config },
    './webBundleErrors': errors,
    './webBundleProgress': { emitWebBundleProgress() {} },
  })
  return { ...module, files, downloads: () => downloads, release: { ...manifest, sha256: wrongHash ? '0'.repeat(64) : sha256 } }
}

test('ZIP is hashed, extracted, confirmed, and rolled back to the previous verified release', async () => {
  const h = storageHarness()
  const first = await h.installWebBundle(h.release)
  assert.equal(first.pending, true)
  await h.confirmWebBundleReady(first.version)
  assert.equal((await h.prepareWebBundleStorage()).active.pending, false)
  const second = await h.installWebBundle({ ...h.release, version: '0.1.2' })
  assert.equal((await h.rollbackWebBundle(second.version)).version, '0.1.1')
  assert.ok((await h.prepareWebBundleStorage()).failedVersions.includes('0.1.2'))
})

test('three bad hashes or unsafe ZIP paths never activate a release', async () => {
  for (const options of [{ wrongHash: true }, { unsafe: true }]) {
    const h = storageHarness(options)
    await assert.rejects(h.installWebBundle(h.release))
    assert.equal(h.downloads(), 3)
    assert.equal((await h.prepareWebBundleStorage()).active, null)
    assert.equal([...h.files.keys()].some(x => x.endsWith('/escape.html')), false)
  }
})

test('an unconfirmed release surviving a failed launch rolls back on the next launch', async () => {
  const h = storageHarness()
  await h.installWebBundle(h.release)
  await h.confirmWebBundleReady(h.release.version)
  await h.installWebBundle({ ...h.release, version: '0.1.2' })
  assert.equal((await h.prepareWebBundleStorage()).active.version, '0.1.2')
  assert.equal((await h.prepareWebBundleStorage()).active.version, '0.1.1')
})

test('shared installations report progress to every current subscriber and remove finished subscribers', async () => {
  const h = loader()
  const first = []
  const second = []
  await Promise.all([
    h.resolveWebBundle(value => first.push(value.stage)),
    h.resolveWebBundle(value => second.push(value.stage)),
  ])
  assert.deepEqual(first, ['checking'])
  assert.deepEqual(second, ['checking'])
  await h.resolveWebBundle(() => {})
  assert.deepEqual(first, ['checking'])
  assert.deepEqual(second, ['checking'])
})
