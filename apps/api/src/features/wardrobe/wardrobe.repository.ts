import type {
  ClassificationStatus,
  ClothingCategory,
  ColorMode,
  Prisma,
  Season,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import type { WearAvoidanceReason } from '@closet/types'
import { confirmedWearWhere } from '../planner/planner-wear.js'
import { aiTransaction, touchAiMutex } from '../../lib/ai/ai-storage.js'
import { randomUUID } from 'node:crypto'
import { ServiceError } from '../../graphql/errors.js'
import { lockWardrobeImagesForReference } from './wardrobe-image-lifecycle.js'

export const wardrobeItemInclude = {
  displayImageAsset: true,
  originalImageAsset: true,
} satisfies Prisma.WardrobeItemInclude

export interface WardrobeFilter {
  category?: ClothingCategory
  subcategory?: string
}

export interface CreateWardrobeItemData {
  userId: string
  name: string
  brandName?: string | null
  storageLocation?: string | null
  registrationRequestId?: string | null
  displayImageAssetId: string
  originalImageAssetId?: string | null
  category?: ClothingCategory | null
  additionalCategories: ClothingCategory[]
  subcategory?: string | null
  colorName?: string | null
  colorDetailName?: string | null
  colorHex?: string | null
  colorMode?: ColorMode | null
  fashionAttributes?: Prisma.InputJsonValue
  seasons: Season[]
  tags: string[]
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

export interface UpdateWardrobeItemData {
  name?: string
  brandName?: string | null
  storageLocation?: string | null
  wearAvoidanceReason?: WearAvoidanceReason | null
  recommendationResumeOn?: string | null
  category?: ClothingCategory | null
  additionalCategories?: ClothingCategory[]
  subcategory?: string | null
  colorName?: string | null
  colorDetailName?: string | null
  colorHex?: string | null
  colorMode?: ColorMode | null
  fashionAttributes?: Prisma.InputJsonValue
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
}

const activeWardrobeItemFilter = {
  OR: [
    { archivedAt: null },
    { archivedAt: { isSet: false } },
  ],
} satisfies Prisma.WardrobeItemWhereInput

export const wardrobeRepository = {
  /** 재시도를 같은 사용자의 등록 요청에 연결하며 다른 계정의 결과는 반환하지 않는다. */
  findByRegistrationRequest(userId: string, registrationRequestId: string) {
    return prisma.wardrobeItem.findFirst({ where: { userId, registrationRequestId }, include: wardrobeItemInclude })
  },
  findMany(userId: string, filter: WardrobeFilter) {
    return prisma.wardrobeItem.findMany({
      where: {
        userId,
        AND: [
          activeWardrobeItemFilter,
          filter.category
            ? {
                OR: [
                  { category: filter.category },
                  { additionalCategories: { has: filter.category } },
                ],
              }
            : {},
        ],
        subcategory: filter.subcategory,
      },
      include: wardrobeItemInclude,
      orderBy: { createdAt: 'desc' },
    })
  },

  /** 오늘까지의 일정 중 사용자가 실제 착용을 확인한 기록만 읽는다. 배정만 된 일정은 포함하지 않는다. */
  findWearHistory(userId: string, throughDate: Date, itemIds?: string[]) {
    return prisma.plannerEntry.findMany({
      where: {
        ...confirmedWearWhere,
        date: { lte: throughDate },
        outfitId: { not: null },
        plannerWeek: { is: { userId } },
        ...(itemIds ? { outfit: { is: { items: { some: { wardrobeItemId: { in: itemIds } } } } } } : {}),
      },
      select: {
        date: true,
        wornAt: true,
        outfit: {
          select: {
            items: { select: { wardrobeItemId: true } },
          },
        },
      },
    })
  },

  /** 사용자가 저장한 브랜드명만 조회한다. 브랜드 삭제에서는 includeArchived로 보관한 옷의 이름도 확인한다. */
  findBrandNames(userId: string, includeArchived = false) {
    return prisma.wardrobeItem.findMany({
      where: { userId, ...(!includeArchived ? activeWardrobeItemFilter : {}) },
      select: { brandName: true },
    })
  },

  /** 해당 사용자의 옷에서 전달받은 원래 브랜드명과 일치하는 브랜드 정보만 비운다. 보관 여부와 옷 분류·이미지·코디 연결은 변경하지 않는다. */
  clearBrandName(userId: string, brandNames: string[]) {
    return prisma.wardrobeItem.updateMany({
      where: { userId, brandName: { in: brandNames } },
      data: { brandName: null },
    })
  },

  findById(userId: string, id: string) {
    return prisma.wardrobeItem.findFirst({
      where: { id, userId, ...activeWardrobeItemFilter },
      include: wardrobeItemInclude,
    })
  },

  findManyOwnedByIds(userId: string, ids: string[]) {
    return prisma.wardrobeItem.findMany({
      where: {
        id: { in: ids },
        userId,
        ...activeWardrobeItemFilter,
      },
    })
  },

  findManyOwnedWithImagesByIds(userId: string, ids: string[]) {
    return prisma.wardrobeItem.findMany({
      where: {
        id: { in: ids },
        userId,
        ...activeWardrobeItemFilter,
      },
      include: wardrobeItemInclude,
    })
  },

  /** 같은 사진을 다른 옷에 연결할 때도 삭제 claim과 직렬화해 정리 중인 사진의 재사용을 거절한다. */
  create(data: CreateWardrobeItemData) {
    return aiTransaction(async (tx) => {
      // 같은 요청의 동시 전송을 직렬화하고 이미지 참조를 새로 만들기 전에 기존 등록을 확인한다.
      if (data.registrationRequestId) {
        await touchAiMutex(tx, `wardrobe-registration:${data.userId}:${data.registrationRequestId}`, randomUUID(), new Date())
        const existing = await tx.wardrobeItem.findFirst({ where: { userId: data.userId, registrationRequestId: data.registrationRequestId }, include: wardrobeItemInclude })
        if (existing?.archivedAt) throw new ServiceError('이미 삭제된 등록이에요. 사진을 다시 추가해주세요.', 'WARDROBE_REGISTRATION_ARCHIVED')
        if (existing) return existing
      }
      await lockWardrobeImagesForReference(tx, data.userId, [data.displayImageAssetId, ...(data.originalImageAssetId ? [data.originalImageAssetId] : [])])
      return tx.wardrobeItem.create({
        data: { ...data, archivedAt: null },
        include: wardrobeItemInclude,
      })
    })
  },

  update(id: string, data: UpdateWardrobeItemData) {
    return prisma.wardrobeItem.update({
      where: { id },
      data,
      include: wardrobeItemInclude,
    })
  },

  archive(id: string) {
    return prisma.wardrobeItem.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: wardrobeItemInclude,
    })
  },
}
