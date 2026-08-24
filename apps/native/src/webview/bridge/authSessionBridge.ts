import { postNativeBridgeResponse } from './responses'
import type { NativeAuthSessionRequest, WebViewRef } from './types'

export async function handleNativeAuthSessionRequest(
  request: NativeAuthSessionRequest,
  webViewRef: WebViewRef,
  onAuthSessionChange?: (accessToken: string | null) => Promise<void> | void,
) {
  try {
    await onAuthSessionChange?.(request.accessToken)
    postNativeBridgeResponse(webViewRef, request.id, {
      ok: true,
      data: null,
    })
  } catch (error) {
    postNativeBridgeResponse(webViewRef, request.id, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : '로그인 상태를 저장하지 못했어요.',
    })
  }
}
