/**
 * 용도:
 * 알림을 허용한 기기의 Expo 푸시 토큰을 현재 로그인 계정에 등록한다.
 *
 * 동작 방식:
 * EAS 프로젝트 ID로 토큰을 발급받고 네이티브 GraphQL 요청에
 * 현재 세션을 실어 보내 서버의 기기 목록을 갱신한다.
 */
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { fetchNativeGraphql } from '../api/nativeGraphql'

export async function registerPushToken(accessToken: string) {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const permission = await Notifications.getPermissionsAsync()
  const canReceiveNotifications =
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  if (!canReceiveNotifications) return

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (typeof projectId !== 'string' || !projectId) {
    throw new Error('Expo 프로젝트 ID를 찾을 수 없습니다.')
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
  const response = await fetchNativeGraphql(
    `mutation RegisterMyPushToken($token: String!, $platform: PushPlatform!) {
      registerMyPushToken(token: $token, platform: $platform)
    }`,
    { token, platform: Platform.OS },
    accessToken,
  )
  const result = (await response.json().catch(() => ({}))) as {
    data?: { registerMyPushToken?: boolean }
    errors?: Array<{ message?: string }>
  }
  if (!response.ok || result.data?.registerMyPushToken !== true) {
    throw new Error(result.errors?.[0]?.message ?? '푸시 토큰을 등록하지 못했습니다.')
  }
}
