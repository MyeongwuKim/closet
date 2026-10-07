/**
 * 용도:
 * 오늘의 코디 추천 팝오버에서 계절과 현재 날씨 선택 흐름을 관리한다.
 *
 * 동작 방식:
 * 현재 날씨를 고르면 위치 기반 예보를 먼저 조회하고,
 * 스타일 선택 없이 추천 단계로 이동한다. 날씨 조회 완료 여부는 팝오버에서 확인한다.
 */
import { useState } from 'react'
import type { Season, WardrobeItem } from '@closet/types'
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
  // 기준 옷으로 진입하면 소개를 건너뛰고 계절 선택부터 시작한다.
  const [step, setStep] = useState<RecommendationStep>(
    baseItem ? 'season' : 'intro',
  )
  // 직접 선택한 계절 또는 현재 날씨 선택을 보관한다. 뒤로 가면 null로 되돌린다.
  const [seasonChoice, setSeasonChoice] = useState<SeasonChoice | null>(null)
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

  /** 계절을 선택하면 추천 단계로 이동한다. 현재 날씨 선택은 위치·예보 Hook의 자동 조회를 켠다. */
  const selectSeason = (choice: SeasonChoice) => {
    setSeasonChoice(choice)
    setStep('result')
  }

  return {
    step,
    seasonChoice,
    selectedSeason,
    meQuery,
    plannerWeekQuery,
    hasTodayOutfit,
    locationWeather,
    actions: {
      selectSeason,
      /** 일반 추천의 소개 화면으로 돌아간다. */
      showIntro: () => setStep('intro'),
      /** 선택한 계절·날씨 조건을 비우고 계절 선택으로 돌아간다. */
      showSeasons: () => {
        setSeasonChoice(null)
        setStep('season')
      },
    },
  }
}
