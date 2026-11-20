import { readFileSync } from 'node:fs'
import { confirmIosVersion } from './confirm-ios-version.mjs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadBuildEnvironment } from './build-environment.mjs'
import { runWithIosProvisioning } from './ios-provisioning.mjs'

const require = createRequire(import.meta.url)
const nativeRoot = fileURLToPath(new URL('..', import.meta.url))
const expoCli = require.resolve('expo/bin/cli')
const { variant, env, envFile } = loadBuildEnvironment(process.argv[2])
env.CLOSET_BUILD_PLATFORM = 'ios'
const device = process.argv.slice(3).includes('--device')
const versions = JSON.parse(readFileSync(new URL('../app-versions.json', import.meta.url), 'utf8'))
const channel = variant.environment === 'production' ? 'prod' : 'dev'
const version = versions[channel].ios
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('iOS 앱 버전은 x.y.z 형식이어야 합니다.')
if (!await confirmIosVersion({ ...variant, version })) {
  console.log('빌드를 취소했습니다. app-versions.json의 버전을 수정한 뒤 다시 실행해주세요.')
  process.exit(0)
}
const isRelease = variant.environment !== 'local'
console.log(`wearroom 빌드: ${variant.name} / ${envFile} / ${isRelease ? 'Release' : 'Debug'}`)

/** 현재 Node와 선택한 환경을 자식 작업에 전달하며 실패한 빌드 단계에서 즉시 중단한다. */
function run(script, args = [], refreshProvisioning = false) {
  const spawn = refreshProvisioning ? runWithIosProvisioning : spawnSync
  const result = spawn(process.execPath, [script, ...args], { cwd: nativeRoot, env, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// 기존 ios 폴더가 있어도 이번 환경의 표시 이름·식별자를 먼저 반영한다. 폴더를 삭제하지 않는다.
run(fileURLToPath(new URL('./sync-web-build.mjs', import.meta.url)))
run(expoCli, ['prebuild', '--platform', 'ios', '--no-install'])
run(expoCli, ['run:ios', '--scheme', variant.xcodeScheme, '--configuration', isRelease ? 'Release' : 'Debug', ...(isRelease ? ['--no-bundler'] : []), ...(device ? ['--device'] : [])], device)
