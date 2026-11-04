import type { OutfitSource, Prisma, Season } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { aiTransaction } from '../../lib/ai/ai-storage.js'
import { lockGeneratedImageForReference } from '../image/image.repository.js'
import { ServiceError } from '../../graphql/errors.js'
import { createOutfitSnapshot, outfitSnapshotData, preservePlannerSnapshots } from './planner-outfit-snapshot.js'
import { outfitCompositionKey } from './outfit-composition.js'
import { lockWardrobeItemsForReference } from '../wardrobe/wardrobe-image-lifecycle.js'

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
    model: string | null
  }
}

type StoredOutfit = Prisma.OutfitGetPayload<{ include: typeof outfitInclude }>
type GenerationAttachment = { userId: string; imageAssetId: string; model: string | null }
export interface DetachedOutfitImage { id: string; cloudflareImageId: string }
export interface OutfitImageMutationResult { outfit: StoredOutfit; detachedAssets: DetachedOutfitImage[] }

/** 저장 전 연결 목록에서 새로 유지한 자산을 제외한 번호만 반환한다. 실제 삭제는 커밋 후 참조 검사를 거친다. */
function detachedImages(outfits: StoredOutfit[], retainedAssetId?: string | null): DetachedOutfitImage[] {
  const byId = new Map<string, DetachedOutfitImage>()
  for (const outfit of outfits) for (const generation of outfit.generations) {
    const asset = generation.imageAsset
    if (asset && asset.id !== retainedAssetId) byId.set(asset.id, { id: asset.id, cloudflareImageId: asset.cloudflareImageId })
  }
  return [...byId.values()]
}

/** 화면에서 보던 최신 완료 이미지 한 장을 선택한다. 저장할 때 남은 레거시 생성 연결은 정리한다. */
function currentPreview(outfit: StoredOutfit) {
  return outfit.generations.find((generation) => generation.status === 'completed' && generation.imageAsset)
}

/** 기존 이미지가 승격·유지될 때도 삭제 claim과 같은 자산 잠금을 사용한다. */
function currentAttachment(outfit: StoredOutfit): GenerationAttachment | undefined {
  const preview = currentPreview(outfit)
  return preview?.imageAssetId ? { userId: outfit.userId, imageAssetId: preview.imageAssetId, model: preview.model } : undefined
}

/** 새 이미지면 기존 연결을 전부 교체하고, 유지할 때는 최신 한 연결만 남긴다. */
function generationChanges(outfit: StoredOutfit, generation?: GenerationAttachment, reset = false) {
  const kept = reset ? undefined : currentPreview(outfit)
  return generation
    ? { deleteMany: {}, create: { ...generation, status: 'completed' as const, completedAt: new Date() } }
    : { deleteMany: kept ? { id: { not: kept.id } } : {} }
}

/** 첨부와 삭제 claim이 같은 자산 문서에 쓰도록 잠근다. 다른 계정의 이미지 연결도 차단한다. */
async function lockAttachment(tx: Prisma.TransactionClient, ownerId: string, generation?: GenerationAttachment) {
  if (!generation) return
  if (generation.userId !== ownerId) throw new ServiceError('내 이미지로만 코디를 저장할 수 있습니다.', 'OUTFIT_PREVIEW_NOT_FOUND')
  await lockGeneratedImageForReference(tx, ownerId, generation.imageAssetId)
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

  /** 코디와 첫 이미지 연결을 함께 저장한다. 옷·사진 정리와의 경합은 같은 트랜잭션에서 각 참조를 잠가 막는다. */
  create(data: CreateOutfitData) {
    return aiTransaction(async (tx) => {
      await lockWardrobeItemsForReference(tx, data.userId, data.items.map((item) => item.wardrobeItemId))
      await lockAttachment(tx, data.userId, data.generation)
      return tx.outfit.create({
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
    })
  },

  /** 옷 구성과 이미지 한 연결을 원자적으로 저장하고, 커밋 후 정리할 이전 자산 번호를 반환한다. */
  update(
    id: string,
    data: Pick<CreateOutfitData, 'name' | 'style' | 'seasons' | 'items'> & {
      resetGenerations: boolean
      generation?: CreateOutfitData['generation']
    },
  ) {
    return aiTransaction(async (tx): Promise<OutfitImageMutationResult> => {
      const current = await tx.outfit.findUniqueOrThrow({ where: { id }, include: outfitInclude })
      await preservePlannerSnapshots(tx, current)
      await lockWardrobeItemsForReference(tx, current.userId, data.items.map((item) => item.wardrobeItemId))
      const selected = data.generation ?? (data.resetGenerations ? undefined : currentAttachment(current))
      await lockAttachment(tx, current.userId, selected)
      const retainedAssetId = selected?.imageAssetId
      const outfit = await tx.outfit.update({
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
          generations: generationChanges(current, data.generation, data.resetGenerations),
        },
        include: outfitInclude,
      })
      return { outfit, detachedAssets: detachedImages([current], retainedAssetId) }
    })
  },

  /** 날짜 코디를 별도 코디북 행으로 복사한다. 같은 조합이 이미 있으면 그 코디를 반환하며 날짜나 기존 사진을 바꾸지 않는다. */
  copyPlannerOutfitToLookbook(
    id: string,
    generation?: CreateOutfitData['generation'],
  ) {
    return aiTransaction(async (tx): Promise<OutfitImageMutationResult> => {
      const current = await tx.outfit.findUniqueOrThrow({ where: { id }, include: outfitInclude })
      // 같은 날짜에서 동시에 복사해도 두 개의 코디북을 만들지 않도록 원본 행을 잠근다.
      await tx.outfit.update({ where: { id }, data: { updatedAt: new Date() } })
      const key = outfitCompositionKey(current.items.map((item) => item.wardrobeItemId))
      const candidates = await tx.outfit.findMany({
        where: { userId: current.userId, AND: current.items.map((item) => ({ items: { some: { wardrobeItemId: item.wardrobeItemId } } })) },
        include: outfitInclude,
      })
      const duplicate = candidates.find((candidate) => !candidate.plannerOnly
        && outfitCompositionKey(candidate.items.map((item) => item.wardrobeItemId)) === key)
      if (duplicate) return { outfit: duplicate, detachedAssets: [] }
      const data = outfitSnapshotData(current)
      if (generation) data.generation = generation
      const created = await createOutfitSnapshot(tx, data, false)
      const outfit = await tx.outfit.findUniqueOrThrow({ where: { id: created.id }, include: outfitInclude })
      return { outfit, detachedAssets: [] }
    })
  },

  /** 생성 이력을 쌓지 않고 현재 이미지 한 장으로 교체한다. 같은 자산을 다시 연결할 때는 삭제 후보에서 제외한다. */
  addGeneration(
    id: string,
    generation: NonNullable<CreateOutfitData['generation']>,
  ) {
    return aiTransaction(async (tx): Promise<OutfitImageMutationResult> => {
      const current = await tx.outfit.findUniqueOrThrow({ where: { id }, include: outfitInclude })
      await preservePlannerSnapshots(tx, current)
      await lockAttachment(tx, current.userId, generation)
      const outfit = await tx.outfit.update({
        where: { id },
        data: {
          source: 'ai',
          generations: generationChanges(current, generation),
        },
        include: outfitInclude,
      })
      return { outfit, detachedAssets: detachedImages([current], generation.imageAssetId) }
    })
  },

  /** 연결된 날짜는 각각 보존한 뒤 코디를 삭제한다. 파일 정리는 반환된 자산에 대해 커밋 이후 수행한다. */
  async remove(id: string) {
    return aiTransaction(async (tx): Promise<OutfitImageMutationResult> => {
      const current = await tx.outfit.findUniqueOrThrow({ where: { id }, include: outfitInclude })
      await preservePlannerSnapshots(tx, current)
      await tx.outfitGeneration.deleteMany({ where: { outfitId: id } })
      await tx.outfitItem.deleteMany({ where: { outfitId: id } })
      const outfit = await tx.outfit.delete({ where: { id }, include: outfitInclude })
      return { outfit, detachedAssets: detachedImages([current]) }
    })
  },
}
