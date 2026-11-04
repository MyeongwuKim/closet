import { prisma } from '../../lib/prisma.js'
import { ServiceError } from '../../graphql/errors.js'
import { cloudflareImagesClient, type CloudflareImageListPage } from './cloudflare-images.client.js'
import { GENERATED_IMAGE_DELETION_LEASE_MS, GENERATED_PREVIEW_ORPHAN_GRACE_MS, imageRepository, type GeneratedImageDeletionClaim } from './image.repository.js'

export const CLOUDFLARE_ORPHAN_CLEANUP_LIMIT = 100
export const CLOUDFLARE_ORPHAN_CLEANUP_MAX_LIMIT = 500
export const CLOUDFLARE_ORPHAN_CLEANUP_MAX_PAGES = 10

interface Candidate {
  remoteId: string
  userId: string
  storageFilename: string
  uploadedAt: Date
  model?: string
}

interface Dependencies {
  listImages(continuationToken?: string): Promise<CloudflareImageListPage>
  hasDatabaseAsset(remoteId: string): Promise<boolean>
  hasActiveJob(userId: string): Promise<boolean>
  createDeletionClaim(candidate: Candidate, now: Date): Promise<GeneratedImageDeletionClaim>
  removeClaim(claim: GeneratedImageDeletionClaim): Promise<{ count: number }>
  releaseClaim(claim: GeneratedImageDeletionClaim, now: Date): Promise<unknown>
  deleteImage(remoteId: string): Promise<void>
}

export interface CloudflareOrphanCleanupOptions {
  execute?: boolean
  limit?: number
  maxPages?: number
  /** 앞 실행이 끝낸 페이지 다음부터 조회한다. undefined이면 처음부터 순환한다. */
  continuationToken?: string
  now?: Date
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function validRemoteId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value)
}

/** Date.parse가 보정하는 2월 30일·24시 등은 거절하고 시간대가 명시된 업로드 시각만 사용한다. */
function parseUploadedAt(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number)
  if (year! < 1970 || month! < 1 || month! > 12 || day! < 1 || hour! > 23 || minute! > 59 || second! > 59) return null
  const calendarDate = new Date(Date.UTC(year!, month! - 1, day!))
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month! - 1 || calendarDate.getUTCDate() !== day) return null
  if (match[7] !== 'Z' && (Number(match[7]!.slice(1, 3)) > 23 || Number(match[7]!.slice(4, 6)) > 59)) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp) : null
}

function parseCandidate(value: unknown, cutoff: number): Candidate | null {
  if (!isRecord(value) || !validRemoteId(value.id) || !isRecord(value.meta)) return null
  const meta = value.meta
  if (meta.kind !== 'outfitGenerated' || typeof meta.userId !== 'string' || !/^[a-f\d]{24}$/i.test(meta.userId)
    || typeof meta.storageFilename !== 'string' || !/^closet_dev_[^/\\\u0000-\u001f\u007f]+$/.test(meta.storageFilename) || meta.storageFilename.length > 255) return null
  const uploadedAt = parseUploadedAt(value.uploaded)
  if (!uploadedAt || uploadedAt.getTime() > cutoff) return null
  return { remoteId: value.id, userId: meta.userId, storageFilename: meta.storageFilename, uploadedAt, ...(typeof meta.model === 'string' && meta.model ? { model: meta.model } : {}) }
}

function isUniqueConflict(error: unknown) { return isRecord(error) && error.code === 'P2002' }

/**
 * CF 목록에서 앱의 생성 이미지·24시간 경과·DB 부재·진행 작업 부재를 모두 확인한다.
 * 기본 실행은 조회만 한다. execute에서는 unique 원격 번호의 삭제 기록을 먼저 만들어 늦은 DB 연결을 막고,
 * CF 삭제 후 같은 임대의 기록만 정리한다. 실패 기록은 기존 DB 고아 배치가 재시도한다.
 */
export function createCloudflareOrphanCleanupService(dependencies: Dependencies) {
  return {
    async cleanup(options: CloudflareOrphanCleanupOptions = {}) {
      const { execute = false, limit = CLOUDFLARE_ORPHAN_CLEANUP_LIMIT, maxPages = CLOUDFLARE_ORPHAN_CLEANUP_MAX_PAGES, now = new Date() } = options
      if (typeof execute !== 'boolean' || !Number.isInteger(limit) || limit < 1 || limit > CLOUDFLARE_ORPHAN_CLEANUP_MAX_LIMIT
        || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > CLOUDFLARE_ORPHAN_CLEANUP_MAX_PAGES || !Number.isFinite(now.getTime())
        || (options.continuationToken !== undefined && (typeof options.continuationToken !== 'string' || !options.continuationToken || options.continuationToken.length > 32))) {
        throw new ServiceError('원격 고아 정리 범위를 확인해주세요.', 'INVALID_CLOUDFLARE_CLEANUP_OPTIONS')
      }
      // 업로드 나이는 실행 시작 시각으로 고정하지만 실제 삭제 임대는 긴 목록 조회 후에도 새 5분을 확보한다.
      const operationTime = () => options.now ? new Date(now.getTime()) : new Date()
      const sourceCandidates = new Map<string, Candidate>()
      const candidatePageTokens = new Map<string, string | undefined>()
      const seenIds = new Set<string>()
      const seenTokens = new Set<string>()
      let continuationToken = options.continuationToken
      let nextContinuationToken: string | undefined
      if (continuationToken) seenTokens.add(continuationToken)
      let pagesRead = 0
      let scannedCount = 0
      let invalidCount = 0
      let duplicateCount = 0
      let stopReason: 'end' | 'max-pages' | 'limit' | 'repeated-token' = 'end'

      // 원격 응답 형식·반복 페이지를 먼저 검사한다. 불완전한 목록 응답 때문에 삭제가 일부 실행되는 일을 피한다.
      while (pagesRead < maxPages) {
        const page = await dependencies.listImages(continuationToken)
        if (!page || !Array.isArray(page.images) || page.images.length > 1000 || (page.continuationToken !== undefined && (typeof page.continuationToken !== 'string' || !page.continuationToken || page.continuationToken.length > 32))) {
          throw new ServiceError('Cloudflare Images 목록 응답을 확인할 수 없습니다.', 'CLOUDFLARE_INVALID_PAGE')
        }
        pagesRead++
        for (const value of page.images) {
          scannedCount++
          const id = isRecord(value) && validRemoteId(value.id) ? value.id : null
          if (id && seenIds.has(id)) {
            // 같은 ID가 서로 다른 원격 메타데이터로 나타날 수 있으므로 중복은 후보 전체에서 제외한다.
            duplicateCount++
            sourceCandidates.delete(id)
            candidatePageTokens.delete(id)
            continue
          }
          if (id) seenIds.add(id)
          const candidate = parseCandidate(value, now.getTime() - GENERATED_PREVIEW_ORPHAN_GRACE_MS)
          if (candidate) {
            sourceCandidates.set(candidate.remoteId, candidate)
            candidatePageTokens.set(candidate.remoteId, continuationToken)
          }
          else invalidCount++
        }
        nextContinuationToken = page.continuationToken
        if (!page.continuationToken) break
        if (seenTokens.has(page.continuationToken)) { stopReason = 'repeated-token'; break }
        seenTokens.add(page.continuationToken)
        continuationToken = page.continuationToken
        if (pagesRead === maxPages) stopReason = 'max-pages'
      }

      const candidateRemoteIds: string[] = []
      const deletedRemoteIds: string[] = []
      const failedRemoteIds: string[] = []
      let existingCount = 0
      let activeJobCount = 0
      let racedCount = 0
      const executionBlocked = stopReason === 'repeated-token'

      for (const candidate of sourceCandidates.values()) {
        if (candidateRemoteIds.length >= limit) {
          if (!executionBlocked) stopReason = 'limit'
          // 한 페이지 중간에서 한도에 닿으면 그 페이지를 다시 읽어 미처리 고아를 건너뛰지 않는다.
          nextContinuationToken = candidatePageTokens.get(candidate.remoteId)
          break
        }
        let claim: GeneratedImageDeletionClaim | undefined
        try {
          if (await dependencies.hasDatabaseAsset(candidate.remoteId)) { existingCount++; continue }
          if (await dependencies.hasActiveJob(candidate.userId)) { activeJobCount++; continue }
          candidateRemoteIds.push(candidate.remoteId)
          if (!execute || executionBlocked) continue

          // 조회 이후의 DB 연결·새 생성 시작을 다시 확인하고 unique CF 번호로 삭제 임대를 만든다.
          if (await dependencies.hasDatabaseAsset(candidate.remoteId)) { racedCount++; continue }
          if (await dependencies.hasActiveJob(candidate.userId)) { activeJobCount++; continue }
          try { claim = await dependencies.createDeletionClaim(candidate, operationTime()) }
          catch (error) {
            if (isUniqueConflict(error)) { racedCount++; continue }
            throw error
          }
          if (await dependencies.hasActiveJob(candidate.userId)) {
            activeJobCount++
            await dependencies.releaseClaim(claim, operationTime())
            continue
          }
          await dependencies.deleteImage(candidate.remoteId)
          const removed = await dependencies.removeClaim(claim)
          if (removed.count !== 1) throw new Error('삭제 임대가 바뀌어 기록을 유지합니다.')
          deletedRemoteIds.push(candidate.remoteId)
        } catch {
          failedRemoteIds.push(candidate.remoteId)
          if (claim) await dependencies.releaseClaim(claim, operationTime()).catch(() => undefined)
        }
      }
      return { candidateCount: candidateRemoteIds.length, deletedCount: deletedRemoteIds.length, candidateRemoteIds, deletedRemoteIds, failedRemoteIds, pagesRead, scannedCount, invalidCount, duplicateCount, existingCount, activeJobCount, racedCount, stopReason, executionBlocked, nextContinuationToken: executionBlocked ? options.continuationToken : nextContinuationToken }
    },
  }
}

export const cloudflareOrphanCleanupService = createCloudflareOrphanCleanupService({
  listImages: (token) => cloudflareImagesClient.listImages(token),
  hasDatabaseAsset: async (remoteId) => Boolean(await prisma.imageAsset.findUnique({ where: { cloudflareImageId: remoteId }, select: { id: true } })),
  hasActiveJob: async (userId) => Boolean(await prisma.aiPreviewJob.findFirst({ where: { userId, status: { in: ['queued', 'processing'] } }, select: { id: true } })),
  createDeletionClaim: async (candidate, now) => {
    const leaseUntil = new Date(now.getTime() + GENERATED_IMAGE_DELETION_LEASE_MS)
    // 일반 create wrapper는 permanent로 맞추므로 삭제 전용 기록은 직접 만든다.
    const asset = await prisma.imageAsset.create({ data: {
      userId: candidate.userId, cloudflareImageId: candidate.remoteId, kind: 'outfitGenerated', uploadStatus: 'ready', retention: 'deleting', expiresAt: leaseUntil,
      storageFilename: candidate.storageFilename, createdAt: candidate.uploadedAt, updatedAt: now,
      metadata: { purpose: 'cloudflareOrphanCleanup', userId: candidate.userId, kind: 'outfitGenerated', storageFilename: candidate.storageFilename, ...(candidate.model ? { model: candidate.model } : {}) },
    } })
    return { asset, leaseUntil }
  },
  removeClaim: (claim) => imageRepository.removeClaimedGeneratedPreview(claim),
  releaseClaim: (claim, now) => imageRepository.releaseGeneratedPreviewCleanup(claim, now),
  deleteImage: (remoteId) => cloudflareImagesClient.deleteImage(remoteId),
})
