import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 실제 iOS 빌드에만 프로파일 갱신·기기 등록 옵션을 추가한다. 버전·프로젝트 목록 조회는 그대로 전달한다. */
export function addProvisioningFlags(args) {
  if (!args.includes('-destination') || (!args.includes('-workspace') && !args.includes('-project'))) return args
  return [...args, ...['-allowProvisioningUpdates', '-allowProvisioningDeviceRegistration'].filter((flag) => !args.includes(flag))]
}

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`

/** Expo가 실행하는 xcodebuild에만 자동 서명 갱신 옵션을 연결한다. 의존성을 수정하지 않고 종료 후 임시 실행 파일을 지운다. */
export function runWithIosProvisioning(command, args, options) {
  const resolved = spawnSync('/usr/bin/xcrun', ['--find', 'xcodebuild'], { encoding: 'utf8' })
  if (resolved.status !== 0) throw new Error('Xcode 빌드 도구를 찾지 못했습니다.')
  const shimDirectory = mkdtempSync(path.join(tmpdir(), 'wearoom-ios-signing-'))
  const shimScript = fileURLToPath(new URL('./xcodebuild-with-provisioning.mjs', import.meta.url))
  try {
    writeFileSync(path.join(shimDirectory, 'xcodebuild'), `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(shimScript)} "$@"\n`, { mode: 0o755 })
    return spawnSync(command, args, {
      ...options,
      env: {
        ...options.env,
        PATH: `${shimDirectory}${path.delimiter}${options.env.PATH ?? process.env.PATH ?? ''}`,
        WEAROOM_REAL_XCODEBUILD: resolved.stdout.trim(),
      },
    })
  } finally {
    rmSync(shimDirectory, { recursive: true, force: true })
  }
}
