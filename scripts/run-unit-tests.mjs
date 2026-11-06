import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

// 지정한 경로의 단위 테스트만 실행해 실제 DB 통합 검사가 CI에 포함되지 않게 한다.
const directory = process.argv[2]
const testFiles = readdirSync(directory, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts') && !entry.name.endsWith('.integration.test.ts'))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort()

if (testFiles.length === 0) throw new Error(`단위 테스트 파일을 찾지 못했습니다. ${directory}`)

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...testFiles], { stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
