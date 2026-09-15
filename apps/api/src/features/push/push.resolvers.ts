/**
 * 용도:
 * 인증된 기기의 푸시 토큰 등록과 본인에게 보내는 테스트 알림을 연결한다.
 *
 * 요청 흐름:
 * 로그인 사용자 확인 → 기기 등록 또는 발송 → 결과 반환 순서로 처리한다.
 */
import type { PushPlatform } from '@prisma/client'
import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import { pushService } from './push.service.js'

export const pushResolvers = {
  Mutation: {
    registerMyPushToken: async (
      _parent: unknown,
      { token, platform }: { token: string; platform: PushPlatform },
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return await pushService.register(viewer.id, context.accessToken!, token, platform)
      } catch (error) {
        throw toGraphQLError(error, '기기 알림을 등록하지 못했습니다.', 'PUSH_REGISTER_FAILED')
      }
    },
    sendTestPushNotification: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      try {
        const viewer = await context.getViewer()
        return await pushService.sendTest(viewer.id)
      } catch (error) {
        throw toGraphQLError(error, '테스트 알림을 보내지 못했습니다.', 'PUSH_SEND_FAILED')
      }
    },
  },
}
