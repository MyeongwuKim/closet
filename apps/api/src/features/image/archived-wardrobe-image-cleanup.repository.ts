import type { ImageAsset, Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { aiTransaction } from '../../lib/ai/ai-storage.js'
import { ServiceError } from '../../graphql/errors.js'
import { liveOutfitReferenceWhere, lockWardrobeReferenceMutexes } from '../wardrobe/wardrobe-image-lifecycle.js'
import { GENERATED_IMAGE_DELETION_LEASE_MS, GENERATED_IMAGE_DELETION_RETRY_MS } from './image.repository.js'

const cleanupPurpose = 'archivedWardrobeImageCleanup'
const photoKinds = ['wardrobeOriginal', 'wardrobeCutout'] as const

const itemSelect = {
  id: true, userId: true, archivedAt: true, updatedAt: true,
  outfitItems: { where: { outfit: { is: liveOutfitReferenceWhere } }, select: { id: true } },
} satisfies Prisma.WardrobeItemSelect

const assetInclude = {
  wardrobeDisplayItems: { select: itemSelect },
  wardrobeOriginalItems: { select: itemSelect },
  outfitGenerations: { select: { id: true } },
} satisfies Prisma.ImageAssetInclude

type AssetWithUsage = Prisma.ImageAssetGetPayload<{ include: typeof assetInclude }>
export interface ArchivedWardrobeImageDeletionClaim { asset: ImageAsset; leaseUntil: Date }
export interface ArchivedWardrobeImageCursor { createdAt: Date; id: string }

function isCleanupClaim(asset: ImageAsset) {
  const metadata = asset.metadata
  return Boolean(metadata && typeof metadata === 'object' && !Array.isArray(metadata) && metadata.purpose === cleanupPurpose)
}

function availableAt(asset: ImageAsset, now: Date) {
  return asset.retention === 'deleting'
    ? isCleanupClaim(asset) && (!asset.expiresAt || asset.expiresAt.getTime() <= now.getTime())
    : !asset.retention || asset.retention === 'permanent' || asset.retention === 'temporary'
}

function relatedItems(asset: AssetWithUsage) {
  return [...new Map([...asset.wardrobeDisplayItems, ...asset.wardrobeOriginalItems].map((item) => [item.id, item])).values()]
    .sort((left, right) => left.id.localeCompare(right.id))
}

/** 사진의 모든 연결을 확인한다. 보관 중인 옷·어느 날짜에서든 쓰는 코디·다른 소유자의 의심 연결은 정리하지 않는다. */
function unusedArchivedPhoto(asset: AssetWithUsage, protectedItemIds: Set<string>) {
  const items = relatedItems(asset)
  if (!items.length && !(asset.retention === 'deleting' && isCleanupClaim(asset))) return false
  if (asset.retention === 'deleting' && !isCleanupClaim(asset)) return false
  return asset.outfitGenerations.length === 0 && items.every((item) =>
    item.userId === asset.userId && item.archivedAt && item.outfitItems.length === 0 && !protectedItemIds.has(item.id),
  )
}

function availableWhere(now: Date): Prisma.ImageAssetWhereInput {
  return {
    kind: { in: [...photoKinds] }, uploadStatus: 'ready',
    OR: [
      {
        OR: [
          { wardrobeDisplayItems: { some: { archivedAt: { not: null } } } },
          { wardrobeOriginalItems: { some: { archivedAt: { not: null } } } },
        ],
      },
      { retention: 'deleting', OR: [{ expiresAt: { lte: now } }, { expiresAt: null }, { expiresAt: { isSet: false } }] },
    ],
  }
}

async function activeJobItems(tx: Pick<Prisma.TransactionClient, 'aiPreviewJob'>) {
  const jobs = await tx.aiPreviewJob.findMany({ where: { status: { in: ['queued', 'processing'] } }, select: { selectedItemIds: true } })
  return new Set(jobs.flatMap((job) => job.selectedItemIds))
}

export const archivedWardrobeImageCleanupRepository = {
  /** 기본 조회는 쓰기 없이 미사용 삭제 옷 사진을 찾는다. 보호된 사진이 한 페이지를 채워도 다음 페이지를 계속 읽는다. */
  async findCandidates(now: Date, limit: number, after?: ArchivedWardrobeImageCursor): Promise<ImageAsset[]> {
    const protectedItemIds = await activeJobItems(prisma)
    const candidates: ImageAsset[] = []
    let cursor = after
    while (candidates.length < limit) {
      const take = Math.min(100, limit - candidates.length)
      const page: AssetWithUsage[] = await prisma.imageAsset.findMany({
        where: {
          AND: [availableWhere(now), ...(cursor ? [{ OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] }] : [])],
        },
        include: assetInclude, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take,
      })
      if (!page.length) break
      for (const asset of page) if (availableAt(asset, now) && unusedArchivedPhoto(asset, protectedItemIds)) candidates.push(asset)
      const last = page.at(-1)!
      cursor = { createdAt: last.createdAt, id: last.id }
      if (page.length < take) break
    }
    return candidates
  },

  /** 삭제 직전 모든 옷·코디·작업 참조를 다시 확인하고 사진을 삭제 중으로 표시한다. CF 성공 전에는 옷의 사진 연결을 유지한다. */
  claim(id: string, now: Date): Promise<ArchivedWardrobeImageDeletionClaim | null> {
    return aiTransaction(async (tx) => {
      let asset = await tx.imageAsset.findFirst({ where: { id, ...availableWhere(now) }, include: assetInclude })
      if (!asset || !availableAt(asset, now) || !unusedArchivedPhoto(asset, await activeJobItems(tx))) return null
      await lockWardrobeReferenceMutexes(tx, { itemIds: relatedItems(asset).map((item) => item.id), assetIds: [asset.id] })
      asset = await tx.imageAsset.findFirst({ where: { id, ...availableWhere(now) }, include: assetInclude })
      if (!asset || !availableAt(asset, now) || !unusedArchivedPhoto(asset, await activeJobItems(tx))) return null
      const leaseUntil = new Date(now.getTime() + GENERATED_IMAGE_DELETION_LEASE_MS)
      const metadata = asset.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata) ? asset.metadata : {}
      const claimed = await tx.imageAsset.updateMany({
        where: { id, updatedAt: asset.updatedAt, ...availableWhere(now) },
        data: {
          retention: 'deleting', expiresAt: leaseUntil,
          updatedAt: new Date(Math.max(now.getTime(), asset.updatedAt.getTime() + 1)),
          metadata: { ...metadata, purpose: cleanupPurpose },
        },
      })
      return claimed.count === 1 ? { asset, leaseUntil } : null
    })
  },

  /** CF 삭제 후 현재 임대의 사진 연결과 자산만 원자적으로 해제한다. 삭제 옷의 메타데이터 행은 남긴다. */
  finalize(claim: ArchivedWardrobeImageDeletionClaim): Promise<{ count: number }> {
    return aiTransaction(async (tx) => {
      const where = { id: claim.asset.id, kind: { in: [...photoKinds] }, retention: 'deleting' as const, expiresAt: claim.leaseUntil }
      let asset = await tx.imageAsset.findFirst({ where, include: assetInclude })
      if (!asset || !isCleanupClaim(asset) || !unusedArchivedPhoto(asset, await activeJobItems(tx))) return { count: 0 }
      await lockWardrobeReferenceMutexes(tx, { itemIds: relatedItems(asset).map((item) => item.id), assetIds: [asset.id] })
      asset = await tx.imageAsset.findFirst({ where, include: assetInclude })
      if (!asset || !isCleanupClaim(asset) || !unusedArchivedPhoto(asset, await activeJobItems(tx))) return { count: 0 }
      const now = new Date()
      const locked = await tx.imageAsset.updateMany({ where: { ...where, updatedAt: asset.updatedAt }, data: { updatedAt: new Date(Math.max(now.getTime(), asset.updatedAt.getTime() + 1)) } })
      if (locked.count !== 1) return { count: 0 }
      const itemWhere = { userId: asset.userId, archivedAt: { not: null } }
      await tx.wardrobeItem.updateMany({ where: { ...itemWhere, displayImageAssetId: asset.id }, data: { displayImageAssetId: null } })
      await tx.wardrobeItem.updateMany({ where: { ...itemWhere, originalImageAssetId: asset.id }, data: { originalImageAssetId: null } })
      const removed = await tx.imageAsset.deleteMany({ where: {
        ...where, wardrobeDisplayItems: { none: {} }, wardrobeOriginalItems: { none: {} }, outfitGenerations: { none: {} },
      } })
      if (removed.count !== 1) throw new ServiceError('옷 사진의 사용 상태가 변경됐습니다.', 'WARDROBE_IMAGE_CLEANUP_CHANGED')
      return removed
    })
  },

  /** CF·DB 실패에는 파일 연결을 유지하고 같은 임대의 다음 재시도 시각만 예약한다. */
  release(claim: ArchivedWardrobeImageDeletionClaim, now: Date) {
    return prisma.imageAsset.updateMany({
      where: { id: claim.asset.id, kind: { in: [...photoKinds] }, retention: 'deleting', expiresAt: claim.leaseUntil },
      data: { expiresAt: new Date(now.getTime() + GENERATED_IMAGE_DELETION_RETRY_MS) },
    })
  },
}
