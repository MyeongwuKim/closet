/**
 * 용도:
 * 오늘의 코디 추천을 조회하고 기준 아이템·색감·날씨별 캐시와 추천 기록을 관리한다.
 *
 * 동작 방식:
 * 계절·색감과 선택한 날씨를 GraphQL에 전달하고
 * 기준 아이템을 포함한 유효한 결과만 변환해 로컬 추천 기록에 저장한다.
 * 새 추천은 조회 전에 잔액과 광고 지급을 확인한다. 실행 중 다른 요청이 횟수를 쓰면 같은 조건으로 한 번 재확인한다.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Season,
  ThermalRecommendationContext,
  TodayOutfitRecommendation,
  WeatherSnapshot,
} from '@closet/types'
import { GraphqlRequestError, graphqlRequest } from '../../../lib/graphql'
import { previewCreditKeys } from '../../lookbook/api/previewCreditQueries'
import { requireAiCredit } from '../../lookbook/api/requireAiCredit'
import { queryKeys } from '../../../lib/queryKeys'
import type { ColorScheme } from '../data/colorSchemes'
import { normalizeRecommendationText } from '../utils/recommendationText'
import { getThermalRecommendationMean, matchesThermalRecommendationContext } from '../utils/thermalRecommendationContext'
import { assertCurrentThermalRecommendationContext, refreshChangedThermalRecommendationContext } from './thermalRecommendationQueries'
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
  /** 날씨의 일평균이 있을 때 먼저 새로 조회한 체감 근거. 조회 준비는 결과 Hook에서 담당한다. */
  thermalContext?: ThermalRecommendationContext | null
}

function getWeatherKey(weather?: WeatherSnapshot | null) {
  return weather
    ? JSON.stringify(weather)
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
  return normalizeRecommendationText(recommendation)
}

export function useTodayOutfitRecommendationQuery(
  viewerId: string,
  date: string,
  season: Season,
  colorScheme: ColorScheme,
  variation: number,
  excludedOuterItemIds: string[],
  {
    initialData,
    enabled = true,
    baseItemId,
    weather,
    thermalContext,
  }: TodayOutfitRecommendationQueryOptions = {},
) {
  const client = useQueryClient()
  const meanTemperatureC = getThermalRecommendationMean(weather)
  const thermalContextRevision = meanTemperatureC !== null ? thermalContext?.revision : undefined
  const weatherKey = getWeatherKey(weather)
  return useQuery({
    queryKey: queryKeys.planner.todayRecommendation(
      viewerId,
      date,
      season,
      colorScheme,
      variation,
      excludedOuterItemIds,
      baseItemId,
      weatherKey,
      thermalContextRevision,
    ),
    enabled: enabled && Boolean(viewerId) && Boolean(date) && (meanTemperatureC === null || Boolean(thermalContextRevision)),
    initialData:
      initialData && (!matchesThermalRecommendationContext(initialData, thermalContextRevision) ||
      (initialData.ready && !matchesTodayRecommendationBaseItem(initialData, baseItemId)))
        ? undefined
        : initialData,
    meta: { baseItemId, colorScheme, weatherKey, thermalContextRevision },
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.meta?.baseItemId === baseItemId &&
      previousQuery?.meta?.colorScheme === colorScheme &&
      previousQuery?.meta?.weatherKey === weatherKey &&
      previousQuery?.meta?.thermalContextRevision === thermalContextRevision &&
      previousData !== undefined &&
      matchesThermalRecommendationContext(previousData, thermalContextRevision) &&
      (!previousData?.ready ||
        matchesTodayRecommendationBaseItem(previousData, baseItemId))
        ? previousData
        : undefined,
    select: (recommendation) => {
      if (!matchesThermalRecommendationContext(recommendation, thermalContextRevision)) throw new Error('착용 체감이 바뀌어 추천을 다시 확인해야 해요.')
      return validateRecommendationBaseItem(recommendation, baseItemId)
    },
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    initialDataUpdatedAt: 0,
    queryFn: async ({ signal, queryKey }): Promise<TodayOutfitRecommendation> => {
      if (meanTemperatureC !== null) {
        if (!thermalContextRevision) throw new Error('착용 체감 정보를 먼저 확인해주세요.')
        await assertCurrentThermalRecommendationContext(client, viewerId, date, meanTemperatureC, thermalContextRevision, signal)
      }
      // 저장한 결과를 다시 읽을 때는 광고를 요구하지 않는다. 새 조건의 추천은 실행 전에 잔액을 확인한다.
      const cached = client.getQueryData<TodayOutfitRecommendation>(queryKey)
      const hasCurrentCache = cached && matchesThermalRecommendationContext(cached, thermalContextRevision) && matchesTodayRecommendationBaseItem(cached, baseItemId)
      if (!hasCurrentCache && !await requireAiCredit(client, viewerId, 'recommendation', signal)) throw new Error('잔액을 확인한 뒤 추천받기 버튼을 다시 눌러주세요.')
      const request = async () => {
        try {
          return await graphqlRequest<
            { todayOutfitRecommendation: TodayOutfitRecommendationPayload },
            {
              input: {
                date: string
                season: Season
                colorScheme: ColorScheme
                variation: number
                excludedOuterItemIds: string[]
                baseItemId?: string
                weather?: WeatherSnapshot
                thermalContextRevision?: string
              }
            }
          >(
            `
              query TodayOutfitRecommendation(
                $input: TodayOutfitRecommendationInput!
              ) {
                todayOutfitRecommendation(input: $input) {
                  date season ready combinationCount headline summary style reasons colorSchemeApplied
                  profileSummary model source
                  thermalContext { revision direction strength sampleCount }
                  weather {
                    date temperatureC meanTemperatureC minTemperatureC maxTemperatureC
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
                colorScheme,
                variation,
                excludedOuterItemIds,
                ...(baseItemId !== undefined ? { baseItemId } : {}),
                ...(weather ? { weather } : {}),
                ...(thermalContextRevision ? { thermalContextRevision } : {}),
              },
            },
            signal,
          )
        } catch (error) {
          if (error instanceof GraphqlRequestError && error.code === 'THERMAL_CONTEXT_CHANGED' && meanTemperatureC !== null && thermalContextRevision) {
            await refreshChangedThermalRecommendationContext(client, viewerId, date, meanTemperatureC, thermalContextRevision, signal)
          }
          throw error
        }
      }
      let data: { todayOutfitRecommendation: TodayOutfitRecommendationPayload }
      try {
        data = await request()
      } catch (error) {
        if (!(error instanceof GraphqlRequestError) || error.code !== 'RECOMMENDATION_CREDITS_EXHAUSTED' || signal.aborted) throw error
        void client.invalidateQueries({ queryKey: previewCreditKeys.all })
        if (!await requireAiCredit(client, viewerId, 'recommendation', signal)) throw new Error('잔액을 확인한 뒤 추천받기 버튼을 다시 눌러주세요.', { cause: error })
        data = await request()
      } finally {
        void client.invalidateQueries({ queryKey: previewCreditKeys.balance(viewerId, 'recommendation') })
      }

      const recommendation = validateRecommendationBaseItem(
        {
          ...data.todayOutfitRecommendation,
          items: data.todayOutfitRecommendation.items.map(toWardrobeItem),
        },
        baseItemId,
      )
      if (!matchesThermalRecommendationContext(recommendation, thermalContextRevision)) throw new Error('추천에 반영된 착용 체감을 확인하지 못했어요. 다시 시도해 주세요.')
      if (recommendation.ready && recommendation.items.length > 0) {
        storeTodayRecommendation(
          viewerId,
          date,
          season,
          null,
          variation,
          recommendation,
          baseItemId,
          colorScheme,
        )
      }
      return recommendation
    },
  })
}
