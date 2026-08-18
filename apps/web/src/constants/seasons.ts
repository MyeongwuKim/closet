import type { Season } from '@closet/types'

export const seasonOptions: ReadonlyArray<{
  label: string
  value: Season
}> = [
  { label: '봄', value: 'spring' },
  { label: '여름', value: 'summer' },
  { label: '가을', value: 'autumn' },
  { label: '겨울', value: 'winter' },
]

export const allSeasons = seasonOptions.map((option) => option.value)

export const seasonLabels: Record<Season, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
}

export function formatSeasonLabels(seasons: Season[]) {
  if (seasons.length === allSeasons.length) return '사계절'
  return seasonOptions
    .filter((option) => seasons.includes(option.value))
    .map((option) => option.label)
    .join('·')
}
