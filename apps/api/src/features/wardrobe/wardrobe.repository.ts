import type {
  ClassificationStatus,
  ClothingCategory,
  ColorMode,
  Prisma,
  Season,
} from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

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
  category?: ClothingCategory | null
  additionalCategories?: ClothingCategory[]
  subcategory?: string | null
  colorName?: string | null
  colorDetailName?: string | null
  colorHex?: string | null
  colorMode?: ColorMode | null
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

  findWearHistory(userId: string, throughDate: Date) {
    return prisma.plannerEntry.findMany({
      where: {
        date: { lte: throughDate },
        outfitId: { not: null },
        plannerWeek: { is: { userId } },
      },
      select: {
        date: true,
        outfit: {
          select: {
            items: { select: { wardrobeItemId: true } },
          },
        },
      },
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

  create(data: CreateWardrobeItemData) {
    return prisma.wardrobeItem.create({
      data: { ...data, archivedAt: null },
      include: wardrobeItemInclude,
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
