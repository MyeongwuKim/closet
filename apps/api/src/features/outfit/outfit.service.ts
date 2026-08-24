import type { OutfitSource, Season } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { imageService } from '../image/image.service.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { hasCompleteOutfitBase } from './outfit-composition.js'
import { outfitRepository, type OutfitFilter } from './outfit.repository.js'

export interface CreateOutfitInput {
  name: string
  style: string
  seasons: Season[]
  source?: OutfitSource
  note?: string | null
  items: Array<{
    wardrobeItemId: string
    layerOrder: number
  }>
  previewImage?: {
    imageBase64: string
    mimeType: string
    model: string
  } | null
}

export type UpdateOutfitInput = Pick<
  CreateOutfitInput,
  'name' | 'style' | 'seasons' | 'items' | 'previewImage'
>

export interface PlannerOnlyOutfitInput {
  itemIds: string[]
  previewImage?: CreateOutfitInput['previewImage']
  name?: string | null
  style?: string | null
  source?: OutfitSource
}

interface SavedDuplicateMetadata {
  style: string
  source: OutfitSource
}

function normalizeSeasons(seasons: Season[], allowEmpty = false) {
  const uniqueSeasons = [...new Set(seasons)]
  if (!allowEmpty && uniqueSeasons.length === 0) {
    throw new ServiceError(
      '코디를 입을 계절을 하나 이상 선택해주세요.',
      'INVALID_OUTFIT_SEASONS',
    )
  }
  return uniqueSeasons
}

function getCommonSeasons(items: Array<{ seasons: Season[] }>) {
  if (items.length === 0 || items.some((item) => item.seasons.length === 0)) {
    return []
  }
  return items[0].seasons.filter((season) =>
    items.every((item) => item.seasons.includes(season)),
  )
}

async function requireOutfit(userId: string, outfitId: string) {
  const outfit = await outfitRepository.findById(userId, outfitId)
  if (!outfit) {
    throw new ServiceError('코디를 찾을 수 없습니다.', 'OUTFIT_NOT_FOUND')
  }
  return outfit
}

async function findSavedDuplicate(
  userId: string,
  itemIds: string[],
  excludeOutfitId?: string,
  metadata?: SavedDuplicateMetadata,
) {
  const uniqueItemIds = [...new Set(itemIds)]
  const candidates = await outfitRepository.findSavedCandidatesByItems(
    userId,
    uniqueItemIds,
    excludeOutfitId,
  )
  return candidates.find(
    (candidate) =>
      candidate.items.length === uniqueItemIds.length &&
      candidate.items.every((item) =>
        uniqueItemIds.includes(item.wardrobeItemId),
      ) &&
      (!metadata ||
        (candidate.style === metadata.style &&
          candidate.source === metadata.source)),
  )
}

async function addOutfitPreview(
  userId: string,
  outfitId: string,
  previewImage: NonNullable<CreateOutfitInput['previewImage']>,
) {
  await requireOutfit(userId, outfitId)
  const model = previewImage.model.trim()
  if (!model) {
    throw new ServiceError(
      'AI 이미지 생성 모델 정보가 없습니다.',
      'INVALID_GENERATED_IMAGE',
    )
  }

  const imageAsset = await imageService.storeGeneratedImage(userId, {
    ...previewImage,
    model,
  })
  try {
    return await outfitRepository.addGeneration(outfitId, {
      userId,
      imageAssetId: imageAsset.id,
      model,
    })
  } catch (error) {
    await imageService.removeGeneratedImage(userId, imageAsset)
    throw error
  }
}

export const outfitService = {
  list(userId: string, filter: OutfitFilter) {
    return outfitRepository.findMany(userId, {
      ...filter,
      wardrobeItemIds: [...new Set(filter.wardrobeItemIds ?? [])],
    })
  },

  get(userId: string, outfitId: string) {
    return requireOutfit(userId, outfitId)
  },

  findSavedDuplicate(
    userId: string,
    itemIds: string[],
    excludeOutfitId?: string,
    metadata?: SavedDuplicateMetadata,
  ) {
    return findSavedDuplicate(userId, itemIds, excludeOutfitId, metadata)
  },

  async addPreview(
    userId: string,
    outfitId: string,
    previewImage: NonNullable<CreateOutfitInput['previewImage']>,
  ) {
    return addOutfitPreview(userId, outfitId, previewImage)
  },

  async create(userId: string, input: CreateOutfitInput) {
    const name = input.name.trim()
    const style = input.style.trim().replaceAll(/\s+/g, ' ')
    const seasons = normalizeSeasons(input.seasons)
    const uniqueItemIds = [
      ...new Set(input.items.map(({ wardrobeItemId }) => wardrobeItemId)),
    ]

    if (!name) {
      throw new ServiceError('코디 이름을 입력해주세요.', 'INVALID_OUTFIT')
    }
    if (!style || style.length > 20) {
      throw new ServiceError(
        '코디 스타일은 20자 이내로 입력해주세요.',
        'INVALID_OUTFIT_STYLE',
      )
    }
    if (uniqueItemIds.length < 2 || uniqueItemIds.length !== input.items.length) {
      throw new ServiceError(
        '서로 다른 옷을 두 개 이상 선택해주세요.',
        'INVALID_OUTFIT_ITEMS',
      )
    }

    const wardrobeItems = await wardrobeRepository.findManyOwnedByIds(
      userId,
      uniqueItemIds,
    )
    if (
      wardrobeItems.length !== uniqueItemIds.length ||
      wardrobeItems.some((item) => !item.category)
    ) {
      throw new ServiceError(
        '분류가 완료된 내 옷장 아이템만 코디에 넣을 수 있습니다.',
        'INVALID_OUTFIT_ITEMS',
      )
    }
    if (
      !hasCompleteOutfitBase(
        wardrobeItems.map((item) => item.category!),
      )
    ) {
      throw new ServiceError(
        '상의나 아우터와 하의를 함께 선택해주세요. 원피스는 상·하의를 모두 대신할 수 있습니다.',
        'INCOMPLETE_OUTFIT_ITEMS',
      )
    }
    const duplicate = await findSavedDuplicate(userId, uniqueItemIds)
    if (duplicate) {
      throw new ServiceError(
        `같은 옷 조합이 이미 '${duplicate.name}' 코디로 저장되어 있습니다.`,
        'DUPLICATE_OUTFIT',
      )
    }

    const itemById = new Map(wardrobeItems.map((item) => [item.id, item]))
    const model = input.previewImage?.model.trim()
    if (input.previewImage && !model) {
      throw new ServiceError(
        'AI 이미지 생성 모델 정보가 없습니다.',
        'INVALID_GENERATED_IMAGE',
      )
    }

    const imageAsset = input.previewImage
      ? await imageService.storeGeneratedImage(userId, {
          ...input.previewImage,
          model: model!,
        })
      : null

    try {
      return await outfitRepository.create({
        userId,
        name,
        style,
        seasons,
        source: imageAsset ? 'ai' : (input.source ?? 'manual'),
        note: input.note?.trim() || null,
        items: input.items.map((item, index) => ({
          wardrobeItemId: item.wardrobeItemId,
          slot: itemById.get(item.wardrobeItemId)!.category!,
          layerOrder: Number.isInteger(item.layerOrder)
            ? item.layerOrder
            : index,
        })),
        generation: imageAsset
          ? {
              userId,
              imageAssetId: imageAsset.id,
              model: model!,
            }
          : undefined,
      })
    } catch (error) {
      if (imageAsset) {
        await imageService.removeGeneratedImage(userId, imageAsset)
      }
      throw error
    }
  },

  async createPlannerOnly(userId: string, input: PlannerOnlyOutfitInput) {
    const uniqueItemIds = [...new Set(input.itemIds)]
    if (uniqueItemIds.length < 2 || uniqueItemIds.length !== input.itemIds.length) {
      throw new ServiceError(
        '서로 다른 옷을 두 개 이상 선택해주세요.',
        'INVALID_OUTFIT_ITEMS',
      )
    }

    const wardrobeItems = await wardrobeRepository.findManyOwnedByIds(
      userId,
      uniqueItemIds,
    )
    if (
      wardrobeItems.length !== uniqueItemIds.length ||
      wardrobeItems.some((item) => !item.category)
    ) {
      throw new ServiceError(
        '분류가 완료된 내 옷장 아이템만 코디에 넣을 수 있습니다.',
        'INVALID_OUTFIT_ITEMS',
      )
    }
    if (!hasCompleteOutfitBase(wardrobeItems.map((item) => item.category!))) {
      throw new ServiceError(
        '상의나 아우터와 하의를 함께 선택해주세요.',
        'INCOMPLETE_OUTFIT_ITEMS',
      )
    }

    const model = input.previewImage?.model.trim()
    if (input.previewImage && !model) {
      throw new ServiceError(
        'AI 이미지 생성 모델 정보가 없습니다.',
        'INVALID_GENERATED_IMAGE',
      )
    }
    const imageAsset = input.previewImage
      ? await imageService.storeGeneratedImage(userId, {
          ...input.previewImage,
          model: model!,
        })
      : null
    const itemById = new Map(wardrobeItems.map((item) => [item.id, item]))
    const name = input.name?.trim() || '직접 고른 코디'
    const style = input.style?.trim() || '직접 구성'

    if (name.length > 50) {
      throw new ServiceError(
        '코디 이름은 50자 이내로 입력해주세요.',
        'INVALID_OUTFIT',
      )
    }
    if (style.length > 20) {
      throw new ServiceError(
        '코디 스타일은 20자 이내로 입력해주세요.',
        'INVALID_OUTFIT_STYLE',
      )
    }

    try {
      return await outfitRepository.create({
        userId,
        name,
        style,
        seasons: getCommonSeasons(wardrobeItems),
        source: input.source ?? (imageAsset ? 'ai' : 'manual'),
        plannerOnly: true,
        items: uniqueItemIds.map((wardrobeItemId, layerOrder) => ({
          wardrobeItemId,
          slot: itemById.get(wardrobeItemId)!.category!,
          layerOrder,
        })),
        generation: imageAsset
          ? {
              userId,
              imageAssetId: imageAsset.id,
              model: model!,
            }
          : undefined,
      })
    } catch (error) {
      if (imageAsset) {
        await imageService.removeGeneratedImage(userId, imageAsset)
      }
      throw error
    }
  },

  async promotePlannerOutfit(
    userId: string,
    outfitId: string,
    previewImage?: CreateOutfitInput['previewImage'],
  ) {
    const outfit = await requireOutfit(userId, outfitId)
    if (!outfit.plannerOnly) return outfit
    const duplicate = await findSavedDuplicate(
      userId,
      outfit.items.map((item) => item.wardrobeItemId),
      outfit.id,
      { style: outfit.style, source: outfit.source },
    )
    if (duplicate) {
      if (previewImage) {
        await addOutfitPreview(userId, duplicate.id, previewImage)
      }
      await outfitRepository.mergePlannerOnlyIntoSaved(
        outfit.id,
        duplicate.id,
        duplicate.name,
      )
      return requireOutfit(userId, duplicate.id)
    }

    const model = previewImage?.model.trim()
    if (previewImage && !model) {
      throw new ServiceError(
        'AI 이미지 생성 모델 정보가 없습니다.',
        'INVALID_GENERATED_IMAGE',
      )
    }
    const imageAsset = previewImage
      ? await imageService.storeGeneratedImage(userId, {
          ...previewImage,
          model: model!,
        })
      : null

    try {
      return await outfitRepository.promotePlannerOutfit(
        outfitId,
        imageAsset
          ? {
              userId,
              imageAssetId: imageAsset.id,
              model: model!,
            }
          : undefined,
      )
    } catch (error) {
      if (imageAsset) {
        await imageService.removeGeneratedImage(userId, imageAsset)
      }
      throw error
    }
  },

  async update(userId: string, outfitId: string, input: UpdateOutfitInput) {
    const currentOutfit = await requireOutfit(userId, outfitId)
    const name = input.name.trim()
    const style = input.style.trim().replaceAll(/\s+/g, ' ')
    const seasons = normalizeSeasons(
      input.seasons,
      currentOutfit.seasons.length === 0,
    )
    const uniqueItemIds = [
      ...new Set(input.items.map(({ wardrobeItemId }) => wardrobeItemId)),
    ]

    if (!name) {
      throw new ServiceError('코디 이름을 입력해주세요.', 'INVALID_OUTFIT')
    }
    if (!style || style.length > 20) {
      throw new ServiceError(
        '코디 스타일은 20자 이내로 입력해주세요.',
        'INVALID_OUTFIT_STYLE',
      )
    }
    if (uniqueItemIds.length < 2 || uniqueItemIds.length !== input.items.length) {
      throw new ServiceError(
        '서로 다른 옷을 두 개 이상 선택해주세요.',
        'INVALID_OUTFIT_ITEMS',
      )
    }

    const wardrobeItems = await wardrobeRepository.findManyOwnedByIds(
      userId,
      uniqueItemIds,
    )
    if (
      wardrobeItems.length !== uniqueItemIds.length ||
      wardrobeItems.some((item) => !item.category)
    ) {
      throw new ServiceError(
        '분류가 완료된 내 옷장 아이템만 코디에 넣을 수 있습니다.',
        'INVALID_OUTFIT_ITEMS',
      )
    }
    if (
      !hasCompleteOutfitBase(
        wardrobeItems.map((item) => item.category!),
      )
    ) {
      throw new ServiceError(
        '상의나 아우터와 하의를 함께 선택해주세요. 원피스는 상·하의를 모두 대신할 수 있습니다.',
        'INCOMPLETE_OUTFIT_ITEMS',
      )
    }
    const duplicate = await findSavedDuplicate(
      userId,
      uniqueItemIds,
      outfitId,
    )
    if (duplicate) {
      throw new ServiceError(
        `같은 옷 조합이 이미 '${duplicate.name}' 코디로 저장되어 있습니다.`,
        'DUPLICATE_OUTFIT',
      )
    }

    const currentItemIds = currentOutfit.items.map(
      (item) => item.wardrobeItemId,
    )
    const nextItemIds = input.items.map((item) => item.wardrobeItemId)
    const itemsChanged =
      currentItemIds.length !== nextItemIds.length ||
      currentItemIds.some((itemId, index) => itemId !== nextItemIds[index])
    const model = input.previewImage?.model.trim()
    if (input.previewImage && !model) {
      throw new ServiceError(
        'AI 이미지 생성 모델 정보가 없습니다.',
        'INVALID_GENERATED_IMAGE',
      )
    }

    const imageAsset = input.previewImage
      ? await imageService.storeGeneratedImage(userId, {
          ...input.previewImage,
          model: model!,
        })
      : null
    const resetGenerations = itemsChanged && !imageAsset
    const generatedAssets = resetGenerations
      ? currentOutfit.generations.flatMap((generation) =>
          generation.imageAsset ? [generation.imageAsset] : [],
        )
      : []
    const itemById = new Map(wardrobeItems.map((item) => [item.id, item]))
    let updatedOutfit
    try {
      updatedOutfit = await outfitRepository.update(outfitId, {
        name,
        style,
        seasons,
        resetGenerations,
        items: input.items.map((item, index) => ({
          wardrobeItemId: item.wardrobeItemId,
          slot: itemById.get(item.wardrobeItemId)!.category!,
          layerOrder: Number.isInteger(item.layerOrder)
            ? item.layerOrder
            : index,
        })),
        generation: imageAsset
          ? {
              userId,
              imageAssetId: imageAsset.id,
              model: model!,
            }
          : undefined,
      })
    } catch (error) {
      if (imageAsset) {
        await imageService.removeGeneratedImage(userId, imageAsset)
      }
      throw error
    }

    if (generatedAssets.length > 0) {
      await Promise.all(
        generatedAssets.map((asset) =>
          imageService.removeGeneratedImage(userId, asset),
        ),
      )
    }
    return updatedOutfit
  },

  async remove(userId: string, outfitId: string) {
    const outfit = await requireOutfit(userId, outfitId)
    const generatedAssets = outfit.generations.flatMap((generation) =>
      generation.imageAsset ? [generation.imageAsset] : [],
    )
    const removedOutfit = await outfitRepository.remove(outfitId)
    await Promise.all(
      generatedAssets.map((asset) =>
        imageService.removeGeneratedImage(userId, asset),
      ),
    )
    return removedOutfit
  },
}
