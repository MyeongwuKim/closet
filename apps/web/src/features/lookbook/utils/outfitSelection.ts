import { isBagItem, MAX_OUTFIT_ITEMS, type ClothingCategory, type WardrobeItem } from '@closet/types'
import { closetCategoryLabels } from '../../closet/constants'

/** 가방은 저장된 옷 분류를 바꾸지 않고 코디 선택 화면에서만 별도로 구분한다. */
export type OutfitSelectionCategory = ClothingCategory | 'bag'
type OutfitSelectionItem = Pick<WardrobeItem, 'name' | 'category' | 'subcategory'>

export const outfitSelectionLabels: Record<OutfitSelectionCategory, string> = {
  ...closetCategoryLabels,
  bag: '가방 · 소품',
}

export const outfitSelectionOrder: OutfitSelectionCategory[] = [
  'top', 'bottom', 'outer', 'shoes', 'midlayer', 'accessory', 'bag', 'dress',
]

const categoryFlowByStart: Record<OutfitSelectionCategory, OutfitSelectionCategory[]> = {
  top: ['bottom', 'outer', 'shoes', 'midlayer', 'accessory', 'bag'],
  bottom: ['top', 'outer', 'shoes', 'midlayer', 'accessory', 'bag'],
  outer: ['top', 'bottom', 'shoes', 'accessory', 'bag', 'midlayer'],
  midlayer: ['top', 'bottom', 'outer', 'shoes', 'accessory', 'bag'],
  dress: ['outer', 'shoes', 'accessory', 'bag', 'midlayer'],
  shoes: ['bottom', 'top', 'outer', 'accessory', 'bag', 'midlayer'],
  accessory: ['top', 'bottom', 'outer', 'shoes', 'midlayer', 'bag'],
  bag: ['top', 'bottom', 'outer', 'shoes', 'midlayer', 'accessory'],
  other: ['top', 'bottom', 'outer', 'shoes', 'midlayer', 'accessory', 'bag'],
}

/** 가방은 bag, 기타 소품은 accessory로 연결하고 나머지는 저장된 분류를 반환한다. */
export function getOutfitSelectionCategory(item: OutfitSelectionItem): OutfitSelectionCategory | null {
  if (isBagItem(item)) return 'bag'
  return item.category === 'other' ? 'accessory' : item.category
}

/** 원피스는 상의 칸을 공유하며 가방·착용 액세서리는 서로 다른 칸을 사용한다. */
export function getOutfitSlotId(item: OutfitSelectionItem | OutfitSelectionCategory) {
  const category = typeof item === 'string' ? item : getOutfitSelectionCategory(item)
  if (category === 'dress') return 'top'
  return category === 'other' ? 'accessory' : category
}

/** 가방은 한 개, 착용 액세서리는 네 개, 중간 아우터는 두 개까지 조합한다. */
export function getOutfitSelectionLimit(category: OutfitSelectionCategory | null) {
  return category === 'accessory' ? 4 : category === 'midlayer' ? 2 : 1
}

/** 다른 칸의 구성을 유지하면서 서버의 전체 개수 제한 안에서 해당 칸에 넣을 수 있는 수를 반환한다. */
export function getOutfitSelectionCapacity(category: OutfitSelectionCategory, selectedItems: OutfitSelectionItem[]) {
  const slotId = getOutfitSlotId(category)
  const otherItems = selectedItems.filter(item => getOutfitSlotId(item) !== slotId).length
  return Math.max(0, Math.min(getOutfitSelectionLimit(category), MAX_OUTFIT_ITEMS - otherItems))
}

/** 선택 화면의 종류에 해당하는 아이템만 판정하며 가방은 액세서리 목록에서 제외한다. */
export function matchesOutfitSelectionCategory(item: OutfitSelectionItem, category: OutfitSelectionCategory) {
  return getOutfitSelectionCategory(item) === category
}

/** 기본 상·하의가 있으면 신발을 먼저 제안하고, 이후 시작 아이템에 맞는 남은 종류를 찾는다. */
export function getRecommendedTargetCategory(selectedItems: OutfitSelectionItem[], targetOptions: OutfitSelectionCategory[]) {
  const hasUpper = selectedItems.some(item => item.category === 'top' || item.category === 'dress')
  const hasLower = selectedItems.some(item => item.category === 'bottom' || item.category === 'dress')
  if (hasUpper && hasLower && targetOptions.includes('shoes')) return 'shoes'
  const startCategory = selectedItems[0] ? getOutfitSelectionCategory(selectedItems[0]) : null
  const preferredOrder = startCategory ? categoryFlowByStart[startCategory] : outfitSelectionOrder
  return preferredOrder.find(category => targetOptions.includes(category)) ?? targetOptions[0] ?? null
}
