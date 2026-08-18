import type {
  ClassificationStatus,
  ClothingCategory,
  ColorMode,
  Season,
} from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { imageRepository } from '../image/image.repository.js'
import {
  wardrobeRepository,
  type UpdateWardrobeItemData,
  type WardrobeFilter,
} from './wardrobe.repository.js'

export interface CreateWardrobeItemInput {
  name: string
  displayImageAssetId: string
  originalImageAssetId?: string | null
  category?: ClothingCategory | null
  subcategory?: string | null
  colorName?: string | null
  colorDetailName?: string | null
  colorHex?: string | null
  colorMode?: ColorMode | null
  seasons?: Season[]
  sizeLabel?: string | null
  shoulderWidthCm?: number | null
  chestWidthCm?: number | null
  sleeveLengthCm?: number | null
  totalLengthCm?: number | null
  waistWidthCm?: number | null
  hipWidthCm?: number | null
  inseamCm?: number | null
  thighWidthCm?: number | null
  riseCm?: number | null
  hemWidthCm?: number | null
  classificationStatus?: ClassificationStatus
  classificationConfidence?: number | null
  classificationModel?: string | null
}

const garmentMeasurementLabels = {
  shoulderWidthCm: '어깨너비',
  chestWidthCm: '가슴 단면',
  sleeveLengthCm: '소매 길이',
  totalLengthCm: '총장',
  waistWidthCm: '허리 단면',
  hipWidthCm: '엉덩이 단면',
  inseamCm: '인심',
  thighWidthCm: '허벅지 단면',
  riseCm: '밑위',
  hemWidthCm: '밑단 단면',
} as const

type GarmentMeasurementKey = keyof typeof garmentMeasurementLabels

function validateGarmentMeasurements(
  input: Partial<Record<GarmentMeasurementKey, number | null>>,
) {
  Object.entries(garmentMeasurementLabels).forEach(([key, label]) => {
    const value = input[key as GarmentMeasurementKey]
    if (value === null || value === undefined) return
    if (!Number.isFinite(value) || value <= 0 || value > 300) {
      throw new ServiceError(
        `${label}는 0cm보다 크고 300cm 이하여야 합니다.`,
        'INVALID_WARDROBE_SIZE',
      )
    }
  })
}

function normalizeSizeLabel(value: string | null | undefined) {
  if (value === null || value === undefined) return value
  const sizeLabel = value.trim()
  if (sizeLabel.length > 20) {
    throw new ServiceError(
      '표기 사이즈는 20자 이내로 입력해주세요.',
      'INVALID_WARDROBE_SIZE',
    )
  }
  return sizeLabel || null
}

function normalizeColorDetailName(value: string | null | undefined) {
  if (value === null || value === undefined) return value
  const colorDetailName = value.trim()
  if (colorDetailName.length > 30) {
    throw new ServiceError(
      '상세 색상명은 30자 이내로 입력해주세요.',
      'INVALID_WARDROBE_COLOR',
    )
  }
  return colorDetailName || null
}

function normalizeColorHex(value: string | null | undefined) {
  if (value === null || value === undefined) return value
  const colorHex = value.trim().toUpperCase()
  if (!/^#[0-9A-F]{6}$/.test(colorHex)) {
    throw new ServiceError(
      '대표 색상은 #RRGGBB 형식이어야 합니다.',
      'INVALID_WARDROBE_COLOR',
    )
  }
  return colorHex
}

function normalizeSeasons(seasons: Season[] | undefined) {
  const uniqueSeasons = [...new Set(seasons ?? [])]
  if (uniqueSeasons.length === 0) {
    throw new ServiceError(
      '입을 계절을 하나 이상 선택해주세요.',
      'INVALID_WARDROBE_SEASONS',
    )
  }
  return uniqueSeasons
}

async function requireWardrobeItem(userId: string, itemId: string) {
  const item = await wardrobeRepository.findById(userId, itemId)
  if (!item) {
    throw new ServiceError('옷장 아이템을 찾을 수 없습니다.', 'WARDROBE_ITEM_NOT_FOUND')
  }
  return item
}

export const wardrobeService = {
  list(userId: string, filter: WardrobeFilter) {
    return wardrobeRepository.findMany(userId, filter)
  },

  get(userId: string, itemId: string) {
    return requireWardrobeItem(userId, itemId)
  },

  async create(userId: string, input: CreateWardrobeItemInput) {
    const name = input.name.trim()
    if (!name) {
      throw new ServiceError('아이템 이름을 입력해주세요.', 'INVALID_WARDROBE_ITEM')
    }
    validateGarmentMeasurements(input)

    const assetIds = [
      input.displayImageAssetId,
      input.originalImageAssetId,
    ].filter((id): id is string => Boolean(id))
    const assets = await imageRepository.findOwnedByIds(userId, assetIds)

    if (assets.length !== new Set(assetIds).size) {
      throw new ServiceError('등록할 이미지 자산을 찾을 수 없습니다.', 'IMAGE_NOT_FOUND')
    }

    if (assets.some((asset) => asset.uploadStatus !== 'ready')) {
      throw new ServiceError(
        'Cloudflare 이미지 업로드 확인이 완료되지 않았습니다.',
        'IMAGE_UPLOAD_NOT_READY',
      )
    }

    return wardrobeRepository.create({
      userId,
      ...input,
      name,
      seasons: normalizeSeasons(input.seasons),
      sizeLabel: normalizeSizeLabel(input.sizeLabel),
      colorDetailName: normalizeColorDetailName(input.colorDetailName),
      colorHex: normalizeColorHex(input.colorHex),
      classificationStatus:
        input.classificationStatus ??
        (input.category ? 'classified' : 'pending'),
    })
  },

  async update(
    userId: string,
    itemId: string,
    input: UpdateWardrobeItemData,
  ) {
    await requireWardrobeItem(userId, itemId)
    if (input.name !== undefined && !input.name.trim()) {
      throw new ServiceError('아이템 이름을 입력해주세요.', 'INVALID_WARDROBE_ITEM')
    }
    validateGarmentMeasurements(input)

    return wardrobeRepository.update(itemId, {
      ...input,
      name: input.name?.trim(),
      seasons:
        input.seasons === undefined
          ? undefined
          : normalizeSeasons(input.seasons),
      sizeLabel: normalizeSizeLabel(input.sizeLabel),
      colorDetailName: normalizeColorDetailName(input.colorDetailName),
      colorHex: normalizeColorHex(input.colorHex),
    })
  },

  async archive(userId: string, itemId: string) {
    await requireWardrobeItem(userId, itemId)
    return wardrobeRepository.archive(itemId)
  },
}
