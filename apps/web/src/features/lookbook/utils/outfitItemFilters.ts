/**
 * 용도:
 * 직접 코디에서 고를 수 있는 옷을 검색어와 계절, 색상 조건으로 추린다.
 *
 * 동작 방식:
 * 이름과 분류·색상·태그를 검색하고 선택된 계절과 색상을 함께 적용한다.
 * 추천 색 필터에서는 의미가 분명한 하위 색상 이름만 대표색에 포함한다.
 */
import type { Season, WardrobeItem } from '@closet/types'

export interface OutfitItemFilters {
  query: string
  season: Season | null
  color: string | null
  /** 추천 팔레트 색을 고른 경우에만 이름이 명확한 하위 색상도 함께 찾는다. */
  includeColorAliases?: boolean
}

/** 저장된 이름이 달라도 추천 팔레트의 대표색에 확실히 속하는 항목만 연결한다. */
const recommendedColorAliases: Record<string, string> = {
  아이보리: '크림',
  다크브라운: '브라운',
  '다크 그레이': '그레이',
  버건디: '레드',
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR')
}

export function filterOutfitItems(
  items: WardrobeItem[],
  { query, season, color, includeColorAliases = false }: OutfitItemFilters,
) {
  const normalizedQuery = normalizeSearchText(query)
  const normalizedColor = color ? normalizeSearchText(color) : null

  return items.filter((item) => {
    if (season && !item.seasons.includes(season)) return false
    if (normalizedColor) {
      const itemColor = normalizeSearchText(item.colorName)
      if (itemColor !== normalizedColor && (
        !includeColorAliases ||
        normalizeSearchText(recommendedColorAliases[itemColor] ?? '') !== normalizedColor
      )) return false
    }
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
