/**
 * 용도:
 * AI 결과 푸시를 받거나 누르면 알림에 지정된 앱 화면을 앱 시작 단계부터 보관한다.
 *
 * 동작 방식:
 * 실행 중에는 수신 즉시 이동하고, 백그라운드·종료 상태에서는 사용자가 누른
 * 마지막 알림을 복구해 인증과 WebView 준비가 끝난 뒤 경로를 전달한다.
 */
import * as Notifications from 'expo-notifications'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { getNotificationWebPath } from './notificationNavigation'

export function useNotificationNavigation(
  onWebPath: (path: string) => void,
) {
  const response = Notifications.useLastNotificationResponse()

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (AppState.currentState !== 'active') return
        const path = getNotificationWebPath(notification.request.content.data)
        if (path) onWebPath(path)
      },
    )
    return () => subscription.remove()
  }, [onWebPath])

  useEffect(() => {
    if (
      !response ||
      response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
    ) return

    const path = getNotificationWebPath(
      response.notification.request.content.data,
    )
    if (!path) return

    onWebPath(path)
    void Notifications.clearLastNotificationResponseAsync()
  }, [onWebPath, response])
}
