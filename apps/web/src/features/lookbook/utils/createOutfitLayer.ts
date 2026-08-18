import type { WardrobeItem } from '@closet/types'
import type { OutfitLayer } from '../types'

export function createOutfitLayer(
  item: WardrobeItem,
  currentLayers: OutfitLayer[],
): OutfitLayer {
  return {
    wardrobeItemId: item.id,
    order: currentLayers.length,
  }
}

export function createOutfitLayers(items: WardrobeItem[]) {
  return items.reduce<OutfitLayer[]>(
    (layers, item) => [...layers, createOutfitLayer(item, layers)],
    [],
  )
}
