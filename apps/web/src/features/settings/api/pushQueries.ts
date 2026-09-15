/**
 * 용도:
 * 로그인한 사용자의 기기로 테스트 푸시를 보내 수신 설정을 확인한다.
 *
 * 동작 방식:
 * 네이티브 설정 화면의 버튼에서 인증된 GraphQL 요청을 실행한다.
 */
import { useMutation } from '@tanstack/react-query'
import { graphqlRequest } from '../../../lib/graphql'

export function useSendTestPushNotificationMutation() {
  return useMutation({
    mutationFn: async () => {
      const result = await graphqlRequest<{ sendTestPushNotification: boolean }>(
        'mutation SendTestPushNotification { sendTestPushNotification }',
      )
      return result.sendTestPushNotification
    },
  })
}
