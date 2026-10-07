import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadBuildEnvironment } from './build-environment.mjs'
import { runWithIosProvisioning } from './ios-provisioning.mjs'

const require = createRequire(import.meta.url)
const nativeRoot = fileURLToPath(new URL('..', import.meta.url))
const expoCli = require.resolve('expo/bin/cli')
const { variant, env, envFile } = loadBuildEnvironment(process.argv[2])
const device = process.argv.slice(3).includes('--device')
const isRelease = variant.environment !== 'local'
console.log(`웨어룸 빌드: ${variant.name} / ${envFile} / ${isRelease ? 'Release' : 'Debug'}`)

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
run(expoCli, ['run:ios', '--configuration', isRelease ? 'Release' : 'Debug', ...(isRelease ? ['--no-bundler'] : []), ...(device ? ['--device'] : [])], device)
