import type {
  ClassificationStatus,
  ClothingCategory,
  ColorMode,
  Season,
  Prisma,
} from '@prisma/client'
import type { FashionItemAttributes } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import { parseDateOnly } from '../../lib/date.js'
import { getKoreaDate } from '@closet/types/wardrobe-preferences'
import { imageRepository } from '../image/image.repository.js'
import {
  wardrobeRepository,
  type UpdateWardrobeItemData,
  type WardrobeFilter,
} from './wardrobe.repository.js'

export interface CreateWardrobeItemInput {
  name: string
  brandName?: string | null
  storageLocation?: string | null
  registrationRequestId?: string | null
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

export interface UpdateWardrobeItemInput
  extends Omit<UpdateWardrobeItemData, 'fashionAttributes'> {
  fashionAttributes?: FashionItemAttributes
}

/** 보관 위치는 공백을 정리하고, 생략은 유지·null과 빈 입력은 삭제로 처리한다. */
function normalizeStorageLocation(value: string | null | undefined) {
  if (value === undefined) return undefined
  const location = value?.normalize('NFKC').replace(/\s+/g, ' ').trim() ?? ''
  if (location.length > 40) throw new ServiceError('보관 위치는 40자 이내로 입력해주세요.', 'INVALID_STORAGE_LOCATION')
  return location || null
}

/** 미착용 사유와 재개일을 한 쌍으로 검증한다. 설정을 생략한 일반 정보 수정은 기존 보류를 유지한다. */
function normalizeWearPreference(input: UpdateWardrobeItemInput, current: {
  wearAvoidanceReason?: string | null; recommendationResumeOn?: string | null
}) {
  if (input.wearAvoidanceReason === undefined && input.recommendationResumeOn === undefined) return {}
  const reason = input.wearAvoidanceReason === undefined ? current.wearAvoidanceReason ?? null : input.wearAvoidanceReason
  const invalid = () => new ServiceError('안 입는 이유와 내일 이후의 재개 날짜를 확인해주세요.', 'INVALID_WEAR_PREFERENCE')
  if (reason !== null && !['hard_to_style', 'fit_issue', 'temporarily_unused'].includes(reason)) throw invalid()
  if (reason !== 'temporarily_unused') {
    if (input.recommendationResumeOn != null) throw invalid()
    return { wearAvoidanceReason: input.wearAvoidanceReason, recommendationResumeOn: null }
  }
  const resume = input.recommendationResumeOn === undefined && current.wearAvoidanceReason === reason
    ? current.recommendationResumeOn : input.recommendationResumeOn
  if (!resume || resume <= getKoreaDate()) throw invalid()
  try { parseDateOnly(resume, '추천 재개일') } catch { throw invalid() }
  return { wearAvoidanceReason: 'temporarily_unused' as const, recommendationResumeOn: resume }
}

const fashionAttributeValues = {
  layerRole: ['base', 'mid', 'outer', 'single', 'unknown'],
  silhouette: ['slim', 'regular', 'relaxed', 'oversized', 'unknown'],
  pattern: ['solid', 'stripe', 'check', 'graphic', 'floral', 'other', 'unknown'],
  material: ['cotton', 'denim', 'knit', 'wool', 'leather', 'linen', 'synthetic', 'other', 'unknown'],
  texture: ['smooth', 'twill', 'corduroy', 'ribbed', 'cableKnit', 'fuzzy', 'boucle', 'quilted', 'suede', 'glossy', 'distressed', 'other', 'unknown'],
  trimPresence: ['present', 'absent', 'unknown'],
  necklineStyle: ['crew', 'vNeck', 'mock', 'turtleneck', 'standCollar', 'collar', 'hood', 'scoop', 'boat', 'square', 'other', 'unknown'],
  frontOpeningStyle: ['none', 'buttons', 'halfButtons', 'zipper', 'halfZip', 'wrap', 'other', 'unknown'],
  pocketStyle: ['none', 'slant', 'welt', 'patch', 'cargo', 'kangaroo', 'zippered', 'mixed', 'unknown'],
  bottomLegShape: ['skinny', 'straight', 'wide', 'tapered', 'flared', 'unknown'],
  bottomWaistStyle: ['structured', 'elastic', 'drawstring', 'mixed', 'unknown'],
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
    (value.ribbedCuffs == null ||
      fashionAttributeValues.trimPresence.includes(value.ribbedCuffs)) &&
    (value.ribbedHem == null ||
      fashionAttributeValues.trimPresence.includes(value.ribbedHem)) &&
    (value.ribbedNeckline == null ||
      fashionAttributeValues.trimPresence.includes(value.ribbedNeckline)) &&
    (value.necklineStyle == null ||
      fashionAttributeValues.necklineStyle.includes(value.necklineStyle)) &&
    (value.frontOpeningStyle == null ||
      fashionAttributeValues.frontOpeningStyle.includes(value.frontOpeningStyle)) &&
    (value.pocketStyle == null ||
      fashionAttributeValues.pocketStyle.includes(value.pocketStyle)) &&
    (value.bottomLegShape == null ||
      fashionAttributeValues.bottomLegShape.includes(value.bottomLegShape)) &&
    (value.bottomWaistStyle == null ||
      fashionAttributeValues.bottomWaistStyle.includes(value.bottomWaistStyle)) &&
    (value.bottomFrontPleats == null ||
      fashionAttributeValues.trimPresence.includes(value.bottomFrontPleats)) &&
    fashionAttributeValues.warmth.includes(value.warmth) &&
    Number.isFinite(value.formality) &&
    value.formality >= 0 &&
    value.formality <= 1 &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1

  if (!isValid) {
    throw new ServiceError(
      'AI 패션 속성값이 올바르지 않아요.',
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

  const bottomStructure = category === 'bottom'
    ? {
        bottomLegShape: value.bottomLegShape ?? 'unknown',
        bottomWaistStyle: value.bottomWaistStyle ?? 'unknown',
        bottomFrontPleats: value.bottomFrontPleats ?? 'unknown',
      } as const
    : {}

  return {
    ...value,
    texture: value.texture ?? 'unknown',
    ribbedCuffs: value.ribbedCuffs ?? 'unknown',
    ribbedHem: value.ribbedHem ?? 'unknown',
    ribbedNeckline: value.ribbedNeckline ?? 'unknown',
    necklineStyle: value.necklineStyle ?? 'unknown',
    frontOpeningStyle: value.frontOpeningStyle ?? 'unknown',
    pocketStyle: value.pocketStyle ?? 'unknown',
    ...bottomStructure,
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
        `${label}는 0cm보다 크고 300cm 이하여야 해요.`,
        'INVALID_WARDROBE_SIZE',
      )
    }
  })
}

interface WardrobeWearHistoryRecord {
  date: Date
  wornAt?: Date | null
  wearTemperatureC?: number | null
  outfit: { items: Array<{ wardrobeItemId: string }> } | null
}

/** 실제 착용을 확인한 날짜를 중복 없이 집계한다. 마지막 착용일의 평균 기온은 그 날짜의 기록만 사용하며 누락을 과거 값으로 채우지 않는다. */
export function getWardrobeWearStats(records: WardrobeWearHistoryRecord[]) {
  const datesByItemId = new Map<string, Map<number, WardrobeWearHistoryRecord>>()

  for (const record of records) {
    if (!record.wornAt || !Number.isFinite(record.wornAt.getTime())) continue
    for (const item of record.outfit?.items ?? []) {
      const dates = datesByItemId.get(item.wardrobeItemId) ?? new Map()
      const previous = dates.get(record.date.getTime())
      if (!previous || record.wornAt.getTime() > (previous.wornAt?.getTime() ?? 0)) {
        dates.set(record.date.getTime(), record)
      }
      datesByItemId.set(item.wardrobeItemId, dates)
    }
  }

  return new Map(
    [...datesByItemId].map(([itemId, dates]) => {
      const wornDates = [...dates.values()].sort(
        (left, right) => left.date.getTime() - right.date.getTime(),
      )
      const last = wornDates.at(-1)
      return [
        itemId,
        {
          wearCount: wornDates.length,
          lastWornAt: last?.date ?? null,
          lastWornTemperatureC: last?.wearTemperatureC != null && Number.isFinite(last.wearTemperatureC) ? last.wearTemperatureC : null,
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

/** 브랜드명 앞뒤 공백과 연속 공백을 정리하며 빈 입력은 null로 저장한다. */
function normalizeBrandName(value: string | null | undefined) {
  if (value === null || value === undefined) return value
  const brandName = value.normalize('NFKC').replace(/\s+/g, ' ').trim()
  if (brandName.length > 50) {
    throw new ServiceError(
      '브랜드는 50자 이내로 입력해주세요.',
      'INVALID_WARDROBE_BRAND',
    )
  }
  return brandName || null
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
      '대표 색상은 #RRGGBB 형식이어야 해요.',
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
      '태그는 다섯 개까지 추가할 수 있어요.',
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
      '카테고리는 대표 카테고리를 포함해 세 개까지 선택할 수 있어요.',
      'INVALID_WARDROBE_CATEGORIES',
    )
  }

  return uniqueCategories
}

async function requireWardrobeItem(userId: string, itemId: string) {
  const item = await wardrobeRepository.findById(userId, itemId)
  if (!item) {
    throw new ServiceError('옷장 아이템을 찾을 수 없어요.', 'WARDROBE_ITEM_NOT_FOUND')
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

  /** 저장된 옷의 브랜드명을 중복 없이 정리해 브랜드 선택 목록으로 반환한다. */
  async listBrands(userId: string) {
    const rows = await wardrobeRepository.findBrandNames(userId)
    const brandByKey = new Map<string, string>()

    rows.forEach(({ brandName }) => {
      const normalizedBrand = normalizeBrandName(brandName)
      if (!normalizedBrand) return
      const key = normalizedBrand.toLocaleLowerCase('ko-KR')
      if (!brandByKey.has(key)) brandByKey.set(key, normalizedBrand)
    })

    return [...brandByKey.values()].sort((left, right) =>
      left.localeCompare(right, 'ko'),
    )
  },

  /** 같은 사용자에게 저장된 브랜드의 대소문자·공백·유니코드 표기를 함께 해제한다. 보관한 옷도 브랜드만 null로 바꾸며 변경한 옷 개수를 반환한다. */
  async deleteBrand(userId: string, brandName: string) {
    const brand = normalizeBrandName(brandName)
    if (!brand) {
      throw new ServiceError('삭제할 브랜드를 선택해주세요.', 'INVALID_WARDROBE_BRAND')
    }
    const key = brand.toLocaleLowerCase('ko-KR')
    const rows = await wardrobeRepository.findBrandNames(userId, true)
    const matchingNames = [...new Set(rows.flatMap((row) =>
      row.brandName && normalizeBrandName(row.brandName)?.toLocaleLowerCase('ko-KR') === key
        ? [row.brandName]
        : [],
    ))]
    if (matchingNames.length === 0) return 0
    const result = await wardrobeRepository.clearBrandName(userId, matchingNames)
    return result.count
  },

  /**
   * 새 옷을 저장하기 전에 이름·치수와 사용자 소유 이미지의 업로드 완료 여부를 확인한다.
   * 표시 자산은 wardrobeCutout PNG, 원본은 wardrobeOriginal이어야 하며, 생성 룩북 자산을 옷 사진으로 연결하지 않는다.
   */
  async create(userId: string, input: CreateWardrobeItemInput) {
    const name = input.name.trim()
    if (!name) {
      throw new ServiceError('아이템 이름을 입력해주세요.', 'INVALID_WARDROBE_ITEM')
    }
    validateGarmentMeasurements(input)

    const registrationRequestId = input.registrationRequestId?.toLowerCase()
    if (registrationRequestId != null) {
      if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(registrationRequestId)) {
        throw new ServiceError('등록 요청을 확인하지 못했어요. 사진을 다시 추가해주세요.', 'INVALID_REGISTRATION_REQUEST')
      }
      const existing = await wardrobeRepository.findByRegistrationRequest(userId, registrationRequestId)
      if (existing?.archivedAt) throw new ServiceError('이미 삭제된 등록이에요. 사진을 다시 추가해주세요.', 'WARDROBE_REGISTRATION_ARCHIVED')
      if (existing) return existing
    }

    const assetIds = [
      input.displayImageAssetId,
      input.originalImageAssetId,
    ].filter((id): id is string => Boolean(id))
    const assets = await imageRepository.findOwnedByIds(userId, assetIds)

    if (assets.length !== new Set(assetIds).size) {
      throw new ServiceError('등록할 이미지 자산을 찾을 수 없어요.', 'IMAGE_NOT_FOUND')
    }

    if (assets.some((asset) => asset.uploadStatus !== 'ready')) {
      throw new ServiceError(
        'Cloudflare 이미지 업로드 확인이 완료되지 않았어요.',
        'IMAGE_UPLOAD_NOT_READY',
      )
    }

    const displayAsset = assets.find((asset) => asset.id === input.displayImageAssetId)
    if (displayAsset?.kind !== 'wardrobeCutout' || displayAsset.mimeType !== 'image/png') {
      throw new ServiceError(
        '배경이 제거된 PNG 사진으로 다시 등록해주세요.',
        'WARDROBE_CUTOUT_REQUIRED',
      )
    }
    if (input.originalImageAssetId && assets.find((asset) => asset.id === input.originalImageAssetId)?.kind !== 'wardrobeOriginal') {
      throw new ServiceError('옷 원본 사진으로 업로드한 이미지만 연결할 수 있어요.', 'INVALID_IMAGE_KIND')
    }

    return wardrobeRepository.create({
      userId,
      ...input,
      registrationRequestId,
      name,
      brandName: normalizeBrandName(input.brandName),
      storageLocation: normalizeStorageLocation(input.storageLocation),
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
    input: UpdateWardrobeItemInput,
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
      ...normalizeWearPreference(input, currentItem),
      name: input.name?.trim(),
      brandName: normalizeBrandName(input.brandName),
      storageLocation: normalizeStorageLocation(input.storageLocation),
      fashionAttributes:
        input.fashionAttributes === undefined
          ? undefined
          : normalizeFashionAttributes(
              input.fashionAttributes,
              nextCategory,
            ) as unknown as Prisma.InputJsonValue,
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
