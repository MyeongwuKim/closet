import type { Season } from '@closet/types'

/** ai는 저장된 AI 이미지를 우선 표시하고, items는 코디를 구성하는 옷 사진만 표시한다. */
export type LookbookViewMode = 'ai' | 'items'

export interface OutfitLayer {
  wardrobeItemId: string
  order: number
}

export interface SavedOutfit {
  id: string
  name: string
  style: string
  seasons: Season[]
  layers: OutfitLayer[]
  previewImageUrl?: string
  createdAt: string
}
