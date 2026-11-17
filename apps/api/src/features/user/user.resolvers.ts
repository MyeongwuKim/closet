/**
 * 용도:
 * 로그인 사용자의 조회와 프로필·리마인드 설정 변경 요청을 GraphQL에 연결한다.
 *
 * 요청 흐름:
 * 인증 사용자 확인 → 서비스 검증 및 저장 → Viewer 응답 반환 순서로 처리한다.
 */
import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import { accountDeletionService } from './account-deletion.service.js'
import {
  toViewerResponse,
  userService,
  type UpdateMyStyleProfileInput,
  type UpdateWearReminderPreferencesInput,
} from './user.service.js'

export const userResolvers = {
  Query: {
    myAccount: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      try {
        const viewer = await context.getViewer()
        return await userService.getAccountInfo(viewer.id)
      } catch (error) {
        throw toGraphQLError(error, '계정 정보를 불러오지 못했어요.', 'ACCOUNT_INFO_LOAD_FAILED')
      }
    },

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
          '사용자 정보를 불러오지 못했어요.',
          'VIEWER_LOAD_FAILED',
        )
      }
    },
  },
  Mutation: {
    deleteMyAccount: async (_parent: unknown, { confirmation }: { confirmation: string }, context: GraphQLContext) => {
      try {
        const viewer = await context.getViewer()
        return await accountDeletionService.deleteAccount(viewer.id, confirmation)
      } catch (error) {
        throw toGraphQLError(error, '회원탈퇴를 완료하지 못했어요. 다시 시도해주세요.', 'ACCOUNT_DELETION_FAILED')
      }
    },

    setCompletionPushEnabled: async (_parent: unknown, { enabled }: { enabled: boolean }, context: GraphQLContext) => {
      try {
        const viewer = await context.getViewer()
        return toViewerResponse(await userService.setCompletionPushEnabled(viewer.id, enabled))
      } catch (error) {
        throw toGraphQLError(error, '작업 완료 알림 설정을 저장하지 못했어요.', 'COMPLETION_PUSH_PREFERENCE_UPDATE_FAILED')
      }
    },

    setWardrobeRediscoveryPushEnabled: async (_parent: unknown, { enabled }: { enabled: boolean }, context: GraphQLContext) => {
      try {
        const viewer = await context.getViewer()
        return toViewerResponse(await userService.setRediscoveryPushEnabled(viewer.id, enabled))
      } catch (error) {
        throw toGraphQLError(error, '잠든 옷 알림 설정을 저장하지 못했어요.', 'REDISCOVERY_PUSH_PREFERENCE_UPDATE_FAILED')
      }
    },

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
          '스타일 프로필을 저장하지 못했어요.',
          'STYLE_PROFILE_UPDATE_FAILED',
        )
      }
    },
    updateWearReminderPreferences: async (
      _parent: unknown,
      { input }: { input: UpdateWearReminderPreferencesInput },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return toViewerResponse(
          await userService.updateWearReminderPreferences(viewer.id, input),
        )
      } catch (error) {
        throw toGraphQLError(
          error,
          '최근 착용 리마인드 설정을 저장하지 못했어요.',
          'WEAR_REMINDER_PREFERENCES_UPDATE_FAILED',
        )
      }
    },
  },
}
