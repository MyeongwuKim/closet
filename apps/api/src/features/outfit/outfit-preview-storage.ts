import { ServiceError } from '../../graphql/errors.js'
import { imageService } from '../image/image.service.js'

export interface OutfitPreviewImageInput {
  assetId?: string | null
  imageBase64?: string | null
  mimeType: string
  model: string
}

interface ResolvedOutfitPreview {
  id: string
  model: string
  uploadedAsset: { id: string; cloudflareImageId: string } | null
}

/** 저장할 코디와 이미지의 옷 구성을 검증하고, 생성 원본은 재업로드 없이 같은 자산으로 연결한다. 코디 저장 실패의 새 업로드도 즉시 삭제하지 않고 미참조 24시간 정리 대상에 남긴다. */
export async function resolveOutfitPreviewImage(userId: string, input: OutfitPreviewImageInput, itemIds: string[], style?: string): Promise<ResolvedOutfitPreview> {
  if (input.assetId) {
    if (input.imageBase64?.trim()) throw new ServiceError('이미지 번호와 이미지 본문은 함께 보낼 수 없습니다.', 'INVALID_GENERATED_IMAGE')
    const stored = await imageService.getGeneratedImage(userId, input.assetId)
    const selectedIds = stored.metadata?.selectedItemIds
    const expectedIds = [...new Set(itemIds)]
    if (!Array.isArray(selectedIds) || selectedIds.length !== expectedIds.length || selectedIds.some((id) => typeof id !== 'string') || expectedIds.some((id) => !selectedIds.includes(id))) {
      throw new ServiceError('선택한 옷과 AI 이미지의 옷 구성이 일치하지 않습니다.', 'INVALID_GENERATED_IMAGE')
    }
    return { id: stored.assetId, model: stored.model, uploadedAsset: null }
  }
  const model = input.model.trim()
  if (!input.imageBase64 || !model) throw new ServiceError('저장할 AI 이미지 정보가 없습니다.', 'INVALID_GENERATED_IMAGE')
  const uploaded = await imageService.storeGeneratedImage(userId, {
    imageBase64: input.imageBase64, mimeType: input.mimeType, model,
    metadata: { selectedItemIds: [...new Set(itemIds)].sort(), ...(style ? { style } : {}) },
  })
  return { id: uploaded.id, model, uploadedAsset: uploaded }
}

