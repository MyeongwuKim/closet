import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import {
  toViewerResponse,
  userService,
  type UpdateMyStyleProfileInput,
} from './user.service.js'

export const userResolvers = {
  Query: {
    me: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      try {
        return toViewerResponse(await context.getViewer())
      } catch (error) {
        throw toGraphQLError(
          error,
          '사용자 정보를 불러오지 못했습니다.',
          'VIEWER_LOAD_FAILED',
        )
      }
    },
  },
  Mutation: {
    updateMyStyleProfile: async (
      _parent: unknown,
      { input }: { input: UpdateMyStyleProfileInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return toViewerResponse(
          await userService.updateStyleProfile(viewer.id, input),
        )
      } catch (error) {
        throw toGraphQLError(
          error,
          '스타일 프로필을 저장하지 못했습니다.',
          'STYLE_PROFILE_UPDATE_FAILED',
        )
      }
    },
  },
}
