import { Linking } from 'react-native'
import { postNativeBridgeResponse } from './responses'
import type { NativeOpenAppSettingsRequest, WebViewRef } from './types'

export async function handleNativeOpenAppSettingsRequest(
  request: NativeOpenAppSettingsRequest,
  webViewRef: WebViewRef,
) {
  try {
    await Linking.openSettings()
    postNativeBridgeResponse(webViewRef, request.id, {
      ok: true,
      data: null,
    })
  } catch {
    postNativeBridgeResponse(webViewRef, request.id, {
      ok: false,
      error: '기기 설정을 열지 못했어요.',
    })
  }
}
