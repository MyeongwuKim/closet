import { spawnSync } from 'node:child_process'
import { addProvisioningFlags } from './ios-provisioning.mjs'

// 실기기 빌드에 자동 서명 갱신 옵션을 추가하고 원래 Xcode 빌드 도구에 실행을 맡긴다.
const executable = process.env.WEAROOM_REAL_XCODEBUILD
if (!executable) throw new Error('원래 Xcode 빌드 도구 경로가 필요합니다.')
const result = spawnSync(executable, addProvisioningFlags(process.argv.slice(2)), { stdio: 'inherit', env: process.env })
if (result.error) throw result.error
if (result.signal) process.kill(process.pid, result.signal)
else process.exitCode = result.status ?? 1
