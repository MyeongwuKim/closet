import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { confirmIosVersion } from './confirm-ios-version.mjs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadBuildEnvironment } from './build-environment.mjs'
import { renameIosProject, selectNamedIosWorkspace } from './rename-ios-project.mjs'
import { prebuildReleaseIos } from './prepare-release-ios.mjs'
import { syncXcodeEnvironment } from './xcode-environment.mjs'
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
function run(command, args, { refreshProvisioning = false, cwd = nativeRoot } = {}) {
  const spawn = refreshProvisioning ? runWithIosProvisioning : spawnSync
  const result = spawn(command, args, { cwd, env, encoding: 'utf8', stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} 실행 실패 (${result.status ?? result.signal ?? 'unknown'})`)
}

const localIosRoot = path.join(nativeRoot, 'ios')
const iosRoot = isRelease ? path.join(nativeRoot, `ios-${channel}`) : localIosRoot

if (isRelease) env.CLOSET_IOS_ISOLATED_WEB_BUNDLE = '1'
run(process.execPath, [fileURLToPath(new URL('./sync-web-build.mjs', import.meta.url))])
const prebuild = (cwd) => run(process.execPath, [expoCli, 'prebuild', '--platform', 'ios', '--no-install'], { cwd })

if (isRelease) {
  prebuildReleaseIos({ nativeRoot, iosRoot, localIosRoot, prebuild })
  const project = readdirSync(iosRoot).find(name => name.endsWith('.xcodeproj'))
  if (!project) throw new Error('prebuild에서 iOS 프로젝트를 만들지 못했습니다.')
  const projectName = path.basename(project, '.xcodeproj').normalize('NFC')
  if (projectName !== variant.xcodeScheme) renameIosProject(iosRoot, projectName, variant.xcodeScheme)
  syncXcodeEnvironment(iosRoot, env)
  run('pod', ['install'], { cwd: iosRoot })
  const workspace = path.join(iosRoot, `${variant.xcodeScheme}.xcworkspace`)
  if (!existsSync(path.join(workspace, 'contents.xcworkspacedata'))) {
    throw new Error('CocoaPods가 Xcode 워크스페이스를 만들지 못했습니다.')
  }
  console.log(`Xcode 워크스페이스: ${path.relative(nativeRoot, workspace)}`)
} else {
  selectNamedIosWorkspace(iosRoot)
  const restoredDefaultProject = ['웨어룸(T)', '웨어룸', 'wearroomT'].some(name => renameIosProject(iosRoot, name, 'closet'))
  prebuild(nativeRoot)
  syncXcodeEnvironment(iosRoot, env)
  if (restoredDefaultProject) run('pod', ['install'], { cwd: iosRoot })
  run(process.execPath, [expoCli, 'run:ios', '--scheme', variant.xcodeScheme, '--configuration', 'Debug', ...(device ? ['--device'] : [])], { refreshProvisioning: device })
}
