/**
 * 용도:
 * 오늘의 코디 추천 팝오버에서 계절, 현재 날씨, 스타일 선택 흐름을 관리한다.
 *
 * 동작 방식:
 * 현재 날씨를 고르면 위치 기반 예보를 먼저 조회하고,
 * 선택된 계절과 스타일을 다음 추천 단계에 전달한다.
 */
import { useState } from 'react'
import type { Season, WardrobeItem } from '@closet/types'
import {
  getOutfitStyleLabel,
  outfitStyleOptions,
  type OutfitStyle,
} from '../../../constants/styleOptions'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useLocationWeather } from '../../weather/hooks/useLocationWeather'
import { usePlannerWeekQuery } from '../api/plannerQueries'
import {
  getSeasonForDate,
  type RecommendationStep,
  type SeasonChoice,
} from '../components/today-outfit-recommendation/recommendationFlow'
import { getCurrentWeekStart } from '../data/weeklyPlan'

interface RecommendationFlowOptions {
  date: string
  baseItem?: WardrobeItem
}

export function useTodayOutfitRecommendationFlow({
  date,
  baseItem,
}: RecommendationFlowOptions) {
  const [step, setStep] = useState<RecommendationStep>(
    baseItem ? 'season' : 'intro',
  )
  const [seasonChoice, setSeasonChoice] = useState<SeasonChoice | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<OutfitStyle | null>(null)
  const meQuery = useMeQuery()
  const locationWeather = useLocationWeather(date)
  const plannerWeekQuery = usePlannerWeekQuery(
    getCurrentWeekStart(new Date(`${date}T00:00:00`)),
  )
  const hasTodayOutfit = Boolean(
    plannerWeekQuery.data?.find((entry) => entry.date === date)?.itemIds.length,
  )
  const currentSeason = getSeasonForDate(date)
  const selectedSeason: Season | null =
    seasonChoice === 'current-weather'
      ? locationWeather.weather?.recommendedSeason ?? currentSeason
      : seasonChoice
  const preferredStyles = meQuery.data?.styleProfile.preferredStyles ?? []
  const availableStyleOptions =
    preferredStyles.length > 0
      ? preferredStyles.map((style) => ({
          value: style,
          label: getOutfitStyleLabel(style),
        }))
      : outfitStyleOptions

  const selectSeason = (choice: SeasonChoice) => {
    setSeasonChoice(choice)
    setSelectedStyle(null)
    setStep('style')
    if (choice === 'current-weather') {
      void locationWeather.actions.loadWeather()
    }
  }

  const selectStyle = (style: OutfitStyle) => {
    setSelectedStyle(style)
    setStep('result')
  }

  return {
    step,
    seasonChoice,
    selectedSeason,
    selectedStyle,
    availableStyleOptions,
    hasPreferredStyles: preferredStyles.length > 0,
    meQuery,
    plannerWeekQuery,
    hasTodayOutfit,
    locationWeather,
    actions: {
      selectSeason,
      selectStyle,
      showIntro: () => setStep('intro'),
      showSeasons: () => {
        setSeasonChoice(null)
        setSelectedStyle(null)
        setStep('season')
      },
      showStyles: () => {
        setSelectedStyle(null)
        setStep('style')
      },
    },
  }
}
