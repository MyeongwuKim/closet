/**
 * 용도:
 * 인증 사용자의 위치 기반 날씨 조회를 GraphQL에 연결한다.
 *
 * 요청 흐름:
 * 인증 확인 → 좌표·날짜 검증 → 날씨 제공자 조회 순서로 처리한다.
 */
import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import {
  weatherService,
  type WeatherForecastInput,
} from './weather.service.js'

export const weatherResolvers = {
  Query: {
    weatherForecast: async (
      _parent: unknown,
      { input }: { input: WeatherForecastInput },
      context: GraphQLContext,
    ) => {
      try {
        await context.getViewer()
        return await weatherService.getForecast(input)
      } catch (error) {
        throw toGraphQLError(
          error,
          '현재 위치의 날씨를 불러오지 못했습니다.',
          'WEATHER_FORECAST_LOAD_FAILED',
        )
      }
    },
  },
}
