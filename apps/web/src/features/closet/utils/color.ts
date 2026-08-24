import type { ColorMode, WardrobeItem } from '@closet/types'

export interface WardrobeColorOption {
  name: string
  hex: string
}

const colorOrder = [
  '블랙',
  '화이트',
  '크림',
  '베이지',
  '그레이',
  '네이비',
  '블루',
  '브라운',
  '레드',
  '핑크',
  '오렌지',
  '옐로',
  '그린',
  '올리브',
  '퍼플',
  '다색',
]

const colorOrderByName = new Map(
  colorOrder.map((colorName, index) => [colorName, index]),
)

export const colorModeLabels: Record<ColorMode, string> = {
  solid: '단색',
  patterned: '패턴',
  multicolor: '다색',
}

export function colorHexToRgb(value: string) {
  const hex = value.trim().replace(/^#/, '')
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return null

  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ] as const
}

export function getWardrobeColorOptions(items: WardrobeItem[]) {
  const colors = new Map<string, WardrobeColorOption>()

  items.forEach((item) => {
    const name = item.colorName.trim()
    if (!name || colors.has(name)) return
    colors.set(name, { name, hex: item.colorHex })
  })

  return [...colors.values()].sort((left, right) => {
    const leftOrder = colorOrderByName.get(left.name) ?? colorOrder.length
    const rightOrder = colorOrderByName.get(right.name) ?? colorOrder.length
    return leftOrder - rightOrder || left.name.localeCompare(right.name, 'ko-KR')
  })
}

export function wardrobeItemMatchesColor(
  item: WardrobeItem,
  colorName: string,
) {
  return item.colorName.trim() === colorName
}
