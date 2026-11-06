import type { Season } from '@closet/types'

export type RecommendationStep = 'intro' | 'season' | 'color-scheme' | 'result' | 'weather-result'
export type SeasonChoice = 'current-weather' | Season
export type RecommendationMode = 'today' | 'tomorrow'

export const recommendationDayLabels = { today: '오늘', tomorrow: '내일' } as const

export function getSeasonForDate(date: string): Season {
  const month = Number(date.slice(5, 7))
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}
