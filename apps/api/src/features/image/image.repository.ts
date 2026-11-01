import type {
  ImageAssetRetention,
  ImageAssetKind,
  ImageUploadStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

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
  create(data: CreateImageAssetData) {
    return prisma.imageAsset.create({ data })
  },

  /** 업로드 저장 뒤 중단된 생성 작업에서 기존 이미지 자산을 찾아 재생성을 피한다. */
  findByPreviewJob(userId: string, aiPreviewJobId: string) {
    return prisma.imageAsset.findFirst({ where: { userId, aiPreviewJobId, uploadStatus: 'ready', OR: [{ retention: 'permanent' }, { retention: 'temporary', expiresAt: { gt: new Date() } }] } })
  },

  findOwnedById(userId: string, id: string) {
    return prisma.imageAsset.findFirst({ where: { id, userId } })
  },

  findOwnedByIds(userId: string, ids: string[]) {
    return prisma.imageAsset.findMany({
      where: { id: { in: ids }, userId },
    })
  },

  findExpiredGeneratedPreviews(now: Date, limit: number) {
    return prisma.imageAsset.findMany({
      where: {
        kind: 'outfitGenerated',
        retention: 'temporary',
        expiresAt: { lte: now },
        outfitGenerations: { none: {} },
      },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    })
  },

  claimExpiredGeneratedPreview(id: string, now: Date) {
    return prisma.imageAsset.updateMany({
      where: {
        id,
        kind: 'outfitGenerated',
        retention: 'temporary',
        expiresAt: { lte: now },
        outfitGenerations: { none: {} },
      },
      data: { retention: 'deleting' },
    })
  },

  markGeneratedPreviewPermanent(userId: string, id: string, now: Date) {
    return prisma.imageAsset.updateMany({
      where: {
        id,
        userId,
        kind: 'outfitGenerated',
        retention: 'temporary',
        expiresAt: { gt: now },
      },
      data: { retention: 'permanent', expiresAt: null },
    })
  },

  restoreGeneratedPreviewExpiration(id: string, expiresAt: Date) {
    return prisma.imageAsset.updateMany({
      where: {
        id,
        kind: 'outfitGenerated',
        retention: 'permanent',
        outfitGenerations: { none: {} },
      },
      data: { retention: 'temporary', expiresAt },
    })
  },

  releaseGeneratedPreviewCleanup(id: string) {
    return prisma.imageAsset.updateMany({
      where: { id, retention: 'deleting' },
      data: { retention: 'temporary' },
    })
  },

  removeClaimedGeneratedPreview(id: string) {
    return prisma.imageAsset.deleteMany({
      where: {
        id,
        kind: 'outfitGenerated',
        retention: 'deleting',
        outfitGenerations: { none: {} },
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
