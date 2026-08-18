import type { OutfitSource, Prisma, Season } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

export const outfitInclude = {
  items: {
    include: {
      wardrobeItem: {
        include: {
          displayImageAsset: true,
          originalImageAsset: true,
        },
      },
    },
    orderBy: { layerOrder: 'asc' as const },
  },
  generations: {
    include: { imageAsset: true },
    orderBy: { requestedAt: 'desc' as const },
  },
} satisfies Prisma.OutfitInclude

export interface OutfitFilter {
  style?: string
  wardrobeItemIds?: string[]
}

export interface CreateOutfitData {
  userId: string
  name: string
  style: string
  seasons: Season[]
  source: OutfitSource
  plannerOnly?: boolean
  note?: string | null
  items: Array<{
    wardrobeItemId: string
    slot: Prisma.OutfitItemCreateWithoutOutfitInput['slot']
    layerOrder: number
  }>
  generation?: {
    userId: string
    imageAssetId: string
    model: string
  }
}

export const outfitRepository = {
  async findMany(userId: string, filter: OutfitFilter) {
    const itemFilters = (filter.wardrobeItemIds ?? []).map(
      (wardrobeItemId) => ({
        items: { some: { wardrobeItemId } },
      }),
    )

    const outfits = await prisma.outfit.findMany({
      where: {
        userId,
        style: filter.style,
        AND: itemFilters,
      },
      include: outfitInclude,
      orderBy: { createdAt: 'desc' },
    })
    return outfits.filter((outfit) => !outfit.plannerOnly)
  },

  findById(userId: string, id: string) {
    return prisma.outfit.findFirst({
      where: { id, userId },
      include: outfitInclude,
    })
  },

  async findSavedCandidatesByItems(
    userId: string,
    wardrobeItemIds: string[],
    excludeOutfitId?: string,
  ) {
    const outfits = await prisma.outfit.findMany({
      where: {
        userId,
        id: excludeOutfitId ? { not: excludeOutfitId } : undefined,
        AND: wardrobeItemIds.map((wardrobeItemId) => ({
          items: { some: { wardrobeItemId } },
        })),
      },
      include: outfitInclude,
    })
    return outfits.filter((outfit) => !outfit.plannerOnly)
  },

  create(data: CreateOutfitData) {
    return prisma.outfit.create({
      data: {
        userId: data.userId,
        name: data.name,
        style: data.style,
        seasons: data.seasons,
        source: data.source,
        plannerOnly: data.plannerOnly ?? false,
        note: data.note,
        items: { create: data.items },
        generations: data.generation
          ? {
              create: {
                userId: data.generation.userId,
                imageAssetId: data.generation.imageAssetId,
                status: 'completed',
                model: data.generation.model,
                completedAt: new Date(),
              },
            }
          : undefined,
      },
      include: outfitInclude,
    })
  },

  update(
    id: string,
    data: Pick<CreateOutfitData, 'name' | 'style' | 'seasons' | 'items'> & {
      resetGenerations: boolean
      generation?: CreateOutfitData['generation']
    },
  ) {
    return prisma.outfit.update({
      where: { id },
      data: {
        name: data.name,
        style: data.style,
        seasons: data.seasons,
        source: data.generation
          ? 'ai'
          : data.resetGenerations
            ? 'manual'
            : undefined,
        items: {
          deleteMany: {},
          create: data.items,
        },
        generations: data.generation
          ? {
              create: {
                userId: data.generation.userId,
                imageAssetId: data.generation.imageAssetId,
                status: 'completed',
                model: data.generation.model,
                completedAt: new Date(),
              },
            }
          : data.resetGenerations
            ? { deleteMany: {} }
            : undefined,
      },
      include: outfitInclude,
    })
  },

  promotePlannerOutfit(
    id: string,
    generation?: CreateOutfitData['generation'],
  ) {
    return prisma.outfit.update({
      where: { id },
      data: {
        plannerOnly: false,
        source: generation ? 'ai' : undefined,
        generations: generation
          ? {
              create: {
                userId: generation.userId,
                imageAssetId: generation.imageAssetId,
                status: 'completed',
                model: generation.model,
                completedAt: new Date(),
              },
            }
          : undefined,
      },
      include: outfitInclude,
    })
  },

  addGeneration(
    id: string,
    generation: NonNullable<CreateOutfitData['generation']>,
  ) {
    return prisma.outfit.update({
      where: { id },
      data: {
        source: 'ai',
        generations: {
          create: {
            userId: generation.userId,
            imageAssetId: generation.imageAssetId,
            status: 'completed',
            model: generation.model,
            completedAt: new Date(),
          },
        },
      },
      include: outfitInclude,
    })
  },

  async mergePlannerOnlyIntoSaved(
    sourceId: string,
    targetId: string,
    targetName: string,
  ) {
    await prisma.plannerEntry.updateMany({
      where: { outfitId: sourceId },
      data: { outfitId: targetId, title: targetName },
    })
    await prisma.outfitGeneration.updateMany({
      where: { outfitId: sourceId },
      data: { outfitId: targetId },
    })
    await prisma.outfitItem.deleteMany({ where: { outfitId: sourceId } })
    return prisma.outfit.delete({ where: { id: sourceId } })
  },

  async remove(id: string) {
    await prisma.plannerEntry.updateMany({
      where: { outfitId: id },
      data: { outfitId: null },
    })
    await prisma.outfitGeneration.deleteMany({ where: { outfitId: id } })
    await prisma.outfitItem.deleteMany({ where: { outfitId: id } })
    return prisma.outfit.delete({ where: { id }, include: outfitInclude })
  },
}
