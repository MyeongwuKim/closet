import { Linking } from 'react-native'
import { postNativeBridgeResponse } from './responses'
import type { NativeOpenExternalUrlRequest, WebViewRef } from './types'

const INTERNAL_WEB_ORIGIN = 'https://closet.native'
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function shouldKeepUrlInWebView(urlValue: string) {
  if (
    !urlValue ||
    urlValue === 'about:blank' ||
    urlValue.startsWith('data:') ||
    urlValue.startsWith('blob:') ||
    urlValue.startsWith('javascript:')
  ) {
    return true
  }

  try {
    const url = new URL(urlValue, INTERNAL_WEB_ORIGIN)
    return url.origin === INTERNAL_WEB_ORIGIN
  } catch {
    return true
  }
}

export async function openExternalUrl(urlValue: string) {
  const url = new URL(urlValue)
  if (!EXTERNAL_PROTOCOLS.has(url.protocol)) {
    throw new Error('지원하지 않는 외부 링크예요.')
  }

  await Linking.openURL(url.toString())
}

export async function handleNativeOpenExternalUrlRequest(
  request: NativeOpenExternalUrlRequest,
  webViewRef: WebViewRef,
) {
  try {
    await openExternalUrl(request.url)
    postNativeBridgeResponse(webViewRef, request.id, {
      ok: true,
      data: null,
    })
  } catch (error) {
    postNativeBridgeResponse(webViewRef, request.id, {
      ok: false,
      error: error instanceof Error ? error.message : '링크를 열지 못했어요.',
    })
  }
}
