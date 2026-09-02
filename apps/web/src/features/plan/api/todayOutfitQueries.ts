/**
 * 용도:
 * 오늘의 코디 추천을 조회하고 기준 아이템·날씨별 캐시와 추천 기록을 관리한다.
 *
 * 동작 방식:
 * 계절과 스타일, 선택한 날씨를 GraphQL에 전달하고
 * 기준 아이템을 포함한 유효한 결과만 변환해 로컬 추천 기록에 저장한다.
 */
import { useQuery } from '@tanstack/react-query'
import type {
  Season,
  TodayOutfitRecommendation,
  WeatherSnapshot,
} from '@closet/types'
import type { OutfitStyle } from '../../../constants/styleOptions'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import {
  toWardrobeItem,
  wardrobeItemFields,
  type WardrobeItemPayload,
} from '../../closet/api/wardrobeQueries'
import {
  matchesTodayRecommendationBaseItem,
  storeTodayRecommendation,
} from '../utils/todayRecommendationHistory'

export {
  getTodayRecommendationItemKey,
  readAllRecentTodayRecommendationHistory,
  readRecentTodayRecommendationHistory,
  readTodayRecommendationHistory,
  type TodayRecommendationHistoryEntry,
} from '../utils/todayRecommendationHistory'

interface TodayOutfitRecommendationPayload
  extends Omit<TodayOutfitRecommendation, 'items'> {
  items: WardrobeItemPayload[]
}

interface TodayOutfitRecommendationQueryOptions {
  initialData?: TodayOutfitRecommendation
  enabled?: boolean
  baseItemId?: string
  weather?: WeatherSnapshot | null
}

function getWeatherKey(weather?: WeatherSnapshot | null) {
  return weather
    ? `${weather.date}:${weather.temperatureC}:${weather.apparentTemperatureC}:${weather.weatherCode}`
    : undefined
}

function validateRecommendationBaseItem(
  recommendation: TodayOutfitRecommendation,
  baseItemId?: string,
) {
  if (
    recommendation.ready &&
    !matchesTodayRecommendationBaseItem(recommendation, baseItemId)
  ) {
    throw new Error(
      '선택한 아이템이 추천에 포함되지 않았어요. 다시 추천받아 주세요.',
    )
  }
  return recommendation
}

export function useTodayOutfitRecommendationQuery(
  viewerId: string,
  date: string,
  season: Season,
  style: OutfitStyle,
  variation: number,
  excludedOuterItemIds: string[],
  {
    initialData,
    enabled = true,
    baseItemId,
    weather,
  }: TodayOutfitRecommendationQueryOptions = {},
) {
  return useQuery({
    queryKey: queryKeys.planner.todayRecommendation(
      viewerId,
      date,
      season,
      style,
      variation,
      excludedOuterItemIds,
      baseItemId,
      getWeatherKey(weather),
    ),
    enabled: enabled && Boolean(viewerId) && Boolean(date),
    initialData:
      initialData?.ready &&
      !matchesTodayRecommendationBaseItem(initialData, baseItemId)
        ? undefined
        : initialData,
    meta: { baseItemId },
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.meta?.baseItemId === baseItemId &&
      (!previousData?.ready ||
        matchesTodayRecommendationBaseItem(previousData, baseItemId))
        ? previousData
        : undefined,
    select: (recommendation) =>
      validateRecommendationBaseItem(recommendation, baseItemId),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }): Promise<TodayOutfitRecommendation> => {
      const data = await graphqlRequest<
        { todayOutfitRecommendation: TodayOutfitRecommendationPayload },
        {
          input: {
            date: string
            season: Season
            style: OutfitStyle
            variation: number
            excludedOuterItemIds: string[]
            baseItemId?: string
            weather?: WeatherSnapshot
          }
        }
      >(
        `
          query TodayOutfitRecommendation(
            $input: TodayOutfitRecommendationInput!
          ) {
            todayOutfitRecommendation(input: $input) {
              date season ready headline summary style reasons
              profileSummary model source
              weather {
                date temperatureC minTemperatureC maxTemperatureC
                apparentTemperatureC precipitationProbability weatherCode
                summary recommendedSeason source attribution attributionUrl
              }
              items { ${wardrobeItemFields} }
            }
          }
        `,
        {
          input: {
            date,
            season,
            style,
            variation,
            excludedOuterItemIds,
            ...(baseItemId !== undefined ? { baseItemId } : {}),
            ...(weather ? { weather } : {}),
          },
        },
        signal,
      )

      const recommendation = validateRecommendationBaseItem(
        {
          ...data.todayOutfitRecommendation,
          items: data.todayOutfitRecommendation.items.map(toWardrobeItem),
        },
        baseItemId,
      )
      if (recommendation.ready && recommendation.items.length > 0) {
        storeTodayRecommendation(
          viewerId,
          date,
          season,
          style,
          variation,
          recommendation,
          baseItemId,
        )
      }
      return recommendation
    },
  })
}
