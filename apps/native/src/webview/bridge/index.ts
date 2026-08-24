import type { WebViewMessageEvent } from 'react-native-webview'
import { handleNativeAppInfoRequest } from './appInfoBridge'
import { handleNativeOpenAppSettingsRequest } from './appSettingsBridge'
import { handleNativeAuthSessionRequest } from './authSessionBridge'
import { handleNativeOpenExternalUrlRequest } from './externalLinkBridge'
import { handleNativeRequestPermission } from './permissionBridge'
import { CLOSET_WEBVIEW_BRIDGE_SCRIPT } from './injectedScript'
import {
  isNativeAppInfoRequest,
  isNativeAuthSessionRequest,
  isNativeBridgeReadyMessage,
  isNativeOpenAppSettingsRequest,
  isNativeOpenExternalUrlRequest,
  isNativeRequestPermissionRequest,
  parseNativeBridgeRequest,
} from './messageGuards'
import type { WebViewRef } from './types'

export { CLOSET_WEBVIEW_BRIDGE_SCRIPT }

interface NativeBridgeHandlers {
  onReady?: () => void
  onAuthSessionChange?: (
    accessToken: string | null,
  ) => Promise<void> | void
}

export async function handleNativeBridgeMessage(
  event: WebViewMessageEvent,
  webViewRef: WebViewRef,
  handlers: NativeBridgeHandlers = {},
) {
  const request = parseNativeBridgeRequest(event.nativeEvent.data)
  if (!request) return

  if (isNativeBridgeReadyMessage(request)) {
    handlers.onReady?.()
    return
  }

  if (isNativeAppInfoRequest(request)) {
    await handleNativeAppInfoRequest(request, webViewRef)
    return
  }

  if (isNativeOpenAppSettingsRequest(request)) {
    await handleNativeOpenAppSettingsRequest(request, webViewRef)
    return
  }

  if (isNativeRequestPermissionRequest(request)) {
    await handleNativeRequestPermission(request, webViewRef)
    return
  }

  if (isNativeAuthSessionRequest(request)) {
    await handleNativeAuthSessionRequest(
      request,
      webViewRef,
      handlers.onAuthSessionChange,
    )
    return
  }

  if (isNativeOpenExternalUrlRequest(request)) {
    await handleNativeOpenExternalUrlRequest(request, webViewRef)
  }
}
