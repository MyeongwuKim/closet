import type { WardrobeItem } from '@closet/types'
import type { OutfitWardrobeItem, SavedOutfit } from '../types'
import { applyOutfitLayerSlot } from './outfitSelection'

/** 저장 코디의 옷 관계를 우선해 삭제된 옷도 배치 순서대로 반환한다. 관계 정보가 없는 기존 코디는 전달받은 옷 목록에서 찾으며 원본 목록은 변경하지 않는다. */
export function getSavedOutfitItems(outfit: Pick<SavedOutfit, 'layers' | 'outfitItems'>, activeItems: WardrobeItem[]): OutfitWardrobeItem[] {
  const itemById = new Map([...activeItems, ...(outfit.outfitItems ?? [])].map((item) => [item.id, item]))
  return [...outfit.layers].sort((left, right) => left.order - right.order).flatMap((layer) => {
    const item = itemById.get(layer.wardrobeItemId)
    if (!item) return []
    const positionedItem = applyOutfitLayerSlot(item, layer.slot)
    return [layer.isBaseLayer ? { ...positionedItem, isBaseLayer: true } : positionedItem]
  })
}
