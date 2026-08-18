import { randomUUID } from 'node:crypto'
import type { ImageAssetKind } from '@prisma/client'
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
  async storeGeneratedImage(
    userId: string,
    input: { imageBase64: string; mimeType: string; model: string },
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
        deliveryVariant: variant,
        deliveryUrl,
        storageFilename,
        originalFilename: storageFilename,
        mimeType: input.mimeType,
        metadata: { model: input.model },
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
