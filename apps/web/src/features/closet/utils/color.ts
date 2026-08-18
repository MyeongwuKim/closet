import type { ColorMode } from '@closet/types'

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
