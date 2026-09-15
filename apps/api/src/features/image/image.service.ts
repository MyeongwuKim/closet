import { randomUUID } from 'node:crypto'
import type { ImageAssetKind, Prisma } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { cloudflareImagesClient } from './cloudflare-images.client.js'
import { imageRepository } from './image.repository.js'

const mimeTypeExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_GENERATED_IMAGE_BYTES = 10 * 1024 * 1024
export const OUTFIT_PREVIEW_RETENTION_MS = 60 * 60 * 1000

export interface PrepareImageUploadInput {
  kind: ImageAssetKind
  originalFilename?: string
  mimeType: string
}

function createStorageFilename(input: PrepareImageUploadInput) {
  const koreaTime = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const date = koreaTime.toISOString().slice(0, 10).replaceAll('-', '')
  const time = koreaTime.toISOString().slice(11, 19).replaceAll(':', '')
  const suffix = randomUUID().slice(0, 8)
  const extension = mimeTypeExtensions[input.mimeType]

  if (!extension || !mimeTypeExtensions[input.mimeType]) {
    throw new ServiceError(
      'JPEG, PNG, WEBP 이미지만 업로드할 수 있습니다.',
      'INVALID_IMAGE_TYPE',
    )
  }

  return `closet_dev_${date}_${time}_${suffix}.${extension}`
}

function decodeGeneratedImage(imageBase64: string, mimeType: string) {
  if (!mimeTypeExtensions[mimeType] || !/^[A-Za-z0-9+/=\s]+$/.test(imageBase64)) {
    throw new ServiceError(
      '저장할 AI 이미지 형식이 올바르지 않습니다.',
      'INVALID_GENERATED_IMAGE',
    )
  }

  const bytes = Buffer.from(imageBase64.replaceAll(/\s/g, ''), 'base64')
  const isJpeg =
    mimeType === 'image/jpeg' &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  const isPng =
    mimeType === 'image/png' &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isWebp =
    mimeType === 'image/webp' &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'

  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_GENERATED_IMAGE_BYTES ||
    (!isJpeg && !isPng && !isWebp)
  ) {
    throw new ServiceError(
      '저장할 AI 이미지 형식이 올바르지 않습니다.',
      'INVALID_GENERATED_IMAGE',
    )
  }

  return bytes
}

export function getImageDeliveryUrl(cloudflareImageId: string) {
  const accountHash = process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH
  const variant = process.env.CLOUDFLARE_IMAGES_VARIANT ?? 'public'

  if (!accountHash) return null
  return `https://imagedelivery.net/${accountHash}/${cloudflareImageId}/${variant}`
}

export const imageService = {
  async storeGeneratedImage(
    userId: string,
    input: {
      imageBase64: string
      mimeType: string
      model: string
      metadata?: Prisma.InputJsonObject
      temporary?: boolean
    },
  ) {
    const bytes = decodeGeneratedImage(input.imageBase64, input.mimeType)
    const storageFilename = createStorageFilename({
      kind: 'outfitGenerated',
      mimeType: input.mimeType,
    })
    const uploaded = await cloudflareImagesClient.uploadImage({
      userId,
      kind: 'outfitGenerated',
      bytes,
      mimeType: input.mimeType,
      storageFilename,
      metadata: { model: input.model },
    })
    const variant = process.env.CLOUDFLARE_IMAGES_VARIANT ?? 'public'
    const deliveryUrl =
      uploaded.variants?.find((url) => url.endsWith(`/${variant}`)) ??
      uploaded.variants?.[0] ??
      getImageDeliveryUrl(uploaded.id)

    try {
      return await imageRepository.create({
        userId,
        cloudflareImageId: uploaded.id,
        kind: 'outfitGenerated',
        uploadStatus: 'ready',
        retention: input.temporary ? 'temporary' : 'permanent',
        expiresAt: input.temporary
          ? new Date(Date.now() + OUTFIT_PREVIEW_RETENTION_MS)
          : null,
        deliveryVariant: variant,
        deliveryUrl,
        storageFilename,
        originalFilename: storageFilename,
        mimeType: input.mimeType,
        metadata: { ...input.metadata, model: input.model },
      })
    } catch (error) {
      await cloudflareImagesClient.deleteImage(uploaded.id).catch(() => undefined)
      throw error
    }
  },

  async removeGeneratedImage(
    userId: string,
    asset: { id: string; cloudflareImageId: string },
  ) {
    const ownedAsset = await imageRepository.findOwnedById(userId, asset.id)
    if (!ownedAsset || ownedAsset.kind !== 'outfitGenerated') return

    await cloudflareImagesClient
      .deleteImage(asset.cloudflareImageId)
      .catch(() => undefined)
    await imageRepository.remove(asset.id).catch(() => undefined)
  },

  async getGeneratedImage(userId: string, assetId: string) {
    const asset = await imageRepository.findOwnedById(userId, assetId)
    if (
      !asset ||
      asset.kind !== 'outfitGenerated' ||
      asset.uploadStatus !== 'ready' ||
      asset.retention === 'deleting' ||
      (asset.retention === 'temporary' &&
        (!asset.expiresAt || asset.expiresAt.getTime() <= Date.now())) ||
      !asset.mimeType
    ) {
      throw new ServiceError(
        '완성된 AI 코디 이미지를 찾을 수 없습니다.',
        'OUTFIT_PREVIEW_NOT_FOUND',
      )
    }

    const metadata =
      asset.metadata &&
      typeof asset.metadata === 'object' &&
      !Array.isArray(asset.metadata)
        ? asset.metadata
        : null
    const model = metadata?.model
    const imageUrl =
      asset.deliveryUrl ?? getImageDeliveryUrl(asset.cloudflareImageId)

    if (typeof model !== 'string' || !model || !imageUrl) {
      throw new ServiceError(
        '완성된 AI 코디 이미지 정보를 불러오지 못했습니다.',
        'OUTFIT_PREVIEW_NOT_FOUND',
      )
    }

    return {
      assetId: asset.id,
      imageUrl,
      mimeType: asset.mimeType,
      model,
      metadata,
      retention: asset.retention,
    }
  },

  async retainGeneratedPreview(userId: string, assetId: string) {
    const result = await imageRepository.markGeneratedPreviewPermanent(
      userId,
      assetId,
      new Date(),
    )
    if (result.count !== 1) {
      throw new ServiceError(
        'AI 코디 미리보기의 보관 시간이 만료되었습니다. 다시 만들어주세요.',
        'OUTFIT_PREVIEW_EXPIRED',
      )
    }
  },

  async restoreGeneratedPreviewExpiration(assetId: string) {
    await imageRepository.restoreGeneratedPreviewExpiration(
      assetId,
      new Date(Date.now() + OUTFIT_PREVIEW_RETENTION_MS),
    )
  },

  async cleanupExpiredGeneratedPreviews({
    execute,
    limit,
    now = new Date(),
  }: {
    execute: boolean
    limit: number
    now?: Date
  }) {
    const candidates = await imageRepository.findExpiredGeneratedPreviews(
      now,
      limit,
    )
    if (!execute) {
      return {
        candidateCount: candidates.length,
        deletedCount: 0,
        failedAssetIds: [] as string[],
      }
    }

    let deletedCount = 0
    const failedAssetIds: string[] = []
    for (const candidate of candidates) {
      const claim = await imageRepository.claimExpiredGeneratedPreview(
        candidate.id,
        now,
      )
      if (claim.count !== 1) continue

      try {
        await cloudflareImagesClient.deleteImage(candidate.cloudflareImageId)
        const removed = await imageRepository.removeClaimedGeneratedPreview(
          candidate.id,
        )
        if (removed.count === 1) deletedCount += 1
      } catch {
        failedAssetIds.push(candidate.id)
        await imageRepository
          .releaseGeneratedPreviewCleanup(candidate.id)
          .catch(() => undefined)
      }
    }

    return {
      candidateCount: candidates.length,
      deletedCount,
      failedAssetIds,
    }
  },

  async prepareUpload(userId: string, input: PrepareImageUploadInput) {
    if (input.kind === 'outfitGenerated') {
      throw new ServiceError(
        'AI 생성 이미지는 서버 생성 작업에서만 저장할 수 있습니다.',
        'INVALID_IMAGE_KIND',
      )
    }

    const storageFilename = createStorageFilename(input)
    const directUpload = await cloudflareImagesClient.createDirectUpload({
      userId,
      kind: input.kind,
      originalFilename: input.originalFilename,
      storageFilename,
    })
    const asset = await imageRepository.create({
      userId,
      cloudflareImageId: directUpload.id,
      kind: input.kind,
      deliveryVariant: process.env.CLOUDFLARE_IMAGES_VARIANT ?? 'public',
      originalFilename: input.originalFilename,
      storageFilename,
      mimeType: input.mimeType,
    })

    return {
      asset,
      uploadUrl: directUpload.uploadURL,
      uploadFilename: storageFilename,
    }
  },

  async confirmUpload(userId: string, assetId: string) {
    const asset = await imageRepository.findOwnedById(userId, assetId)
    if (!asset) {
      throw new ServiceError('이미지 자산을 찾을 수 없습니다.', 'IMAGE_NOT_FOUND')
    }

    const details = await cloudflareImagesClient.getImageDetails(
      asset.cloudflareImageId,
    )
    const variant = asset.deliveryVariant ?? 'public'
    const deliveryUrl =
      details.variants?.find((url) => url.endsWith(`/${variant}`)) ??
      details.variants?.[0] ??
      null

    return imageRepository.markReady(asset.id, {
      uploadStatus: 'ready',
      originalFilename: asset.originalFilename ?? details.filename,
      deliveryUrl,
    })
  },
}
