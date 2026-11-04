import type { OutfitPreview } from '@closet/types'

export interface OutfitPreviewImageInput {
  assetId?: string
  imageBase64?: string | null
  mimeType: OutfitPreview['mimeType']
  model: string
}

/** 저장 API에는 기존 이미지 번호 또는 이미지 본문 중 하나만 보낸다. 조회 URL 등 응답 전용 필드는 제외한다. */
export function toOutfitPreviewImageInput(preview?: OutfitPreviewImageInput | null): OutfitPreviewImageInput | undefined {
  if (!preview) return undefined
  return preview.assetId
    ? { assetId: preview.assetId, mimeType: preview.mimeType, model: preview.model }
    : { imageBase64: preview.imageBase64, mimeType: preview.mimeType, model: preview.model }
}
