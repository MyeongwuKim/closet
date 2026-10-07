import type { ClothingCategory, WardrobeItem } from '@closet/types'

const categoryOrder: Record<ClothingCategory, number> = {
  outer: 0,
  top: 1,
  dress: 1,
  midlayer: 2,
  bottom: 3,
  shoes: 4,
  accessory: 5,
  other: 6,
}

/** 플래너의 옷 사진을 아우터·상의·하의·신발 순서로 정렬한다. 중간 아우터는 상의 다음, 액세서리·기타·미분류는 뒤에 두며 원본 배열과 모든 아이템을 보존한다. */
export function sortPlanOutfitItems(items: WardrobeItem[]): WardrobeItem[] {
  return [...items].sort((left, right) =>
    (left.category ? categoryOrder[left.category] : 7) -
    (right.category ? categoryOrder[right.category] : 7),
  )
}
