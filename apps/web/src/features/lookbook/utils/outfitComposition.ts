import type { WardrobeItem } from '@closet/types'
import { hasMinimumOutfitItems } from '@closet/types/outfit-items'
import type { SavedOutfit } from '../types'

type OutfitItemCategory = Pick<WardrobeItem, 'category'>

/** 원피스 한 벌 또는 상·하의 구성이 완성되면 안내를 숨기고, 빠진 구성에 맞는 안내를 반환한다. */
export function getOutfitCompletionMessage(items: OutfitItemCategory[]) {
  if (!hasMinimumOutfitItems(items)) {
    return '코디를 완성하려면 옷을 하나 더 골라주세요.'
  }

  const hasUpper = items.some(
    (item) =>
      item.category !== null &&
      ['top', 'outer', 'midlayer', 'dress'].includes(item.category),
  )
  const hasLower = items.some(
    (item) => item.category === 'bottom' || item.category === 'dress',
  )

  if (!hasUpper && !hasLower) {
    return '상의나 아우터와 하의를 함께 골라주세요.'
  }
  if (!hasUpper) return '상의나 아우터를 하나 골라주세요.'
  if (!hasLower) return '하의나 원피스를 하나 골라주세요.'
  return null
}

function getItemSignature(itemIds: string[]) {
  return [...new Set(itemIds)].sort().join('|')
}

export function findDuplicateOutfit(
  outfits: SavedOutfit[],
  itemIds: string[],
  excludeOutfitId?: string,
) {
  const uniqueItemIds = [...new Set(itemIds)]
  if (uniqueItemIds.length === 0) return undefined

  const signature = getItemSignature(uniqueItemIds)
  return outfits.find((outfit) => {
    if (outfit.id === excludeOutfitId) return false

    const savedItemIds = outfit.layers.map((layer) => layer.wardrobeItemId)
    return (
      savedItemIds.length === uniqueItemIds.length &&
      getItemSignature(savedItemIds) === signature
    )
  })
}
