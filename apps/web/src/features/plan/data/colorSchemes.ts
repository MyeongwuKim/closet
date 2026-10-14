import type { TodayOutfitColorScheme } from '@closet/types'

/** 코디 추천에서 선택할 색 조합과 선택 화면의 한 줄 안내·예시 색상이다. */
export const colorSchemeOptions = [
  {
    value: 'auto',
    label: '자동',
    hint: null,
    swatches: ['#d8c9ae', '#8c9eac', '#b46b55'],
  },
  {
    value: 'tone-on-tone',
    label: '톤온톤',
    hint: '같은 계열, 밝기 차이',
    swatches: ['#dce9ef', '#8caebe', '#375e74'],
  },
  {
    value: 'tone-in-tone',
    label: '톤인톤',
    hint: '다른 색, 비슷한 밝기',
    swatches: ['#a8b3c5', '#b5a4bb', '#afba9d'],
  },
  {
    value: 'achromatic',
    label: '무채색',
    hint: null,
    swatches: ['#f5f4f0', '#989a9c', '#2d3032'],
  },
  {
    value: 'accent',
    label: '포인트',
    hint: '한 색만 강조',
    swatches: ['#e8dfcd', '#c7bda9', '#bf5d49'],
  },
] as const satisfies ReadonlyArray<{
  value: TodayOutfitColorScheme
  label: string
  hint: string | null
  swatches: readonly string[]
}>

export type ColorScheme = TodayOutfitColorScheme

/** 저장된 추천 기록의 색감 값이 현재 선택지에 포함되는지 확인한다. */
export function isColorScheme(value: unknown): value is ColorScheme {
  return colorSchemeOptions.some((option) => option.value === value)
}

/** 추천 결과·기록에 표시할 색감 이름을 반환한다. */
export function getColorSchemeLabel(value: ColorScheme): string {
  return colorSchemeOptions.find((option) => option.value === value)?.label ?? '자동'
}
