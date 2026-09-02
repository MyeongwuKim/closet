/**
 * 용도:
 * 현재 위치 좌표와 날짜로 서버의 날씨 예보를 조회한다.
 *
 * 동작 방식:
 * 좌표는 기기에서 받은 뒤 GraphQL 요청에만 전달하고,
 * 화면에는 코디 판단에 필요한 정리된 날씨 정보만 반환한다.
 */
import { useQuery } from '@tanstack/react-query'
import type { WeatherSnapshot } from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'

export interface WeatherCoordinates {
  latitude: number
  longitude: number
}

export function useWeatherForecastQuery(
  date: string,
  coordinates: WeatherCoordinates | null,
) {
  return useQuery({
    queryKey: queryKeys.weather.forecast(date, coordinates),
    enabled: Boolean(coordinates),
    staleTime: 15 * 60 * 1000,
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
              date temperatureC minTemperatureC maxTemperatureC
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
