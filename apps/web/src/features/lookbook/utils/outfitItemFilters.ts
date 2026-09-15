/**
 * 용도:
 * 직접 코디에서 고를 수 있는 옷을 검색어와 계절, 색상 조건으로 추린다.
 *
 * 동작 방식:
 * 이름과 분류·색상·태그를 검색하고 선택된 계절과 색상을 함께 적용한다.
 */
import type { Season, WardrobeItem } from '@closet/types'

export interface OutfitItemFilters {
  query: string
  season: Season | null
  color: string | null
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR')
}

export function filterOutfitItems(
  items: WardrobeItem[],
  { query, season, color }: OutfitItemFilters,
) {
  const normalizedQuery = normalizeSearchText(query)

  return items.filter((item) => {
    if (season && !item.seasons.includes(season)) return false
    if (color && item.colorName !== color) return false
    if (!normalizedQuery) return true

    const searchableText = [
      item.name,
      item.subcategory,
      item.colorName,
      item.colorDetailName,
      ...item.tags,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLocaleLowerCase('ko-KR')

    return searchableText.includes(normalizedQuery)
  })
}

export function getOutfitItemFilterOptions(items: WardrobeItem[]) {
  const seasons = new Set<Season>()
  const colors = new Map<string, string>()

  items.forEach((item) => {
    item.seasons.forEach((season) => seasons.add(season))
    const colorName = item.colorName.trim()
    if (colorName && !colors.has(colorName)) colors.set(colorName, item.colorHex)
  })

  return {
    seasons,
    colors: [...colors].map(([name, hex]) => ({ name, hex })),
  }
}
