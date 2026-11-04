import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'
import type { ThermalRecommendationContext, WeatherSnapshot } from '@closet/types'
import { GraphqlRequestError, graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { getThermalRecommendationMean, isThermalRecommendationContext } from '../utils/thermalRecommendationContext'

/** 사용자·날짜·예보 일평균별 체감 근거를 무료로 읽는다. 매 진입마다 새로 확인해 이전 추천의 사용권 재사용 범위를 결정한다. */
export function thermalRecommendationContextQueryOptions(viewerId: string, date: string, meanTemperatureC: number | null) {
  return queryOptions({
    queryKey: queryKeys.planner.thermalContext(viewerId, date, meanTemperatureC),
    enabled: Boolean(viewerId) && Boolean(date) && meanTemperatureC !== null,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async ({ signal }): Promise<ThermalRecommendationContext> => {
      if (meanTemperatureC === null || !Number.isFinite(meanTemperatureC)) throw new Error('예보의 하루 평균 기온이 필요합니다.')
      const data = await graphqlRequest<{ thermalRecommendationContext: ThermalRecommendationContext }>(`
        query ThermalRecommendationContext($date: String!, $meanTemperatureC: Float!) {
          thermalRecommendationContext(date: $date, meanTemperatureC: $meanTemperatureC) {
            revision direction strength sampleCount
          }
        }
      `, { date, meanTemperatureC }, signal)
      if (!isThermalRecommendationContext(data.thermalRecommendationContext)) throw new Error('착용 체감 정보를 확인하지 못했습니다. 다시 시도해 주세요.')
      return data.thermalRecommendationContext
    },
  })
}

/** 일평균이 있는 날씨 추천에서만 체감 근거를 구독한다. 계절 추천과 이전 형식의 날씨는 추가 조회하지 않는다. */
export function useThermalRecommendationContextQuery(viewerId: string, date: string, weather?: WeatherSnapshot | null) {
  return useQuery(thermalRecommendationContextQueryOptions(viewerId, date, getThermalRecommendationMean(weather)))
}

/** 피드백 저장과 동시에 추천이 재조회되면 진행 중인 최신 체감 조회를 먼저 기다린다. 근거가 바뀐 옛 요청은 사용권 확인 전에 중단한다. */
export async function assertCurrentThermalRecommendationContext(
  client: QueryClient, viewerId: string, date: string, meanTemperatureC: number, revision: string, signal: AbortSignal,
) {
  const options = thermalRecommendationContextQueryOptions(viewerId, date, meanTemperatureC)
  const state = client.getQueryState<ThermalRecommendationContext>(options.queryKey)
  const context = !state?.data || state.isInvalidated || state.fetchStatus === 'fetching'
    ? await client.fetchQuery(options) : state.data
  if (signal.aborted) throw new DOMException('추천 요청이 취소됐어요.', 'AbortError')
  if (context.revision !== revision) throw new GraphqlRequestError('착용 체감이 바뀌어 추천을 다시 확인하고 있어요.', 'THERMAL_CONTEXT_CHANGED')
}

/** 서버가 근거 변경을 알리면 체감 조회만 갱신한다. 같은 조회가 진행 중이면 합치고 이미 새 버전이 있으면 재요청하지 않는다. */
export async function refreshChangedThermalRecommendationContext(
  client: QueryClient, viewerId: string, date: string, meanTemperatureC: number, revision: string, signal: AbortSignal,
) {
  if (signal.aborted) return
  const options = thermalRecommendationContextQueryOptions(viewerId, date, meanTemperatureC)
  const current = client.getQueryData<ThermalRecommendationContext>(options.queryKey)
  if (current && current.revision !== revision) return
  await client.invalidateQueries({ queryKey: options.queryKey, exact: true, refetchType: 'none' })
  await client.fetchQuery(options)
}
