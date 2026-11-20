import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
const require = createRequire(import.meta.url)
const { syncIosBuildIdentity } = require('../plugins/with-ios-build-identity.cjs')

test('환경별 scheme·앱 산출물·Marketing Version을 갱신하고 기존 서명과 타깃을 보존한다', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'closet-ios-identity-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const schemes = path.join(root, 'closet.xcodeproj/xcshareddata/xcschemes')
  mkdirSync(schemes, { recursive: true })
  writeFileSync(path.join(schemes, 'closet.xcscheme'), '<BuildableReference BuildableName="closet.app" BlueprintName="closet" BlueprintIdentifier="APP" ReferencedContainer="container:closet.xcodeproj"/><BuildableReference BuildableName="closetTests.xctest"/>')
  const configurations = { debug: { buildSettings: { PRODUCT_NAME: 'closet', DEVELOPMENT_TEAM: 'EXISTING', CURRENT_PROJECT_VERSION: '7' } }, release: { buildSettings: { PRODUCT_NAME: 'closet' } }, tests: { buildSettings: { PRODUCT_NAME: 'closetTests', MARKETING_VERSION: '1.0' } } }
  const project = {
    pbxXCBuildConfigurationSection: () => configurations,
    pbxXCConfigurationList: () => ({ list: { buildConfigurations: [{ value: 'debug' }, { value: 'release' }] } }),
    pbxNativeTargetSection: () => ({ app: { productType: '"com.apple.product-type.application"', buildConfigurationList: 'list' }, tests: { productType: 'com.apple.product-type.bundle.unit-test' }, app_comment: 'app' }),
  }
  for (const [schemeName, version] of [['wearroomT', '1.0.0'], ['wearroom', '1.2.3'], ['wearroomL', '1.0.1']]) {
    syncIosBuildIdentity(project, { platformProjectRoot: root, schemeName, version })
    assert.equal(configurations.debug.buildSettings.PRODUCT_NAME, `"${schemeName}"`)
    assert.equal(configurations.release.buildSettings.MARKETING_VERSION, version)
    assert.equal(configurations.debug.buildSettings.DEVELOPMENT_TEAM, 'EXISTING')
    assert.equal(configurations.debug.buildSettings.CURRENT_PROJECT_VERSION, '7')
    assert.equal(configurations.tests.buildSettings.PRODUCT_NAME, 'closetTests')
    const scheme = readFileSync(path.join(schemes, `${schemeName}.xcscheme`), 'utf8')
    assert.ok(scheme.includes(`BuildableName = "${schemeName}.app"`))
    assert.match(scheme, /BlueprintName="closet"/)
    assert.match(scheme, /closetTests.xctest/)
    assert.ok(existsSync(path.join(schemes, 'closet.xcscheme')))
  }
  assert.equal(existsSync(path.join(schemes, 'wearroomT.xcscheme')), false)
})
