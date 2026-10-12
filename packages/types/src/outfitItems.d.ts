import type { ClothingCategory } from './index.js'

export interface WardrobeItemKindInput {
  name: string
  category: ClothingCategory | null
  subcategory?: string | null
}

export const MAX_OUTFIT_ITEMS: 8
export function isBagItem(item: WardrobeItemKindInput): boolean
