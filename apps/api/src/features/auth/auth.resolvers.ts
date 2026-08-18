import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import { toViewerResponse } from '../user/user.service.js'
import { authService, type TestLoginInput } from './auth.service.js'

export const authResolvers = {
  Mutation: {
    testLogin: async (
      _parent: unknown,
      { input }: { input: TestLoginInput },
    ) => {
      try {
        const result = await authService.testLogin(input)
        return {
          accessToken: result.accessToken,
          viewer: toViewerResponse(result.viewer),
        }
      } catch (error) {
        throw toGraphQLError(
          error,
          '테스트 로그인에 실패했습니다.',
          'TEST_LOGIN_FAILED',
        )
      }
    },
    logout: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      try {
        await authService.logout(context.accessToken)
        return true
      } catch (error) {
        throw toGraphQLError(error, '로그아웃하지 못했습니다.', 'LOGOUT_FAILED')
      }
    },
  },
}
