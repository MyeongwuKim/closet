/**
 * 용도:
 * 오늘·내일 코디 추천 팝오버에서 대상 날짜의 날씨·계절과 색감 선택 흐름을 관리한다.
 *
 * 동작 방식:
 * 바로 추천은 위치 기반 예보와 자동 색감으로 결과 단계에 진입한다.
 * 조건을 직접 고르는 경우에는 계절·날씨 선택 다음에 색감을 고른다.
 */
import { useState } from 'react'
import type { Season, WardrobeItem, WeatherSnapshot } from '@closet/types'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useLocationWeather } from '../../weather/hooks/useLocationWeather'
import { hasWeatherExpired } from '../../weather/utils/weatherRefresh'
import { usePlannerWeekQuery } from '../api/plannerQueries'
import type { ColorScheme } from '../data/colorSchemes'
import {
  getSeasonForDate,
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
    startsWithWeather ? 'weather-result' : baseItem ? 'season' : 'intro',
  )
  // 직접 선택한 계절 또는 현재 날씨 선택을 보관한다. 계절 선택으로 돌아가면 비운다.
  const [seasonChoice, setSeasonChoice] = useState<SeasonChoice | null>(
    startsWithWeather ? 'current-weather' : null,
  )
  // 계절 다음에 고른 색감. 이전 단계로 돌아가 조건을 바꾸면 비운다.
  const [colorScheme, setColorScheme] = useState<ColorScheme | null>(startsWithWeather ? 'auto' : null)
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

  /** 대상 날짜의 예보를 읽고 색감은 자동으로 설정한다. 팝오버가 예보가 도착한 뒤 결과를 요청한다. */
  const recommendWithWeather = () => {
    void locationWeather.actions.loadWeather()
    setSeasonChoice('current-weather')
    setColorScheme('auto')
    setStep('weather-result')
  }

  /** 계절을 고르면 색감 선택으로 이동한다. 현재 날씨를 선택하면 위치와 예보를 함께 읽는다. */
  const selectSeason = (choice: SeasonChoice) => {
    if (choice === 'current-weather') void locationWeather.actions.loadWeather()
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
    hasScheduledOutfit,
    weather,
    locationWeather,
    actions: {
      recommendWithWeather,
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
