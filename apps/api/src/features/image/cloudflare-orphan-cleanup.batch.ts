import { cloudflareCleanupCursorRepository, type CloudflareCleanupCursor } from './cloudflare-cleanup-cursor.repository.js'
import { cloudflareOrphanCleanupService, type CloudflareOrphanCleanupOptions } from './cloudflare-orphan-cleanup.service.js'

interface Dependencies {
  readCursor(): Promise<CloudflareCleanupCursor>
  advanceCursor(cursor: CloudflareCleanupCursor, nextToken?: string): Promise<boolean>
  cleanup: typeof cloudflareOrphanCleanupService.cleanup
}

/** 조회 전용 실행은 진행점을 바꾸지 않고, 성공한 삭제 실행만 다음 페이지를 예약한다. */
export function createCloudflareOrphanCleanupBatch(dependencies: Dependencies) {
  return {
    async cleanup(options: Omit<CloudflareOrphanCleanupOptions, 'continuationToken'> = {}) {
      const cursor = await dependencies.readCursor()
      const result = await dependencies.cleanup({ ...options, continuationToken: cursor.continuationToken })
      const canAdvance = Boolean(options.execute) && !result.executionBlocked && result.failedRemoteIds.length === 0
      const checkpointSaved = canAdvance ? await dependencies.advanceCursor(cursor, result.nextContinuationToken) : false
      return { ...result, checkpointSaved }
    },
  }
}

/** 환경 로딩 후 CF_ACCOUNT로 진행점을 구분해 다른 계정의 목록 토큰을 섞지 않는다. */
export function cleanupCloudflareOrphansBatch(options: Omit<CloudflareOrphanCleanupOptions, 'continuationToken'> = {}) {
  const account = process.env.CF_ACCOUNT
  if (!account) throw new Error('CF_ACCOUNT 설정을 확인해주세요.')
  const cursorId = `cloudflare-orphans-v1:${account}`
  return createCloudflareOrphanCleanupBatch({
    readCursor: () => cloudflareCleanupCursorRepository.read(cursorId),
    advanceCursor: (cursor, token) => cloudflareCleanupCursorRepository.advance(cursorId, cursor, token),
    cleanup: (input) => cloudflareOrphanCleanupService.cleanup(input),
  }).cleanup(options)
}
