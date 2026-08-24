import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { postNativeBridgeResponse } from './responses'
import type { NativeRequestPermissionRequest, WebViewRef } from './types'

export type NativePermissionStatus =
  | 'granted'
  | 'limited'
  | 'denied'
  | 'undetermined'
  | 'unavailable'

function normalizePermissionStatus(status: string): NativePermissionStatus {
  if (status === 'granted' || status === 'denied' || status === 'undetermined') {
    return status
  }

  return 'unavailable'
}

function normalizeNotificationStatus(
  status: Notifications.NotificationPermissionsStatus,
) {
  if (
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return 'limited' satisfies NativePermissionStatus
  }
  return normalizePermissionStatus(status.status)
}

export async function getNativePermissionStatuses() {
  const [notifications, photos, camera, location] = await Promise.allSettled([
    Notifications.getPermissionsAsync(),
    ImagePicker.getMediaLibraryPermissionsAsync(),
    ImagePicker.getCameraPermissionsAsync(),
    Location.getForegroundPermissionsAsync(),
  ])

  return {
    notifications:
      notifications.status === 'fulfilled'
        ? normalizeNotificationStatus(notifications.value)
        : 'unavailable',
    photos:
      photos.status === 'fulfilled'
        ? photos.value.accessPrivileges === 'limited'
          ? 'limited'
          : normalizePermissionStatus(photos.value.status)
        : 'unavailable',
    camera:
      camera.status === 'fulfilled'
        ? normalizePermissionStatus(camera.value.status)
        : 'unavailable',
    location:
      location.status === 'fulfilled'
        ? normalizePermissionStatus(location.value.status)
        : 'unavailable',
  } satisfies Record<string, NativePermissionStatus>
}

async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  return normalizeNotificationStatus(
    await Notifications.requestPermissionsAsync(),
  )
}

async function requestLocationPermission() {
  const result = await Location.requestForegroundPermissionsAsync()
  return normalizePermissionStatus(result.status)
}

export async function handleNativeRequestPermission(
  request: NativeRequestPermissionRequest,
  webViewRef: WebViewRef,
) {
  try {
    const status =
      request.permission === 'notifications'
        ? await requestNotificationPermission()
        : await requestLocationPermission()

    postNativeBridgeResponse(webViewRef, request.id, {
      ok: true,
      data: status,
    })
  } catch (error) {
    postNativeBridgeResponse(webViewRef, request.id, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : '기기 권한을 요청하지 못했어요.',
    })
  }
}
