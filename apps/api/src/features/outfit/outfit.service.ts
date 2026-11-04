import type { OutfitSource, Season } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { imageService } from '../image/image.service.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { hasCompleteOutfitBase } from './outfit-composition.js'
import { outfitRepository, type DetachedOutfitImage, type OutfitFilter } from './outfit.repository.js'
import { resolveOutfitPreviewImage, type OutfitPreviewImageInput } from './outfit-preview-storage.js'

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
  previewImage?: OutfitPreviewImageInput | null
  previewImageAssetId?: string | null
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
  const outfit = await requireOutfit(userId, outfitId)
  const model = previewImage.model.trim()
  if (!model) {
    throw new ServiceError(
      'AI 이미지 생성 모델 정보가 없습니다.',
      'INVALID_GENERATED_IMAGE',
    )
  }

  const imageAsset = await resolveOutfitPreviewImage(userId, previewImage, outfit.items.map((item) => item.wardrobeItemId), outfit.style)
  const result = await outfitRepository.addGeneration(outfitId, { userId, imageAssetId: imageAsset.id, model: imageAsset.model })
  await releaseDetachedImages(userId, result.detachedAssets)
  return result.outfit
}

/** DB 커밋 뒤 끊어진 이전 이미지만 정리한다. 삭제 재시도는 이미지 저장소에 맡기고 저장 성공을 오류로 바꾸지 않는다. */
async function releaseDetachedImages(userId: string, assets: DetachedOutfitImage[]) {
  const uniqueAssets = [...new Map(assets.map((asset) => [asset.id, asset])).values()]
  const results = await Promise.allSettled(uniqueAssets.map((asset) => imageService.removeGeneratedImage(userId, asset)))
  if (results.some((result) => result.status === 'rejected')) console.warn('[outfit] detached preview cleanup will retry')
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
    if (input.previewImage && input.previewImageAssetId) {
      throw new ServiceError(
        'AI 이미지는 한 가지 방식으로만 저장할 수 있습니다.',
        'INVALID_GENERATED_IMAGE',
      )
    }

    const model = input.previewImage?.model.trim()
    if (input.previewImage && !model) {
      throw new ServiceError(
        'AI 이미지 생성 모델 정보가 없습니다.',
        'INVALID_GENERATED_IMAGE',
      )
    }

    const storedPreview = input.previewImageAssetId
      ? await imageService.getGeneratedImage(userId, input.previewImageAssetId)
      : null
    if (storedPreview) {
      const previewItemIds = storedPreview.metadata?.selectedItemIds
      const normalizedPreviewItemIds = Array.isArray(previewItemIds)
        ? previewItemIds.filter(
            (itemId): itemId is string => typeof itemId === 'string',
          )
        : []
      if (
        normalizedPreviewItemIds.length !== uniqueItemIds.length ||
        normalizedPreviewItemIds.some(
          (itemId) => !uniqueItemIds.includes(itemId),
        )
      ) {
        throw new ServiceError(
          '선택한 옷과 AI 이미지의 옷 구성이 일치하지 않습니다.',
          'INVALID_GENERATED_IMAGE',
        )
      }
    }

    const uploadedImageAsset = input.previewImage
      ? await resolveOutfitPreviewImage(userId, input.previewImage, uniqueItemIds, style)
      : null
    const imageAssetId = storedPreview?.assetId ?? uploadedImageAsset?.id
    const generationModel = storedPreview?.model ?? uploadedImageAsset?.model

    // 저장 실패의 새 결과도 재사용할 수 있게 남기고, 미참조 24시간 정리 정책으로 처리한다.
    const savedOutfit = await outfitRepository.create({
      userId,
      name,
      style,
      seasons,
      source: imageAssetId ? 'ai' : (input.source ?? 'manual'),
      note: input.note?.trim() || null,
      items: input.items.map((item, index) => ({
        wardrobeItemId: item.wardrobeItemId,
        slot: itemById.get(item.wardrobeItemId)!.category!,
        layerOrder: Number.isInteger(item.layerOrder)
          ? item.layerOrder
          : index,
      })),
      generation: imageAssetId && generationModel
        ? {
            userId,
            imageAssetId,
            model: generationModel,
          }
        : undefined,
    })
    return savedOutfit
  },

  /** 날짜 저장을 위한 입력을 검증한다. 실제 코디 생성과 날짜 연결은 플래너 트랜잭션에서 함께 처리한다. */
  async preparePlannerOutfit(userId: string, input: PlannerOnlyOutfitInput) {
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
      ? await resolveOutfitPreviewImage(userId, input.previewImage, uniqueItemIds, input.style?.trim() || '직접 구성')
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

    return {
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
            model: imageAsset.model,
          }
        : undefined,
    } satisfies Parameters<typeof outfitRepository.create>[0]
  },

  /** 날짜에 연결하기 전의 독립 플래너 코디가 필요한 호환 호출에서만 사용한다. */
  async createPlannerOnly(userId: string, input: PlannerOnlyOutfitInput) {
    return outfitRepository.create(await outfitService.preparePlannerOutfit(userId, input))
  },

  /** 날짜 코디를 코디북에 별도 복사한다. 같은 조합이 있으면 날짜·기존 코디를 바꾸지 않고 반환한다. */
  async copyPlannerOutfitToLookbook(
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
    )
    // 이미 있는 코디북을 날짜의 옷·사진으로 덮거나 플래너 연결을 합치지 않는다.
    if (duplicate) return duplicate
    const model = previewImage?.model.trim()
    if (previewImage && !model) {
      throw new ServiceError(
        'AI 이미지 생성 모델 정보가 없습니다.',
        'INVALID_GENERATED_IMAGE',
      )
    }
    const imageAsset = previewImage
      ? await resolveOutfitPreviewImage(userId, previewImage, outfit.items.map((item) => item.wardrobeItemId), outfit.style)
      : null

    const generation = imageAsset ? { userId, imageAssetId: imageAsset.id, model: imageAsset.model } : undefined
    const result = await outfitRepository.copyPlannerOutfitToLookbook(outfitId, generation)
    return result.outfit
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
      ? await resolveOutfitPreviewImage(userId, input.previewImage, uniqueItemIds, style)
      : null
    const resetGenerations = itemsChanged && !imageAsset
    const itemById = new Map(wardrobeItems.map((item) => [item.id, item]))
    const result = await outfitRepository.update(outfitId, {
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
            model: imageAsset.model,
          }
        : undefined,
    })
    await releaseDetachedImages(userId, result.detachedAssets)
    return result.outfit
  },

  async remove(userId: string, outfitId: string) {
    await requireOutfit(userId, outfitId)
    const result = await outfitRepository.remove(outfitId)
    await releaseDetachedImages(userId, result.detachedAssets)
    return result.outfit
  },
}
