import * as Application from 'expo-application'
import { Platform } from 'react-native'
import { getNativePermissionStatuses } from './permissionBridge'
import { postNativeBridgeResponse } from './responses'
import type { NativeAppInfoRequest, WebViewRef } from './types'

export async function handleNativeAppInfoRequest(
  request: NativeAppInfoRequest,
  webViewRef: WebViewRef,
) {
  const permissions = await getNativePermissionStatuses()

  postNativeBridgeResponse(webViewRef, request.id, {
    ok: true,
    data: {
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      appVersion: Application.nativeApplicationVersion,
      buildVersion: Application.nativeBuildVersion,
      permissions,
      capabilities: [
        'app-info',
        'app-permissions',
        'notification-permission',
        'location-permission',
        'current-location',
        'camera-capture',
        'app-settings',
        'external-url',
        'deep-link',
      ],
    },
  })
}
