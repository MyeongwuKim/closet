import type { ImageAsset } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { cloudflareImagesClient } from './cloudflare-images.client.js'
import { archivedWardrobeImageCleanupRepository, type ArchivedWardrobeImageCursor, type ArchivedWardrobeImageDeletionClaim } from './archived-wardrobe-image-cleanup.repository.js'

interface Dependencies {
  findCandidates(now: Date, limit: number, after?: ArchivedWardrobeImageCursor): Promise<ImageAsset[]>
  claim(id: string, now: Date): Promise<ArchivedWardrobeImageDeletionClaim | null>
  finalize(claim: ArchivedWardrobeImageDeletionClaim): Promise<{ count: number }>
  release(claim: ArchivedWardrobeImageDeletionClaim, now: Date): Promise<unknown>
  deleteImage(remoteId: string): Promise<void>
}

export interface ArchivedWardrobeImageCleanupOptions { execute: boolean; limit: number; now?: Date }

/** 삭제된 옷의 미사용 사진을 페이지 단위로 정리한다. 기본 조회는 쓰지 않으며 실제 삭제는 claim→CF→DB 순서로 수행하고 실패를 재시도에 남긴다. */
export function createArchivedWardrobeImageCleanupService(dependencies: Dependencies) {
  return {
    async cleanup(options: ArchivedWardrobeImageCleanupOptions) {
      const now = options.now ?? new Date()
      if (typeof options.execute !== 'boolean' || !Number.isInteger(options.limit) || options.limit < 1 || options.limit > 500 || !Number.isFinite(now.getTime())) {
        throw new ServiceError('옷 사진 정리 범위를 확인해주세요.', 'INVALID_WARDROBE_IMAGE_CLEANUP_OPTIONS')
      }
      const operationTime = () => options.now ? new Date(now.getTime()) : new Date()
      let after: ArchivedWardrobeImageCursor | undefined
      let candidateCount = 0
      let deletedCount = 0
      const failedAssetIds: string[] = []
      while (candidateCount < options.limit) {
        const take = Math.min(100, options.limit - candidateCount)
        const candidates = await dependencies.findCandidates(now, take, after)
        if (!candidates.length) break
        candidateCount += candidates.length
        if (options.execute) for (const asset of candidates) {
          let claim: ArchivedWardrobeImageDeletionClaim | null = null
          try {
            claim = await dependencies.claim(asset.id, operationTime())
            if (!claim) continue
            await dependencies.deleteImage(claim.asset.cloudflareImageId)
            if ((await dependencies.finalize(claim)).count === 1) deletedCount++
            else {
              failedAssetIds.push(asset.id)
              await dependencies.release(claim, operationTime()).catch(() => undefined)
            }
          } catch {
            failedAssetIds.push(asset.id)
            if (claim) await dependencies.release(claim, operationTime()).catch(() => undefined)
          }
        }
        const last = candidates.at(-1)!
        after = { id: last.id, createdAt: last.createdAt }
        if (candidates.length < take) break
      }
      return { candidateCount, deletedCount, failedAssetIds }
    },
  }
}

export const archivedWardrobeImageCleanupService = createArchivedWardrobeImageCleanupService({
  findCandidates: (...args) => archivedWardrobeImageCleanupRepository.findCandidates(...args),
  claim: (...args) => archivedWardrobeImageCleanupRepository.claim(...args),
  finalize: (claim) => archivedWardrobeImageCleanupRepository.finalize(claim),
  release: (...args) => archivedWardrobeImageCleanupRepository.release(...args),
  deleteImage: (remoteId) => cloudflareImagesClient.deleteImage(remoteId),
})
