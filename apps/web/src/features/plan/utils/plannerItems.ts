import type { WardrobeItem } from '@closet/types'
import { getSavedOutfitItems } from '../../lookbook/utils/savedOutfitItems'
import type { PlanEntry } from '../data/weeklyPlan'

/** 날짜 코디의 표시 정보를 우선해 삭제된 옷을 유지하고, 새로 고른 옷은 활성 옷장에서 찾는다. ID 순서를 유지하며 선택 목록에는 병합하지 않는다. */
export function getPlanEntryItems(entry: Pick<PlanEntry, 'itemIds' | 'outfitItems' | 'outfitLayers'>, activeItems: WardrobeItem[]) {
  const layers = entry.outfitLayers ?? entry.itemIds.map((wardrobeItemId, order) => ({ wardrobeItemId, order }))
  return getSavedOutfitItems({ layers, outfitItems: entry.outfitItems }, activeItems)
}
