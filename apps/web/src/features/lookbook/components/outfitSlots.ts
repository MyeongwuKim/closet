import type { WardrobeItem } from '@closet/types'

export interface OutfitSlot {
  id: string
  label: string
  matches: (item: WardrobeItem) => boolean
  position: string
  limit?: number
  onBody?: boolean
}

export const outfitSlots: OutfitSlot[] = [
  {
    id: 'outer',
    label: '아우터',
    matches: (item) => item.category === 'outer',
    position: 'top-[11%] left-[1%]',
  },
  {
    id: 'top',
    label: '상의',
    matches: (item) => item.category === 'top' || item.category === 'dress',
    position: 'top-[25%] left-[36%]',
    onBody: true,
  },
  {
    id: 'accessory',
    label: '액세서리',
    matches: (item) =>
      item.category === 'accessory' || item.category === 'other',
    position: 'top-[11%] right-[1%]',
    limit: 4,
  },
  {
    id: 'midlayer',
    label: '중간 아우터',
    matches: (item) => item.category === 'midlayer',
    position: 'top-[52%] left-[1%]',
    limit: 2,
  },
  {
    id: 'bottom',
    label: '하의',
    matches: (item) => item.category === 'bottom',
    position: 'top-[50%] left-[36%]',
    onBody: true,
  },
  {
    id: 'shoes',
    label: '신발',
    matches: (item) => item.category === 'shoes',
    position: 'top-[75%] left-[36%]',
    onBody: true,
  },
]
