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
  /** 생성 응답의 이미지 형식·크기를 확인해 저장한다. 조회 자체에 만료는 없고 미저장 고아는 생성 24시간 뒤 정리할 수 있다. */
  async storeGeneratedImage(
    userId: string,
    input: {
      imageBase64: string
      mimeType: string
      model: string
      metadata?: Prisma.InputJsonObject
      /** 이전 호출과의 호환 입력. 생성 결과의 24시간 고아 정리는 이 값과 별개다. */
      temporary?: boolean
      jobId?: string
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
        aiPreviewJobId: input.jobId,
        cloudflareImageId: uploaded.id,
        kind: 'outfitGenerated',
        uploadStatus: 'ready',
        retention: 'permanent',
        expiresAt: null,
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

  /** 코디 교체·삭제 뒤 참조가 없는 이미지만 claim 후 CF→DB 순서로 정리한다. 실패하면 기록을 남겨 배치에서 재시도한다. */
  async removeGeneratedImage(
    userId: string,
    asset: { id: string; cloudflareImageId: string },
  ) {
    const claim = await imageRepository.claimGeneratedImageDeletion(userId, asset.id, new Date())
    if (!claim) return
    try {
      await cloudflareImagesClient.deleteImage(claim.asset.cloudflareImageId)
      const removed = await imageRepository.removeClaimedGeneratedPreview(claim)
      if (removed.count !== 1) await imageRepository.releaseGeneratedPreviewCleanup(claim).catch(() => undefined)
    } catch {
      await imageRepository.releaseGeneratedPreviewCleanup(claim).catch(() => undefined)
    }
  },

  /** 본인의 준비된 생성 결과를 조회하고 모델·URL을 검증한다. 과거 1시간 조회 제한은 없으며, 고아 정리의 삭제 claim 전까지 읽을 수 있다. */
  async getGeneratedImage(userId: string, assetId: string) {
    const asset = await imageRepository.findOwnedById(userId, assetId)
    if (
      !asset ||
      asset.kind !== 'outfitGenerated' ||
      asset.uploadStatus !== 'ready' ||
      asset.retention === 'deleting' ||
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

    // 과거 조회 만료만 정리한다. 이 변경은 createdAt 기준의 24시간 고아 정리를 막지 않는다.
    if (asset.retention !== 'permanent' || asset.expiresAt != null) {
      await imageService.retainGeneratedPreview(userId, asset.id)
    }

    return {
      assetId: asset.id,
      imageUrl,
      mimeType: asset.mimeType,
      model,
      metadata,
      retention: 'permanent' as const,
    }
  },

  /** 내 생성 결과의 예전 조회 만료를 해제한다. 삭제 중·다른 종류·없는 자산은 거절하며, 고아 정리와는 별개다. */
  async retainGeneratedPreview(userId: string, assetId: string) {
    const result = await imageRepository.markGeneratedPreviewPermanent(
      userId,
      assetId,
    )
    if (result.count !== 1) {
      throw new ServiceError(
        '완성된 AI 코디 이미지를 찾을 수 없습니다.',
        'OUTFIT_PREVIEW_NOT_FOUND',
      )
    }
  },

  /** 예전 저장 실패 rollback도 1시간 조회 제한을 다시 만들지 않는다. 고아의 24시간 정리는 생성 시각으로 판단한다. */
  async restoreGeneratedPreviewExpiration(assetId: string) {
    await imageRepository.restoreGeneratedPreviewExpiration(
      assetId,
    )
  },

  /** 24시간 지난 미저장 고아와 이전 삭제 실패를 정리한다. 기본 dry-run은 후보만 읽으며 execute에서만 삭제 임대를 얻어 CF→DB 순서로 처리한다. */
  async cleanupExpiredGeneratedPreviews(options: {
    execute: boolean
    limit: number
    now?: Date
  }) {
    const now = options.now ?? new Date()
    let after: { createdAt: Date; id: string } | undefined
    let candidateCount = 0
    let deletedCount = 0
    const failedAssetIds: string[] = []
    while (candidateCount < options.limit) {
      const pageSize = Math.min(100, options.limit - candidateCount)
      const candidates = await imageRepository.findExpiredGeneratedPreviews(now, pageSize, after)
      if (candidates.length === 0) break
      candidateCount += candidates.length
      if (options.execute) {
        for (const candidate of candidates) {
          let claim: Awaited<ReturnType<typeof imageRepository.claimExpiredGeneratedPreview>> = null
          try {
            claim = await imageRepository.claimExpiredGeneratedPreview(candidate.id, options.now ?? new Date())
            if (!claim) continue
            await cloudflareImagesClient.deleteImage(claim.asset.cloudflareImageId)
            const removed = await imageRepository.removeClaimedGeneratedPreview(claim)
            if (removed.count === 1) deletedCount += 1
            else {
              failedAssetIds.push(candidate.id)
              await imageRepository.releaseGeneratedPreviewCleanup(claim, options.now ?? new Date()).catch(() => undefined)
            }
          } catch {
            failedAssetIds.push(candidate.id)
            if (claim) await imageRepository.releaseGeneratedPreviewCleanup(claim, options.now ?? new Date()).catch(() => undefined)
          }
        }
      }
      const last = candidates.at(-1)!
      after = { id: last.id, createdAt: last.createdAt }
      if (candidates.length < pageSize) break
    }
    return { candidateCount, deletedCount, failedAssetIds }
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
