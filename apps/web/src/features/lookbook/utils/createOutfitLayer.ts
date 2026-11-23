import type { WardrobeItem } from '@closet/types'
import type { OutfitLayer } from '../types'
import { getOutfitLayerSlot } from './outfitSelection'

export function createOutfitLayer(
  item: WardrobeItem,
  currentLayers: OutfitLayer[],
): OutfitLayer {
  return {
    wardrobeItemId: item.id,
    order: (currentLayers.at(-1)?.order ?? -1) + 1,
  }
}

/** 옷이 아직 해당 분류에 속하는지 확인한 뒤 저장했던 초안의 위치를 복원한다. */
export function createOutfitLayers(items: WardrobeItem[], params: URLSearchParams) {
  const baseLayerIds = params.get('baseLayers')?.split(',') ?? []
  const outerIds = params.get('outerItems')?.split(',') ?? []
  const midlayerIds = params.get('midlayerItems')?.split(',') ?? []
  return items.map<OutfitLayer>((item, order) => {
    const isBaseLayer = item.category === 'top' && baseLayerIds.includes(item.id)
    const requestedSlot = outerIds.includes(item.id) ? 'outer' : midlayerIds.includes(item.id) ? 'midlayer' : null
    const slot = isBaseLayer ? undefined : getOutfitLayerSlot(item, requestedSlot)
    return { wardrobeItemId: item.id, order, slot, isBaseLayer: isBaseLayer || undefined }
  })
}
