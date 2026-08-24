import type { ClothingCategory, WardrobeItem } from '@closet/types'

export function getWardrobeItemCategories(item: WardrobeItem) {
  return [item.category, ...item.additionalCategories].filter(
    (category, index, categories): category is ClothingCategory =>
      category !== null && categories.indexOf(category) === index,
  )
}

export function wardrobeItemHasCategory(
  item: WardrobeItem,
  category: ClothingCategory,
) {
  return getWardrobeItemCategories(item).includes(category)
}
