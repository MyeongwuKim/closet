/**
 * 용도:
 * 오늘의 코디 추천 팝오버에서 계절·현재 날씨와 색감 선택 흐름을 관리한다.
 *
 * 동작 방식:
 * 현재 날씨를 고르면 위치 기반 예보를 조회한다. 계절 다음에 색감을 고르면
 * 추천 단계로 이동하며, 날씨 조회 완료 여부는 팝오버에서 확인한다.
 */
import { useState } from 'react'
import type { Season, WardrobeItem } from '@closet/types'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useLocationWeather } from '../../weather/hooks/useLocationWeather'
import { usePlannerWeekQuery } from '../api/plannerQueries'
import type { ColorScheme } from '../data/colorSchemes'
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
  // 기준 옷으로 진입하면 소개를 건너뛰고 계절 선택부터 시작한다.
  const [step, setStep] = useState<RecommendationStep>(
    baseItem ? 'season' : 'intro',
  )
  // 직접 선택한 계절 또는 현재 날씨 선택을 보관한다. 계절 선택으로 돌아가면 비운다.
  const [seasonChoice, setSeasonChoice] = useState<SeasonChoice | null>(null)
  // 계절 다음에 고른 색감. 이전 단계로 돌아가 조건을 바꾸면 비운다.
  const [colorScheme, setColorScheme] = useState<ColorScheme | null>(null)
  const meQuery = useMeQuery()
  const locationWeather = useLocationWeather(date, {
    autoLoad: seasonChoice === 'current-weather',
  })
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

  /** 계절을 고르면 색감 선택으로 이동한다. 현재 날씨 선택은 위치·예보 Hook의 자동 조회를 켠다. */
  const selectSeason = (choice: SeasonChoice) => {
    setSeasonChoice(choice)
    setColorScheme(null)
    setStep('color-scheme')
  }

  /** 색감 선택값을 보관하고 해당 색감의 추천을 조회할 결과 단계로 이동한다. */
  const selectColorScheme = (choice: ColorScheme) => {
    setColorScheme(choice)
    setStep('result')
  }

  return {
    step,
    seasonChoice,
    colorScheme,
    selectedSeason,
    meQuery,
    plannerWeekQuery,
    hasTodayOutfit,
    locationWeather,
    actions: {
      selectSeason,
      selectColorScheme,
      /** 일반 추천의 소개 화면으로 돌아간다. */
      showIntro: () => setStep('intro'),
      /** 선택한 계절·날씨 조건을 비우고 계절 선택으로 돌아간다. */
      showSeasons: () => {
        setSeasonChoice(null)
        setColorScheme(null)
        setStep('season')
      },
      /** 계절은 유지하고 색감만 다시 고를 수 있도록 결과에서 한 단계 돌아간다. */
      showColorSchemes: () => {
        setColorScheme(null)
        setStep('color-scheme')
      },
    },
  }
}
