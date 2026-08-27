import { fetchNativeGraphql } from '../../api/nativeGraphql'
import { postNativeBridgeResponse } from './responses'
import type { NativeGraphqlRequest, WebViewRef } from './types'

const pendingRequests = new Map<string, AbortController>()

export function cancelNativeGraphqlRequest(id: string) {
  pendingRequests.get(id)?.abort()
}

export async function handleNativeGraphqlRequest(
  request: NativeGraphqlRequest,
  webViewRef: WebViewRef,
  accessToken?: string,
) {
  if (pendingRequests.has(request.id)) return

  const controller = new AbortController()
  pendingRequests.set(request.id, controller)
  // Also bound requests whose WebView was closed before it could cancel them.
  const timeout = setTimeout(() => controller.abort(), 180_000)

  try {
    const response = await fetchNativeGraphql(
      request.query,
      request.variables,
      accessToken,
      controller.signal,
    )
    const payload: unknown = await response.json().catch(() => ({}))
    postNativeBridgeResponse(webViewRef, request.id, {
      ok: true,
      data: { ok: response.ok, status: response.status, payload },
    })
  } catch {
    postNativeBridgeResponse(webViewRef, request.id, {
      ok: false,
      error: controller.signal.aborted
        ? '서버 요청이 취소되었거나 응답 시간이 초과됐어요.'
        : 'API 서버에 연결하지 못했어요. 서버 실행 상태와 API 주소를 확인해주세요.',
    })
  } finally {
    clearTimeout(timeout)
    pendingRequests.delete(request.id)
  }
}
