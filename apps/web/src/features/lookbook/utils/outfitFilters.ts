import type { Season, WardrobeItem } from '@closet/types'
import { seasonLabels } from '../../../constants/seasons'
import {
  getOutfitStyleLabel,
  outfitStyleOptions,
} from '../../../constants/styleOptions'
import { closetCategoryLabels } from '../../closet/constants'
import { wardrobeItemMatchesColor } from '../../closet/utils/color'
import type { SavedOutfit } from '../types'
import { getSavedOutfitItems } from './savedOutfitItems'

export function createOutfitSearchTokens(searchQuery: string) {
  return searchQuery
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function getVisibleOutfitStyleOptions(outfits: SavedOutfit[]) {
  const defaultStyleValues = new Set<string>(
    outfitStyleOptions.map((option) => option.value),
  )

  return [
    ...outfitStyleOptions,
    ...[...new Set(outfits.map((outfit) => outfit.style))]
      .filter((style) => !defaultStyleValues.has(style))
      .map((style) => ({ label: style, value: style })),
  ]
}

export function filterSavedOutfits({
  outfits,
  wardrobeItems,
  selectedItemIds = [],
  activeStyle,
  activeSeason,
  activeColor = null,
  searchQuery,
}: {
  outfits: SavedOutfit[]
  wardrobeItems: WardrobeItem[]
  selectedItemIds?: string[]
  activeStyle: string
  activeSeason: Season | null
  activeColor?: string | null
  searchQuery: string
}) {
  const searchTokens = createOutfitSearchTokens(searchQuery)

  return outfits.filter((outfit) => {
    const outfitItems = getSavedOutfitItems(outfit, wardrobeItems)
    const matchesItems = selectedItemIds.every((itemId) =>
      outfit.layers.some((layer) => layer.wardrobeItemId === itemId),
    )
    const matchesStyle =
      activeStyle === 'all' || outfit.style === activeStyle
    const matchesSeason =
      activeSeason === null || outfit.seasons.includes(activeSeason)
    const matchesColor =
      activeColor === null ||
      outfitItems.some((item) => wardrobeItemMatchesColor(item, activeColor))
    const searchableText = [
      outfit.name,
      outfit.style,
      getOutfitStyleLabel(outfit.style),
      ...outfit.seasons.map((season) => seasonLabels[season]),
      ...outfitItems.flatMap((item) => {
        return [
          item.name,
          item.category ?? '',
          item.category ? closetCategoryLabels[item.category] : '',
          item.subcategory ?? '',
          item.colorName,
        ]
      }),
    ]
      .join(' ')
      .normalize('NFKC')
      .toLocaleLowerCase('ko-KR')

    return (
      matchesItems &&
      matchesStyle &&
      matchesSeason &&
      matchesColor &&
      searchTokens.every((token) => searchableText.includes(token))
    )
  })
}
