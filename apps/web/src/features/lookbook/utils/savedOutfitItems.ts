import type { WardrobeItem } from '@closet/types'
import type { SavedOutfit } from '../types'

/** 저장 코디의 옷 관계를 우선해 삭제된 옷도 배치 순서대로 반환한다. 관계 정보가 없는 기존 코디는 전달받은 옷 목록에서 찾으며 원본 목록은 변경하지 않는다. */
export function getSavedOutfitItems(outfit: Pick<SavedOutfit, 'layers' | 'outfitItems'>, activeItems: WardrobeItem[]): WardrobeItem[] {
  const itemById = new Map([...activeItems, ...(outfit.outfitItems ?? [])].map((item) => [item.id, item]))
  return [...outfit.layers].sort((left, right) => left.order - right.order).flatMap((layer) => {
    const item = itemById.get(layer.wardrobeItemId)
    return item ? [item] : []
  })
}
