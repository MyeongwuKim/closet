import type { ClothingCategory, WardrobeItem } from '@closet/types'

export interface OutfitSlot {
  id: string
  label: string
  iconCategory: ClothingCategory
  matches: (item: WardrobeItem) => boolean
  position: string
  limit?: number
  onBody?: boolean
}

export const outfitSlots: OutfitSlot[] = [
  {
    id: 'outer',
    label: '아우터',
    iconCategory: 'outer',
    matches: (item) => item.category === 'outer',
    position: 'col-start-1 row-start-1',
  },
  {
    id: 'top',
    label: '상의',
    iconCategory: 'top',
    matches: (item) => item.category === 'top' || item.category === 'dress',
    position: 'col-start-2 row-start-2',
    onBody: true,
  },
  {
    id: 'accessory',
    label: '액세서리',
    iconCategory: 'accessory',
    matches: (item) =>
      item.category === 'accessory' || item.category === 'other',
    position: 'col-start-3 row-start-1',
    limit: 4,
  },
  {
    id: 'midlayer',
    label: '중간 아우터',
    iconCategory: 'midlayer',
    matches: (item) => item.category === 'midlayer',
    position: 'col-start-1 row-start-4',
    limit: 2,
  },
  {
    id: 'bottom',
    label: '하의',
    iconCategory: 'bottom',
    matches: (item) => item.category === 'bottom',
    position: 'col-start-2 row-start-4',
    onBody: true,
  },
  {
    id: 'shoes',
    label: '신발',
    iconCategory: 'shoes',
    matches: (item) => item.category === 'shoes',
    position: 'col-start-2 row-start-6',
    onBody: true,
  },
]
