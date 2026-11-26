/**
 * 용도:
 * 오늘·내일 추천에서 예보를, 기준 옷 추천에서 등록된 계절을 사용해 결과를 준비한다.
 *
 * 동작 방식:
 * 기준 옷은 등록된 계절로 바로 결과에 진입한다. 날씨 추천은 예보를 기다리고,
 * 계절을 직접 고른 경우에는 선택 직후 결과로 이동한다.
 */
import { useState } from 'react'
import type { Season, WardrobeItem, WeatherSnapshot } from '@closet/types'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useLocationWeather } from '../../weather/hooks/useLocationWeather'
import { hasWeatherExpired } from '../../weather/utils/weatherRefresh'
import { usePlannerWeekQuery } from '../api/plannerQueries'
import {
  getSeasonForDate,
  getRecommendationSeasonForItem,
  type RecommendationMode,
  type RecommendationStep,
  type SeasonChoice,
} from '../components/today-outfit-recommendation/recommendationFlow'
import { getCurrentWeekStart } from '../data/weeklyPlan'

interface RecommendationFlowOptions {
  date: string
  baseItem?: WardrobeItem
  mode: RecommendationMode
  initialWeather?: WeatherSnapshot
}

export function useTodayOutfitRecommendationFlow({
  date,
  baseItem,
  mode,
  initialWeather,
}: RecommendationFlowOptions) {
  const startsWithWeather = mode === 'tomorrow'
  // 내일 추천을 연 시점의 유효한 예보만 보관한다. 플래너의 갱신으로 실행 중인 추천 조건을 바꾸지 않는다.
  const [initialForecast] = useState(() =>
    initialWeather?.date === date && !hasWeatherExpired(initialWeather, 0) ? initialWeather : null,
  )
  const [step, setStep] = useState<RecommendationStep>(
    startsWithWeather || baseItem ? 'result' : 'intro',
  )
  // 직접 선택한 계절 또는 현재 날씨 선택을 보관한다. 계절 선택으로 돌아가면 비운다.
  const [seasonChoice, setSeasonChoice] = useState<SeasonChoice | null>(
    startsWithWeather ? 'current-weather' : baseItem ? getRecommendationSeasonForItem(date, baseItem.seasons) : null,
  )
  const meQuery = useMeQuery()
  // 예보가 갱신됐다는 이유로 새 추천을 시작하지 않는다. 날씨 선택·재시도에서만 읽는다.
  const locationWeather = useLocationWeather(date, {
    autoLoad: startsWithWeather && !initialForecast,
    keepRequestedSnapshot: true,
  })
  const weather = locationWeather.errorMessage
    ? null
    : locationWeather.weather ?? (initialForecast?.date === date ? initialForecast : null)
  const plannerWeekQuery = usePlannerWeekQuery(
    getCurrentWeekStart(new Date(`${date}T00:00:00`)),
  )
  const hasScheduledOutfit = Boolean(
    plannerWeekQuery.data?.find((entry) => entry.date === date)?.itemIds.length,
  )
  const currentSeason = getSeasonForDate(date)
  const selectedSeason: Season | null =
    seasonChoice === 'current-weather'
      ? weather?.recommendedSeason ?? currentSeason
      : seasonChoice

  /** 직접 고른 계절, 또는 대상 날짜의 예보로 추천을 시작한다. */
  const selectSeason = (choice: SeasonChoice) => {
    if (choice === 'current-weather') void locationWeather.actions.loadWeather()
    setSeasonChoice(choice)
    setStep('result')
  }

  return {
    step,
    seasonChoice,
    selectedSeason,
    meQuery,
    plannerWeekQuery,
    hasScheduledOutfit,
    weather,
    locationWeather,
    actions: {
      selectSeason,
      showIntro: () => setStep('intro'),
      showSeasons: () => setStep('season'),
    },
  }
}
