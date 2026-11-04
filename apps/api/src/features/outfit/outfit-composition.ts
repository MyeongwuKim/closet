import type { ClothingCategory } from '@prisma/client'

const upperCategories: ClothingCategory[] = [
  'top',
  'outer',
  'midlayer',
  'dress',
]

export function hasCompleteOutfitBase(categories: ClothingCategory[]) {
  const hasUpper = categories.some((category) =>
    upperCategories.includes(category),
  )
  const hasLower = categories.some(
    (category) => category === 'bottom' || category === 'dress',
  )
  return hasUpper && hasLower
}

/** 옷 ID의 순서·중복을 무시한 조합 키다. 입력을 바꾸지 않으며 빈 구성은 매칭하지 않도록 빈 문자열을 반환한다. */
export function outfitCompositionKey(itemIds: readonly string[]): string {
  const uniqueIds = [...new Set(itemIds)].sort()
  return uniqueIds.length > 0 ? JSON.stringify(uniqueIds) : ''
}
