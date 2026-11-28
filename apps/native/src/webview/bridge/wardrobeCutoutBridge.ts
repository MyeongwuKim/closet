import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'
import { postNativeBridgeResponse } from './responses'
import type { NativeWardrobeCutoutRequest, WebViewRef } from './types'

interface WardrobeCutoutModule {
  removeBackground(imageBase64: string): Promise<string | null>
}

const nativeModule = Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 17
  ? requireOptionalNativeModule<WardrobeCutoutModule>('ClosetWardrobeCutout')
  : null

export const supportsWardrobeCutout = nativeModule !== null

/** 기기에서 완성한 PNG를 돌려준다. 실패 시 웹 화면은 원본 등록을 계속할 수 있다. */
export async function handleNativeWardrobeCutout(request: NativeWardrobeCutoutRequest, webViewRef: WebViewRef) {
  try {
    const imageBase64 = await nativeModule?.removeBackground(request.imageBase64)
    if (imageBase64) {
      postNativeBridgeResponse(webViewRef, request.id, { ok: true, data: { imageBase64 } })
      return
    }
  } catch {
    // 전경을 찾지 못하거나 Vision 작업이 실패해도 원본 등록으로 돌아갈 수 있다.
  }
  postNativeBridgeResponse(webViewRef, request.id, { ok: false, error: '사진의 배경을 제거하지 못했어요.' })
}
