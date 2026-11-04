/** 앱 기록이 없는 CF 생성 이미지의 24시간 고아를 별도로 검사한다. 기본은 조회만 하며 --execute에서만 삭제 임대·CF 삭제·임대 기록 정리를 수행한다. */
import { loadEnvFile } from 'node:process'
import { pathToFileURL } from 'node:url'
import { CLOUDFLARE_ORPHAN_CLEANUP_LIMIT, CLOUDFLARE_ORPHAN_CLEANUP_MAX_LIMIT, CLOUDFLARE_ORPHAN_CLEANUP_MAX_PAGES } from '../features/image/cloudflare-orphan-cleanup.service.js'
import { cleanupCloudflareOrphansBatch } from '../features/image/cloudflare-orphan-cleanup.batch.js'
import { prisma } from '../lib/prisma.js'

/** 명시한 실행 모드·후보 수·페이지 수만 허용한다. 오타나 중복 옵션은 삭제를 시작하기 전에 거절한다. */
export function parseCloudflareOrphanCleanupArgs(args: string[]) {
  let execute = false
  let limit = CLOUDFLARE_ORPHAN_CLEANUP_LIMIT
  let maxPages = CLOUDFLARE_ORPHAN_CLEANUP_MAX_PAGES
  const seen = new Set<string>()
  for (const argument of args) {
    const name = argument.split('=')[0]!
    if (seen.has(name)) throw new Error(`중복 옵션을 확인해주세요: ${name}`)
    seen.add(name)
    if (argument === '--execute') { execute = true; continue }
    const match = /^--(limit|max-pages)=(\d+)$/.exec(argument)
    if (!match) throw new Error('사용법: cleanup:cloudflare-orphans [--execute] [--limit=100] [--max-pages=10]')
    const value = Number(match[2])
    const maximum = match[1] === 'limit' ? CLOUDFLARE_ORPHAN_CLEANUP_MAX_LIMIT : CLOUDFLARE_ORPHAN_CLEANUP_MAX_PAGES
    if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`--${match[1]}은 1부터 ${maximum} 사이의 정수여야 합니다.`)
    if (match[1] === 'limit') limit = value
    else maxPages = value
  }
  return { execute, limit, maxPages }
}

async function main() {
  const options = parseCloudflareOrphanCleanupArgs(process.argv.slice(2))
  try { loadEnvFile() }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const result = await cleanupCloudflareOrphansBatch(options)
  console.log(options.execute
    ? `원격 고아 후보 ${result.candidateCount}개 중 ${result.deletedCount}개를 정리했습니다.`
    : `원격 고아 후보 ${result.candidateCount}개를 찾았습니다. 조회만 수행했으며 실제 삭제에는 --execute가 필요합니다.`)
  console.log(JSON.stringify(result))
  if (result.failedRemoteIds.length) {
    console.error(`정리 실패 원격 ID: ${result.failedRemoteIds.join(', ')}. 삭제 임대가 생성된 기록은 DB 고아 정리 배치에서 재시도합니다.`)
    process.exitCode = 1
  }
  if (result.executionBlocked) {
    console.error('원격 목록의 반복 페이지 번호를 발견해 삭제를 실행하지 않았습니다.')
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main() }
  catch (error) {
    console.error(error instanceof Error ? error.message : '원격 고아 정리에 실패했습니다.')
    process.exitCode = 1
  } finally { await prisma.$disconnect() }
}
