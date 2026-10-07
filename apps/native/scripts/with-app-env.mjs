import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { loadBuildEnvironment } from './build-environment.mjs'

// Metro·Android 명령에도 지정한 파일의 값만 전달해 Expo가 다른 환경 파일을 섞어 읽지 않게 한다.
const { env } = loadBuildEnvironment(process.argv[2])
const [command, ...args] = process.argv.slice(3)
if (!command) throw new Error('환경 적용 후 실행할 명령이 필요합니다.')
const result = spawnSync(command, args, {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
