/**
 * 용도:
 * 현재 위치 좌표와 날짜로 서버의 날씨 예보를 조회한다.
 *
 * 동작 방식:
 * 좌표는 기기에서 받은 뒤 GraphQL 요청에만 전달하고,
 * 화면에는 코디 판단에 필요한 정리된 날씨 정보만 반환한다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import type { WeatherSnapshot } from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { getWeatherStaleTime, WEATHER_VALIDITY_MS } from '../utils/weatherRefresh'

export interface WeatherCoordinates {
  latitude: number
  longitude: number
}

/** 좌표와 날짜별 예보를 조회하고 서버의 expiresAt까지 캐시를 재사용하는 공통 설정이다. */
export function weatherForecastQueryOptions(
  date: string,
  coordinates: WeatherCoordinates | null,
) {
  return queryOptions<WeatherSnapshot>({
    queryKey: queryKeys.weather.forecast(date, coordinates),
    enabled: Boolean(coordinates),
    staleTime: (query) => getWeatherStaleTime(query.state.data, query.state.dataUpdatedAt),
    gcTime: WEATHER_VALIDITY_MS,
    // 복귀 시 Hook에서 위치를 먼저 확인하므로 이전 좌표로 자동 재조회하지 않는다.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      if (!coordinates) throw new Error('현재 위치가 필요합니다.')
      const data = await graphqlRequest<
        { weatherForecast: WeatherSnapshot },
        {
          input: WeatherCoordinates & { date: string }
        }
      >(
        `
          query WeatherForecast($input: WeatherForecastInput!) {
            weatherForecast(input: $input) {
              date expiresAt temperatureC minTemperatureC maxTemperatureC
              apparentTemperatureC precipitationProbability weatherCode
              summary recommendedSeason source attribution attributionUrl
            }
          }
        `,
        { input: { ...coordinates, date } },
        signal,
      )
      return data.weatherForecast
    },
  })
}

/** 위치 확인을 마친 예보를 구독하며 화면이 날씨를 사용하지 않는 동안은 자동 조회하지 않는다. */
export function useWeatherForecastQuery(
  date: string,
  coordinates: WeatherCoordinates | null,
  enabled: boolean,
) {
  return useQuery({
    ...weatherForecastQueryOptions(date, coordinates),
    enabled: enabled && Boolean(coordinates),
  })
}
