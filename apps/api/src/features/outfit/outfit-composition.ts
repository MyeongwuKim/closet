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
