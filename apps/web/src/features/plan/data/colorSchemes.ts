import type { TodayOutfitColorScheme } from '@closet/types'

export type ColorScheme = TodayOutfitColorScheme

// 이전 추천 기록과 응답을 읽을 때 쓰는 색감 이름이다.
const colorSchemeLabels: Record<ColorScheme, string> = {
  auto: '자동',
  'tone-on-tone': '톤온톤',
  'tone-in-tone': '톤인톤',
  achromatic: '무채색',
  accent: '포인트',
}

/** 저장된 추천 기록의 색감 값이 유효한지 확인한다. */
export function isColorScheme(value: unknown): value is ColorScheme {
  return typeof value === 'string' && Object.hasOwn(colorSchemeLabels, value)
}

/** 이전 추천 결과·기록에 저장된 색감을 화면에 표시한다. */
export function getColorSchemeLabel(value: ColorScheme): string {
  return colorSchemeLabels[value] ?? '자동'
}
