import type {
  NativeBridgeResponse,
  WebViewRef,
} from './types'

export function postNativeBridgeResponse<T>(
  webViewRef: WebViewRef,
  id: string,
  response: NativeBridgeResponse<T>,
) {
  webViewRef.current?.injectJavaScript(`
    window.__CLOSET_NATIVE_BRIDGE_RESPONSE__(
      ${JSON.stringify(id)},
      ${JSON.stringify(response)}
    );
    true;
  `)
}
