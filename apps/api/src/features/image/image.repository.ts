import type {
  ImageAssetRetention,
  ImageAssetKind,
  ImageUploadStatus,
  ImageAsset,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { ServiceError } from '../../graphql/errors.js'
import { aiTransaction } from '../../lib/ai/ai-storage.js'

/** 미저장 생성 결과는 만들어진 시각부터 24시간이 지난 뒤 고아 정리 대상이 된다. 조회 만료 기한은 아니다. */
export const GENERATED_PREVIEW_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000
/** CF 삭제 요청과 DB 정리를 맡은 프로세스의 임대 시간. */
export const GENERATED_IMAGE_DELETION_LEASE_MS = 5 * 60 * 1000
/** 삭제 실패 기록을 다음 배치에서 다시 가져올 때까지 기다리는 시간. */
export const GENERATED_IMAGE_DELETION_RETRY_MS = 15 * 60 * 1000

const liveOutfitWhere = {
  OR: [
    { plannerOnly: false }, { plannerOnly: null }, { plannerOnly: { isSet: false } },
    { planEntries: { some: {} } },
  ],
} satisfies Prisma.OutfitWhereInput

const noLiveImageReferences = {
  wardrobeDisplayItems: { none: {} },
  wardrobeOriginalItems: { none: {} },
  outfitGenerations: { none: { outfit: { is: liveOutfitWhere } } },
} satisfies Prisma.ImageAssetWhereInput

/** 삭제 임대는 재시도 시각이 지났을 때만 다시 가져온다. */
function availableForDeletion(now: Date, orphanOnly: boolean): Prisma.ImageAssetWhereInput {
  return { OR: [
    {
      retention: { in: ['permanent', 'temporary'] },
      ...(orphanOnly ? { createdAt: { lte: new Date(now.getTime() - GENERATED_PREVIEW_ORPHAN_GRACE_MS) } } : {}),
    },
    { retention: 'deleting', OR: [{ expiresAt: { lte: now } }, { expiresAt: null }, { expiresAt: { isSet: false } }] },
  ] }
}

/** 생성 진행·임대 복구 중인 작업의 결과는 코디에 저장되지 않았어도 삭제하지 않는다. */
async function hasActivePreviewJob(tx: Prisma.TransactionClient, asset: ImageAsset) {
  const metadata = asset.metadata
  const remoteTombstone = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    && metadata.purpose === 'cloudflareOrphanCleanup'
  return Boolean(await tx.aiPreviewJob.findFirst({
    where: {
      status: { in: ['queued', 'processing'] },
      OR: [
        { imageAssetId: asset.id },
        ...(asset.aiPreviewJobId ? [{ id: asset.aiPreviewJobId }] : []),
        // 원격 무레코드 결과는 작업 ID가 없으므로 최초 inventory와 같은 계정 단위 보호를 재시도에도 유지한다.
        ...(remoteTombstone ? [{ userId: asset.userId }] : []),
      ],
    },
    select: { id: true },
  }))
}

export interface GeneratedImageDeletionClaim {
  asset: ImageAsset
  /** 삭제 임대 소유자를 구분한다. 오래된 작업은 새 임대의 DB 기록을 지우거나 연장할 수 없다. */
  leaseUntil: Date
}

/**
 * 코디·플래너가 생성 이미지를 연결하는 같은 트랜잭션에서 먼저 호출한다.
 * 이미지 행을 써서 삭제 claim과 서버 프로세스 간 경합을 직렬화하고 삭제 중인 결과 연결을 거절한다.
 */
export async function lockGeneratedImageForReference(tx: Prisma.TransactionClient, userId: string, assetId: string) {
  const where = {
    id: assetId, userId, kind: 'outfitGenerated', uploadStatus: 'ready',
    retention: { in: ['permanent', 'temporary'] },
  } satisfies Prisma.ImageAssetWhereInput
  const current = await tx.imageAsset.findFirst({ where, select: { id: true, updatedAt: true } })
  if (!current) throw new ServiceError('AI 코디 이미지가 정리 중이거나 존재하지 않습니다.', 'OUTFIT_PREVIEW_NOT_FOUND')
  const locked = await tx.imageAsset.updateMany({
    where: { ...where, updatedAt: current.updatedAt },
    // 같은 밀리초의 저장도 실제 행 변경이 되게 해 claim과의 쓰기 충돌이 항상 발생하도록 한다.
    data: { updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) },
  })
  if (locked.count !== 1) throw new ServiceError('AI 코디 이미지가 정리 중이거나 존재하지 않습니다.', 'OUTFIT_PREVIEW_NOT_FOUND')
}

/** 참조와 진행 작업을 같은 트랜잭션에서 다시 확인한 뒤 자산을 삭제 중으로 바꾼다. CF 요청은 이 트랜잭션 밖에서 수행한다. */
async function claimGeneratedImageDeletion(id: string, now: Date, userId?: string, orphanOnly = false): Promise<GeneratedImageDeletionClaim | null> {
  return aiTransaction(async (tx) => {
    const asset = await tx.imageAsset.findFirst({
      where: { id, ...(userId ? { userId } : {}), kind: 'outfitGenerated', uploadStatus: 'ready', ...noLiveImageReferences, AND: [availableForDeletion(now, orphanOnly)] },
    })
    if (!asset || await hasActivePreviewJob(tx, asset)) return null
    const leaseUntil = new Date(now.getTime() + GENERATED_IMAGE_DELETION_LEASE_MS)
    const claimed = await tx.imageAsset.updateMany({
      where: { id: asset.id, updatedAt: asset.updatedAt, kind: 'outfitGenerated', ...noLiveImageReferences, AND: [availableForDeletion(now, orphanOnly)] },
      data: { retention: 'deleting', expiresAt: leaseUntil, updatedAt: now },
    })
    if (claimed.count !== 1) return null
    // 살아 있는 코디 참조는 위에서 제외했다. 더 이상 날짜에 연결되지 않은 숨은 플래너 코디의 이미지 연결만 정리한다.
    await tx.outfitGeneration.deleteMany({ where: { imageAssetId: asset.id } })
    return { asset, leaseUntil }
  })
}

export interface CreateImageAssetData {
  userId: string
  aiPreviewJobId?: string
  cloudflareImageId: string
  kind: ImageAssetKind
  deliveryVariant?: string
  originalFilename?: string
  storageFilename: string
  mimeType?: string
  uploadStatus?: ImageUploadStatus
  retention?: ImageAssetRetention
  expiresAt?: Date | null
  deliveryUrl?: string | null
  metadata?: Prisma.InputJsonValue
}

export const imageRepository = {
  /** 생성 이미지에는 1시간 조회 제한을 두지 않는다. 미참조 결과의 24시간 정리는 createdAt으로 따로 판단한다. */
  create(data: CreateImageAssetData) {
    return prisma.imageAsset.create({ data: data.kind === 'outfitGenerated' ? { ...data, retention: 'permanent', expiresAt: null } : data })
  },

  /** 중단된 생성 작업의 저장된 결과를 찾는다. 과거 temporary의 만료 시각은 무시하되 삭제 중인 결과는 제외한다. */
  findByPreviewJob(userId: string, aiPreviewJobId: string) {
    return prisma.imageAsset.findFirst({ where: { userId, aiPreviewJobId, kind: 'outfitGenerated', uploadStatus: 'ready', retention: { in: ['permanent', 'temporary'] } } })
  },

  /**
   * 작업 TTL·확인 여부와 무관하게 계정의 같은 옷 구성·스타일로 만든 최신 이미지를 찾는다.
   * 메타데이터의 옷 ID는 중복·순서를 정규화하며 스타일은 앞뒤 공백과 빈 값을 정리해 비교한다.
   * JSON 경로 필터에 의존하지 않고 최신순 100개씩 조회하므로 오래된 결과도 페이지 제한 없이 찾는다.
   */
  async findLatestGeneratedPreviewForItems(userId: string, selectedItemIds: string[], style: string | null) {
    const requestedIds = [...new Set(selectedItemIds)].sort()
    if (requestedIds.length === 0) return null
    const requestedStyle = style?.trim() || null
    let cursor: string | undefined
    for (;;) {
      const assets: ImageAsset[] = await prisma.imageAsset.findMany({
        where: { userId, kind: 'outfitGenerated', uploadStatus: 'ready', retention: { in: ['permanent', 'temporary'] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      for (const asset of assets) {
        const metadata = asset.metadata
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) continue
        const itemIds = metadata.selectedItemIds
        if (!Array.isArray(itemIds) || itemIds.some((id) => typeof id !== 'string')) continue
        if (metadata.style != null && typeof metadata.style !== 'string') continue
        const normalizedIds = [...new Set(itemIds as string[])].sort()
        const storedStyle = typeof metadata.style === 'string' ? metadata.style.trim() || null : null
        if (storedStyle === requestedStyle && normalizedIds.length === requestedIds.length
          && normalizedIds.every((id, index) => id === requestedIds[index])) return asset
      }
      if (assets.length < 100) return null
      cursor = assets.at(-1)!.id
    }
  },

  findOwnedById(userId: string, id: string) {
    return prisma.imageAsset.findFirst({ where: { id, userId } })
  },

  findOwnedByIds(userId: string, ids: string[]) {
    return prisma.imageAsset.findMany({
      where: { id: { in: ids }, userId },
    })
  },

  /** 24시간 지난 미저장 결과와 재시도 가능한 삭제 실패를 페이지 단위로 읽는다. dry-run에서는 이 조회만 수행한다. */
  async findExpiredGeneratedPreviews(now: Date, limit: number, after?: { createdAt: Date; id: string }) {
    const activeJobs = await prisma.aiPreviewJob.findMany({ where: { status: { in: ['queued', 'processing'] } }, select: { id: true, imageAssetId: true } })
    const activeJobIds = activeJobs.map((job) => job.id)
    const activeAssetIds = activeJobs.flatMap((job) => job.imageAssetId ? [job.imageAssetId] : [])
    return prisma.imageAsset.findMany({
      where: {
        kind: 'outfitGenerated', uploadStatus: 'ready', ...noLiveImageReferences,
        AND: [
          availableForDeletion(now, true),
          ...(activeJobIds.length ? [{ OR: [{ aiPreviewJobId: null }, { aiPreviewJobId: { isSet: false } }, { aiPreviewJobId: { notIn: activeJobIds } }] }] : []),
          ...(activeAssetIds.length ? [{ id: { notIn: activeAssetIds } }] : []),
          ...(after ? [{ OR: [{ createdAt: { gt: after.createdAt } }, { createdAt: after.createdAt, id: { gt: after.id } }] }] : []),
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
    })
  },

  /** 배치 후보의 나이·참조·진행 작업을 다시 검사하고 삭제 임대를 얻는다. */
  claimExpiredGeneratedPreview(id: string, now: Date) {
    return claimGeneratedImageDeletion(id, now, undefined, true)
  },

  /** 교체·코디 삭제 뒤 남은 본인 이미지는 24시간을 기다리지 않고 참조가 없을 때 삭제 임대를 얻는다. */
  claimGeneratedImageDeletion(userId: string, id: string, now: Date) {
    return claimGeneratedImageDeletion(id, now, userId)
  },

  /** 남아 있는 ready 생성 결과의 예전 조회 만료를 해제한다. 미참조 결과의 24시간 정리는 createdAt으로 따로 판단한다. */
  markGeneratedPreviewPermanent(userId: string, id: string, _now?: Date) {
    return prisma.imageAsset.updateMany({
      where: {
        id,
        userId,
        kind: 'outfitGenerated',
        uploadStatus: 'ready',
        retention: { in: ['temporary', 'permanent'] },
      },
      data: { retention: 'permanent', expiresAt: null },
    })
  },

  /** 예전 저장 실패 rollback도 1시간 조회 기한은 되돌리지 않는다. 고아 정리는 이 값과 관계없이 생성 시각을 사용한다. */
  restoreGeneratedPreviewExpiration(id: string, _expiresAt?: Date) {
    return prisma.imageAsset.updateMany({
      where: {
        id,
        kind: 'outfitGenerated',
        uploadStatus: 'ready',
        retention: { in: ['temporary', 'permanent'] },
      },
      data: { retention: 'permanent', expiresAt: null },
    })
  },

  /** CF 또는 DB 정리가 실패하면 기록을 남기고 재시도 시각만 미룬다. 삭제 중인 원격 파일을 새 코디에 연결하지 못하게 유지한다. */
  releaseGeneratedPreviewCleanup(claim: GeneratedImageDeletionClaim, now = new Date()) {
    return prisma.imageAsset.updateMany({
      where: { id: claim.asset.id, kind: 'outfitGenerated', retention: 'deleting', expiresAt: claim.leaseUntil },
      data: { expiresAt: new Date(now.getTime() + GENERATED_IMAGE_DELETION_RETRY_MS) },
    })
  },

  /** CF 삭제 후 현재 임대와 참조 없음이 유지되는 자산 기록만 지운다. */
  removeClaimedGeneratedPreview(claim: GeneratedImageDeletionClaim) {
    return prisma.imageAsset.deleteMany({
      where: {
        id: claim.asset.id, kind: 'outfitGenerated', retention: 'deleting', expiresAt: claim.leaseUntil,
        wardrobeDisplayItems: { none: {} }, wardrobeOriginalItems: { none: {} }, outfitGenerations: { none: {} },
      },
    })
  },

  markReady(
    id: string,
    data: Pick<
      Prisma.ImageAssetUpdateInput,
      'uploadStatus' | 'originalFilename' | 'deliveryUrl'
    >,
  ) {
    return prisma.imageAsset.update({ where: { id }, data })
  },

  remove(id: string) {
    return prisma.imageAsset.delete({ where: { id } })
  },
}
