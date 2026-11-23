import type { ClothingCategory, Season, WardrobeItem } from '@closet/types'

/** ai는 저장된 AI 이미지를 우선 표시하고, items는 코디를 구성하는 옷 사진만 표시한다. */
export type LookbookViewMode = 'ai' | 'items'

/** 코디 안에서만 적용되는 레이어 역할까지 포함한 표시용 옷. */
export type OutfitWardrobeItem = WardrobeItem & { isBaseLayer?: boolean }

export interface OutfitLayer {
  wardrobeItemId: string
  order: number
  slot?: ClothingCategory
  isBaseLayer?: boolean
}

export interface SavedOutfit {
  id: string
  name: string
  style: string
  seasons: Season[]
  layers: OutfitLayer[]
  /** 저장 코디에 연결된 옷의 표시 정보. 삭제된 옷도 활성 옷장 목록과 별도로 유지한다. */
  outfitItems?: WardrobeItem[]
  previewImageUrl?: string
  createdAt: string
}
