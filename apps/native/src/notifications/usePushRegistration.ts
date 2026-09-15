/**
 * 용도:
 * 로그인 세션과 알림 권한을 기준으로 기기 푸시 등록 상태를 유지한다.
 *
 * 동작 방식:
 * 로그인 직후와 앱 복귀 시 서버 등록을 다시 시도한다.
 * 토큰 조회가 토큰 변경 이벤트를 다시 발생시키므로 겹친 등록은 막는다.
 */
import * as Notifications from 'expo-notifications'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { registerPushToken } from './registerPushToken'

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const notificationType = notification.request.content.data.type
    const isAiResult =
      notificationType === 'ai-completion' || notificationType === 'ai-failure'
    const shouldPresent = !isAiResult || AppState.currentState !== 'active'

    return {
      shouldShowBanner: shouldPresent,
      shouldShowList: shouldPresent,
      shouldPlaySound: shouldPresent,
      shouldSetBadge: false,
    }
  },
})

export function usePushRegistration(accessToken?: string) {
  useEffect(() => {
    if (!accessToken) return

    let active = true
    let isRegistering = false
    const register = () => {
      if (!active || isRegistering) return
      isRegistering = true
      void registerPushToken(accessToken)
        .catch((error: unknown) => {
          console.warn('[push] 기기 알림 등록 실패', error)
        })
        .finally(() => {
          isRegistering = false
        })
    }

    register()
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') register()
    })
    return () => {
      active = false
      appStateSubscription.remove()
    }
  }, [accessToken])
}
