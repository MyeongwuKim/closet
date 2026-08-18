import type {
  ImageAssetKind,
  ImageUploadStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

export interface CreateImageAssetData {
  userId: string
  cloudflareImageId: string
  kind: ImageAssetKind
  deliveryVariant?: string
  originalFilename?: string
  storageFilename: string
  mimeType?: string
  uploadStatus?: ImageUploadStatus
  deliveryUrl?: string | null
  metadata?: Prisma.InputJsonValue
}

export const imageRepository = {
  create(data: CreateImageAssetData) {
    return prisma.imageAsset.create({ data })
  },

  findOwnedById(userId: string, id: string) {
    return prisma.imageAsset.findFirst({ where: { id, userId } })
  },

  findOwnedByIds(userId: string, ids: string[]) {
    return prisma.imageAsset.findMany({
      where: { id: { in: ids }, userId },
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
