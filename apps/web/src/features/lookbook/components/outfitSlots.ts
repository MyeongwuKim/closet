import { isBagItem, type ClothingCategory, type WardrobeItem } from '@closet/types'
import type { OutfitSelectionCategory } from '../utils/outfitSelection'

export interface OutfitSlot {
  id: Exclude<OutfitSelectionCategory, 'dress' | 'other'>
  label: string
  iconCategory: ClothingCategory | 'bag'
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
      (item.category === 'accessory' || item.category === 'other') && !isBagItem(item),
    position: 'col-start-3 row-start-1',
    limit: 4,
  },
  {
    id: 'bag',
    label: '가방',
    iconCategory: 'bag',
    matches: isBagItem,
    position: 'col-start-3 row-start-4',
    limit: 1,
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
