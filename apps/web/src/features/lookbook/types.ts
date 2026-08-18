import type { Season } from '@closet/types'

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
