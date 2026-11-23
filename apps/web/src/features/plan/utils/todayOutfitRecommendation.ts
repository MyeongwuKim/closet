import type { WardrobeItem } from '@closet/types'
import { wardrobeItemHasCategory } from '../../closet/utils/wardrobeCategories'

/** 이너·하의·겉옷 등 코디의 핵심 구성만 비교할 수 있게 옷 ID를 정렬한다. */
export function getRecommendationCoreItemIds(items: WardrobeItem[]) {
  return items.filter((item) => item.category !== 'shoes' && item.category !== 'accessory').map((item) => item.id).sort()
}

/** 같은 핵심 구성의 기록을 합치고, 기록 순서가 달라도 같은 제외 조건을 만든다. */
export function uniqueRecommendationOutfits(outfits: string[][]) {
  const entries = new Map(outfits.filter((ids) => ids.length > 0).map((ids) => [JSON.stringify(ids), ids]))
  return [...entries.keys()].sort().map((key) => entries.get(key)!)
}

export function formatRecommendationHeadline(value: string) {
  const normalized = value
    .trim()
    .replace(/^추천\s*코디\s*[—–-]\s*/u, '')
    .replace(/\s*(?:루킹|룩킹)/gu, ' 코디')
    .replace(/코디(?:\s+코디)+/gu, '코디')
    .replace(/\s+/gu, ' ')
    .trim()

  return normalized || '오늘의 추천 코디'
}

export function getRefreshExcludedOuterItemIds(
  items: WardrobeItem[],
  baseItemId?: string,
) {
  return items
    .filter(
      (item) => item.id !== baseItemId && wardrobeItemHasCategory(item, 'outer'),
    )
    .map((item) => item.id)
}
