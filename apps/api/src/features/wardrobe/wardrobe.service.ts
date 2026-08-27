import type {
  ClassificationStatus,
  ClothingCategory,
  ColorMode,
  Season,
  Prisma,
} from '@prisma/client'
import type { FashionItemAttributes } from '@closet/types'
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
  additionalCategories?: ClothingCategory[]
  subcategory?: string | null
  colorName?: string | null
  colorDetailName?: string | null
  colorHex?: string | null
  colorMode?: ColorMode | null
  fashionAttributes?: FashionItemAttributes | null
  seasons?: Season[]
  tags?: string[]
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

const fashionAttributeValues = {
  layerRole: ['base', 'mid', 'outer', 'single', 'unknown'],
  silhouette: ['slim', 'regular', 'relaxed', 'oversized', 'unknown'],
  pattern: ['solid', 'stripe', 'check', 'graphic', 'floral', 'other', 'unknown'],
  material: ['cotton', 'denim', 'knit', 'wool', 'leather', 'linen', 'synthetic', 'other', 'unknown'],
  texture: ['smooth', 'twill', 'corduroy', 'ribbed', 'cableKnit', 'fuzzy', 'boucle', 'quilted', 'suede', 'glossy', 'distressed', 'other', 'unknown'],
  warmth: ['light', 'medium', 'heavy', 'unknown'],
} as const

function normalizeFashionAttributes(
  value: FashionItemAttributes | null | undefined,
  category: ClothingCategory | null | undefined,
) {
  if (!value) return undefined

  const isValid =
    fashionAttributeValues.layerRole.includes(value.layerRole) &&
    fashionAttributeValues.silhouette.includes(value.silhouette) &&
    fashionAttributeValues.pattern.includes(value.pattern) &&
    fashionAttributeValues.material.includes(value.material) &&
    (value.texture === undefined ||
      fashionAttributeValues.texture.includes(value.texture)) &&
    fashionAttributeValues.warmth.includes(value.warmth) &&
    Number.isFinite(value.formality) &&
    value.formality >= 0 &&
    value.formality <= 1 &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1

  if (!isValid) {
    throw new ServiceError(
      'AI 패션 속성값이 올바르지 않습니다.',
      'INVALID_FASHION_ATTRIBUTES',
    )
  }

  const fixedLayerRole =
    category === 'outer'
      ? 'outer'
      : category === 'midlayer'
        ? 'mid'
        : category === 'top'
          ? value.layerRole === 'outer' || value.layerRole === 'single'
            ? 'base'
            : value.layerRole
          : category
            ? 'single'
            : value.layerRole

  return {
    ...value,
    texture: value.texture ?? 'unknown',
    layerRole: fixedLayerRole,
    formality: Math.round(value.formality * 100) / 100,
    confidence: Math.round(value.confidence * 100) / 100,
  } satisfies FashionItemAttributes
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

interface WardrobeWearHistoryRecord {
  date: Date
  outfit: { items: Array<{ wardrobeItemId: string }> } | null
}

export function getWardrobeWearStats(records: WardrobeWearHistoryRecord[]) {
  const datesByItemId = new Map<string, Map<number, Date>>()

  for (const record of records) {
    for (const item of record.outfit?.items ?? []) {
      const dates = datesByItemId.get(item.wardrobeItemId) ?? new Map()
      dates.set(record.date.getTime(), record.date)
      datesByItemId.set(item.wardrobeItemId, dates)
    }
  }

  return new Map(
    [...datesByItemId].map(([itemId, dates]) => {
      const wornDates = [...dates.values()].sort(
        (left, right) => left.getTime() - right.getTime(),
      )
      return [
        itemId,
        {
          wearCount: wornDates.length,
          lastWornAt: wornDates.at(-1) ?? null,
        },
      ]
    }),
  )
}

export function getKoreaTodayUtc() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const valueByType = new Map(parts.map((part) => [part.type, part.value]))

  return new Date(
    Date.UTC(
      Number(valueByType.get('year')),
      Number(valueByType.get('month')) - 1,
      Number(valueByType.get('day')),
    ),
  )
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

function normalizeTags(tags: string[] | undefined) {
  const normalizedTags: string[] = []
  const normalizedTagSet = new Set<string>()

  for (const value of tags ?? []) {
    const tag = value
      .normalize('NFKC')
      .replace(/^#+/, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!tag) continue
    if (tag.length > 15) {
      throw new ServiceError(
        '태그는 15자 이내로 입력해주세요.',
        'INVALID_WARDROBE_TAGS',
      )
    }

    const normalizedKey = tag.toLocaleLowerCase('ko-KR')
    if (normalizedTagSet.has(normalizedKey)) continue

    normalizedTagSet.add(normalizedKey)
    normalizedTags.push(tag)
  }

  if (normalizedTags.length > 5) {
    throw new ServiceError(
      '태그는 다섯 개까지 추가할 수 있습니다.',
      'INVALID_WARDROBE_TAGS',
    )
  }

  return normalizedTags
}

function normalizeAdditionalCategories(
  category: ClothingCategory | null | undefined,
  additionalCategories: ClothingCategory[] | undefined,
) {
  const uniqueCategories = [...new Set(additionalCategories ?? [])].filter(
    (additionalCategory) => additionalCategory !== category,
  )

  if (!category && uniqueCategories.length > 0) {
    throw new ServiceError(
      '대표 카테고리를 먼저 선택해주세요.',
      'INVALID_WARDROBE_CATEGORIES',
    )
  }
  if (uniqueCategories.length > 2) {
    throw new ServiceError(
      '카테고리는 대표 카테고리를 포함해 세 개까지 선택할 수 있습니다.',
      'INVALID_WARDROBE_CATEGORIES',
    )
  }

  return uniqueCategories
}

async function requireWardrobeItem(userId: string, itemId: string) {
  const item = await wardrobeRepository.findById(userId, itemId)
  if (!item) {
    throw new ServiceError('옷장 아이템을 찾을 수 없습니다.', 'WARDROBE_ITEM_NOT_FOUND')
  }
  return item
}

export const wardrobeService = {
  async list(userId: string, filter: WardrobeFilter) {
    const [items, wearHistory] = await Promise.all([
      wardrobeRepository.findMany(userId, filter),
      wardrobeRepository.findWearHistory(userId, getKoreaTodayUtc()),
    ])
    const wearStats = getWardrobeWearStats(wearHistory)

    return items.map((item) => ({
      ...item,
      wearCount: wearStats.get(item.id)?.wearCount ?? 0,
      lastWornAt: wearStats.get(item.id)?.lastWornAt ?? null,
    }))
  },

  async get(userId: string, itemId: string) {
    const item = await requireWardrobeItem(userId, itemId)
    const history = await wardrobeRepository.findWearHistory(userId, getKoreaTodayUtc(), [itemId])
    const wear = getWardrobeWearStats(history).get(itemId)
    return { ...item, wearCount: wear?.wearCount ?? 0, lastWornAt: wear?.lastWornAt ?? null }
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
      additionalCategories: normalizeAdditionalCategories(
        input.category,
        input.additionalCategories,
      ),
      seasons: normalizeSeasons(input.seasons),
      tags: normalizeTags(input.tags),
      sizeLabel: normalizeSizeLabel(input.sizeLabel),
      colorDetailName: normalizeColorDetailName(input.colorDetailName),
      colorHex: normalizeColorHex(input.colorHex),
      fashionAttributes: normalizeFashionAttributes(
        input.fashionAttributes,
        input.category,
      ) as unknown as Prisma.InputJsonValue | undefined,
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
    const currentItem = await requireWardrobeItem(userId, itemId)
    if (input.name !== undefined && !input.name.trim()) {
      throw new ServiceError('아이템 이름을 입력해주세요.', 'INVALID_WARDROBE_ITEM')
    }
    validateGarmentMeasurements(input)

    const nextCategory =
      input.category === undefined ? currentItem.category : input.category
    const nextAdditionalCategories =
      input.additionalCategories === undefined
        ? currentItem.additionalCategories
        : input.additionalCategories

    return wardrobeRepository.update(itemId, {
      ...input,
      name: input.name?.trim(),
      additionalCategories: normalizeAdditionalCategories(
        nextCategory,
        nextAdditionalCategories,
      ),
      seasons:
        input.seasons === undefined
          ? undefined
          : normalizeSeasons(input.seasons),
      tags: input.tags === undefined ? undefined : normalizeTags(input.tags),
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
