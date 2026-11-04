import { ServiceError } from '../../graphql/errors.js'
import { imageRepository } from './image.repository.js'
import { imageService } from './image.service.js'
import { archivedWardrobeImageCleanupRepository } from './archived-wardrobe-image-cleanup.repository.js'
import { archivedWardrobeImageCleanupService } from './archived-wardrobe-image-cleanup.service.js'

interface CleanupCandidate { id: string; createdAt: Date }
interface CleanupResult { candidateCount: number; deletedCount: number; failedAssetIds: string[] }
interface CleanupOptions { execute: boolean; limit: number; now?: Date }
interface Dependencies {
  findGeneratedCandidates(now: Date, limit: number): Promise<CleanupCandidate[]>
  findWardrobeCandidates(now: Date, limit: number): Promise<CleanupCandidate[]>
  cleanupGenerated(options: CleanupOptions): Promise<CleanupResult>
  cleanupWardrobe(options: CleanupOptions): Promise<CleanupResult>
}

const emptyResult = (): CleanupResult => ({ candidateCount: 0, deletedCount: 0, failedAssetIds: [] })

/** 두 종류의 오래된 후보부터 전체 한도를 나눠 한쪽의 적체가 다른 사진의 정리를 계속 막지 않게 한다. dry-run은 선택한 후보만 보고하며 삭제 서비스는 실행하지 않는다. */
export function createImageCleanupBatch(dependencies: Dependencies) {
  return {
    async cleanup(options: CleanupOptions) {
      const now = options.now ?? new Date()
      if (typeof options.execute !== 'boolean' || !Number.isInteger(options.limit) || options.limit < 1 || options.limit > 500 || !Number.isFinite(now.getTime())) {
        throw new ServiceError('사진 정리 범위를 확인해주세요.', 'INVALID_IMAGE_CLEANUP_OPTIONS')
      }
      const [generatedCandidates, wardrobeCandidates] = await Promise.all([
        dependencies.findGeneratedCandidates(now, options.limit),
        dependencies.findWardrobeCandidates(now, options.limit),
      ])
      const selected = [
        ...generatedCandidates.map((asset) => ({ ...asset, kind: 'generated' as const })),
        ...wardrobeCandidates.map((asset) => ({ ...asset, kind: 'wardrobe' as const })),
      ].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
        .slice(0, options.limit)
      const generatedLimit = selected.filter((candidate) => candidate.kind === 'generated').length
      const wardrobeLimit = selected.length - generatedLimit
      let generated = emptyResult()
      let wardrobe = emptyResult()
      if (options.execute) {
        // 각 서비스는 할당량 안에서 후보를 다시 읽고 실제 삭제 직전의 참조도 재검사한다.
        if (generatedLimit) generated = await dependencies.cleanupGenerated({ ...options, limit: generatedLimit })
        if (wardrobeLimit) wardrobe = await dependencies.cleanupWardrobe({ ...options, limit: wardrobeLimit })
      } else {
        generated.candidateCount = generatedLimit
        wardrobe.candidateCount = wardrobeLimit
      }
      return {
        generated, wardrobe,
        candidateCount: generated.candidateCount + wardrobe.candidateCount,
        deletedCount: generated.deletedCount + wardrobe.deletedCount,
        failedAssetIds: [...generated.failedAssetIds, ...wardrobe.failedAssetIds],
      }
    },
  }
}

export const imageCleanupBatch = createImageCleanupBatch({
  findGeneratedCandidates: (now, limit) => imageRepository.findExpiredGeneratedPreviews(now, limit),
  findWardrobeCandidates: (now, limit) => archivedWardrobeImageCleanupRepository.findCandidates(now, limit),
  cleanupGenerated: (options) => imageService.cleanupExpiredGeneratedPreviews(options),
  cleanupWardrobe: (options) => archivedWardrobeImageCleanupService.cleanup(options),
})
