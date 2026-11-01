import { loadEnvFile } from 'node:process'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

try { loadEnvFile(resolve(import.meta.dirname, '../../.env')) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
if (!process.env.DATABASE_URL) throw new Error('MongoDB 테스트 연결 설정이 필요합니다.')
// 기존 계정 DB를 수정하지 않고 같은 클러스터의 새 테스트 DB에서만 검증한다.
const database = new URL(process.env.DATABASE_URL)
database.pathname = `/closet_ai_test_${randomBytes(6).toString('hex')}`
process.env.DATABASE_URL = database.toString()
const { prisma } = await import('../lib/prisma.js')
await prisma.$runCommandRaw({ createIndexes: 'AiExecution', indexes: [{ key: { expiresAt: 1 }, name: 'AiExecution_expiresAt_idx' }] })
await prisma.$disconnect()
const child = spawn(process.execPath, ['--import', './apps/api/node_modules/tsx/dist/loader.mjs', '--test', '--test-concurrency=1',
  'apps/api/src/lib/ai/shared-ai-executor.integration.test.ts', 'apps/api/src/features/outfit/preview-job.integration.test.ts', 'apps/api/src/features/preview-credits/preview-credit.integration.test.ts'], {
  cwd: resolve(import.meta.dirname, '../../../..'), stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: database.toString(), AI_INTEGRATION_DATABASE: '1' },
})
child.on('exit', (code) => { process.exitCode = code ?? 1 })
