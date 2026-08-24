import type {
  ClothingCategory,
  ColorMode,
  WardrobeItem,
} from '@closet/types'
import { wardrobeItemHasCategory } from './wardrobeCategories'

interface LabColor {
  l: number
  a: number
  b: number
}

export interface SimilarWardrobeItemInput {
  category: ClothingCategory
  subcategory: string
  colorName: string
  colorHex: string
  colorMode: ColorMode | null
}

export interface SimilarWardrobeItemMatch {
  item: WardrobeItem
  level: 'very-similar' | 'similar'
  colorDistance: number
  similarityPercent: number
}

const MAX_SIMILAR_COLOR_DISTANCE = 30
const VERY_SIMILAR_COLOR_DISTANCE = 10

const colorFamilyKeywords = {
  black: ['블랙', '검정', '흑색', 'black'],
  white: ['화이트', '흰색', '백색', 'white'],
  cream: ['크림', '아이보리', 'ivory', 'cream'],
  beige: ['베이지', '샌드', 'beige', 'sand'],
  gray: ['그레이', '회색', '차콜', '챠콜', 'gray', 'grey', 'charcoal'],
  navy: ['네이비', '남색', 'navy'],
  blue: ['블루', '파랑', '청색', 'blue'],
  brown: ['브라운', '갈색', '카멜', '초콜릿', '토프', 'brown', 'camel', 'taupe'],
  red: ['레드', '빨강', '적색', 'red'],
  pink: ['핑크', '분홍', 'pink'],
  orange: ['오렌지', '주황', 'orange'],
  yellow: ['옐로', '노랑', 'yellow'],
  green: ['그린', '초록', '녹색', 'green'],
  olive: ['올리브', '카키', 'olive', 'khaki'],
  purple: ['퍼플', '보라', '자주', 'purple', 'violet'],
  multicolor: ['다색', '멀티', 'multicolor', 'multi'],
} as const

type ColorFamily = keyof typeof colorFamilyKeywords

const compatibleColorFamilies: Record<ColorFamily, ColorFamily[]> = {
  black: ['black', 'gray'],
  white: ['white', 'cream'],
  cream: ['cream', 'white', 'beige'],
  beige: ['beige', 'cream'],
  gray: ['gray', 'black'],
  navy: ['navy', 'blue'],
  blue: ['blue', 'navy'],
  brown: ['brown'],
  red: ['red'],
  pink: ['pink'],
  orange: ['orange'],
  yellow: ['yellow'],
  green: ['green', 'olive'],
  olive: ['olive', 'green'],
  purple: ['purple'],
  multicolor: ['multicolor'],
}

function normalizeColorText(value: string) {
  return value.normalize('NFKC').trim().replaceAll(/\s+/g, '').toLowerCase()
}

function getColorFamily(value: string): ColorFamily | null {
  const normalized = normalizeColorText(value)
  if (!normalized) return null

  for (const [family, keywords] of Object.entries(colorFamilyKeywords)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return family as ColorFamily
    }
  }
  return null
}

export function areColorNamesCompatible(first: string, second: string) {
  const firstFamily = getColorFamily(first)
  const secondFamily = getColorFamily(second)

  if (!firstFamily || !secondFamily) {
    const firstNormalized = normalizeColorText(first)
    return Boolean(firstNormalized) && firstNormalized === normalizeColorText(second)
  }

  return compatibleColorFamilies[firstFamily].includes(secondFamily)
}

function normalizeSubcategory(value: string) {
  return value.normalize('NFKC').trim().replaceAll(/\s+/g, ' ').toLowerCase()
}

function hexToRgb(value: string) {
  const hex = value.trim().replace(/^#/, '')
  if (!/^[\dA-Fa-f]{6}$/.test(hex)) return null

  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ] as const
}

function rgbChannelToLinear(value: number) {
  const normalized = value / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function hexToLab(value: string): LabColor | null {
  const rgb = hexToRgb(value)
  if (!rgb) return null

  const [red, green, blue] = rgb.map(rgbChannelToLinear)
  const x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047
  const y = red * 0.2126 + green * 0.7152 + blue * 0.0722
  const z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883

  const pivot = (channel: number) =>
    channel > 0.008856
      ? Math.cbrt(channel)
      : 7.787 * channel + 16 / 116

  const fx = pivot(x)
  const fy = pivot(y)
  const fz = pivot(z)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

function getLabDistance(first: LabColor, second: LabColor) {
  return Math.sqrt(
    (first.l - second.l) ** 2 +
      (first.a - second.a) ** 2 +
      (first.b - second.b) ** 2,
  )
}

function getColorModePenalty(
  targetMode: ColorMode | null,
  itemMode: ColorMode | undefined,
) {
  if (!targetMode || !itemMode) return 3
  return targetMode === itemMode ? 0 : 12
}

export function findSimilarWardrobeItems(
  input: SimilarWardrobeItemInput,
  wardrobeItems: WardrobeItem[],
  limit = 4,
): SimilarWardrobeItemMatch[] {
  const targetColor = hexToLab(input.colorHex)
  const targetSubcategory = normalizeSubcategory(input.subcategory)

  if (!targetColor || !targetSubcategory || limit <= 0) return []

  return wardrobeItems
    .flatMap((item): SimilarWardrobeItemMatch[] => {
      if (
        item.classificationStatus !== 'classified' ||
        !wardrobeItemHasCategory(item, input.category) ||
        normalizeSubcategory(item.subcategory ?? '') !== targetSubcategory
      ) {
        return []
      }

      const itemColor = hexToLab(item.colorHex)
      if (!itemColor) return []
      if (!areColorNamesCompatible(input.colorName, item.colorName)) return []

      const colorDistance =
        getLabDistance(targetColor, itemColor) +
        getColorModePenalty(input.colorMode, item.colorMode)

      if (colorDistance > MAX_SIMILAR_COLOR_DISTANCE) return []

      const similarityPercent = Math.round(
        100 -
          (Math.min(colorDistance, MAX_SIMILAR_COLOR_DISTANCE) /
            MAX_SIMILAR_COLOR_DISTANCE) *
            40,
      )

      return [
        {
          item,
          level:
            colorDistance <= VERY_SIMILAR_COLOR_DISTANCE
              ? 'very-similar'
              : 'similar',
          colorDistance,
          similarityPercent,
        },
      ]
    })
    .sort((first, second) => first.colorDistance - second.colorDistance)
    .slice(0, limit)
}
