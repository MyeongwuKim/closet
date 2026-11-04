/**
 * 용도:
 * 생성 후 24시간 지난 미저장 AI 룩북과 어느 코디·플래너·진행 작업에서도 쓰지 않는 삭제 옷의 사진을 정리한다.
 *
 * 동작 방식:
 * 기본 실행은 참조·생성 진행 여부를 검사해 삭제 후보만 조회한다.
 * 두 종류의 후보를 생성 시각·ID 순으로 합쳐 --limit 전체 한도를 나눈다.
 * --execute에서만 삭제 임대를 얻어 CF 파일과 DB 기록을 순서대로 지우며 실패 기록은 다음 배치에 남긴다.
 */
import { loadEnvFile } from 'node:process'
import { imageCleanupBatch } from '../features/image/image-cleanup.batch.js'
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
  const result = await imageCleanupBatch.cleanup({
    execute,
    limit,
  })
  const generatedResult = result.generated
  const wardrobeResult = result.wardrobe

  console.log(
    execute
      ? `미저장 고아·삭제 재시도 후보 ${generatedResult.candidateCount}개를 확인해 ${generatedResult.deletedCount}개를 삭제했습니다.`
      : `생성 24시간이 지난 미저장 고아·삭제 재시도 후보 ${generatedResult.candidateCount}개를 찾았습니다. 실제 삭제는 --execute 옵션을 사용하세요.`,
  )
  console.log(execute
    ? `미사용 삭제 옷 사진 후보 ${wardrobeResult.candidateCount}개를 확인해 ${wardrobeResult.deletedCount}개를 삭제했습니다.`
    : `미사용 삭제 옷 사진 후보 ${wardrobeResult.candidateCount}개를 찾았습니다. 실제 삭제는 --execute 옵션을 사용하세요.`)
  const failedAssetIds = result.failedAssetIds
  if (failedAssetIds.length > 0) {
    console.error(
      `삭제 실패 ${failedAssetIds.length}개: ${failedAssetIds.join(', ')}`,
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
