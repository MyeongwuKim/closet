import type { Season } from '@closet/types'
import { allSeasons } from '../../../../constants/seasons'

export type RecommendationStep = 'intro' | 'season' | 'result'
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

/** 현재 계절을 우선하고, 기준 옷에 없다면 등록된 계절 중 가장 가까운 것을 선택한다. */
export function getRecommendationSeasonForItem(date: string, seasons: Season[]): Season {
  const current = getSeasonForDate(date)
  const index = allSeasons.indexOf(current)
  return [0, 1, 3, 2].map((offset) => allSeasons[(index + offset) % allSeasons.length])
    .find((season) => seasons.includes(season)) ?? current
}
