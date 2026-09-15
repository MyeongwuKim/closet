/**
 * 용도:
 * 코디북에 저장되지 않은 만료 AI 룩북 이미지를 정리하는 크론용 명령이다.
 *
 * 동작 방식:
 * 기본 실행은 삭제 후보만 확인하고, --execute 옵션이 있을 때만
 * Cloudflare Images와 ImageAsset 레코드를 실제로 삭제한다.
 */
import { loadEnvFile } from 'node:process'
import { imageService } from '../features/image/image.service.js'
import { prisma } from '../lib/prisma.js'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

function readLimit(args: string[]) {
  const value = args
    .find((argument) => argument.startsWith('--limit='))
    ?.slice('--limit='.length)
  if (!value) return DEFAULT_LIMIT

  const limit = Number(value)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`--limit은 1부터 ${MAX_LIMIT} 사이의 정수여야 합니다.`)
  }
  return limit
}

async function main() {
  try {
    loadEnvFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const args = process.argv.slice(2)
  const execute = args.includes('--execute')
  const limit = readLimit(args)
  const result = await imageService.cleanupExpiredGeneratedPreviews({
    execute,
    limit,
  })

  console.log(
    execute
      ? `만료 미리보기 ${result.candidateCount}개를 확인해 ${result.deletedCount}개를 삭제했습니다.`
      : `삭제 대상 미리보기 ${result.candidateCount}개를 찾았습니다. 실제 삭제는 --execute 옵션을 사용하세요.`,
  )
  if (result.failedAssetIds.length > 0) {
    console.error(
      `삭제 실패 ${result.failedAssetIds.length}개: ${result.failedAssetIds.join(', ')}`,
    )
    process.exitCode = 1
  }
}

try {
  await main()
} catch (error) {
  console.error(
    error instanceof Error ? error.message : '미리보기 정리에 실패했습니다.',
  )
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
