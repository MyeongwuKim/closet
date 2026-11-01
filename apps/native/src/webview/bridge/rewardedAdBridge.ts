import { fetchNativeGraphql } from '../../api/nativeGraphql'
import { showAdPrivacyOptions, showPreviewRewardedAd } from '../../ads/rewardedAds'
import { postNativeBridgeResponse } from './responses'
import type { NativeAdPrivacyRequest, NativeRewardedAdRequest, WebViewRef } from './types'

const sessionFields = 'id mode adUnitId status watchedAt validUntil'
type Session = { id: string; mode: string; adUnitId: string; status: string; watchedAt: string | null; validUntil: string }

/** 광고 세션 조회·완료 보고를 15초 안에 처리한다. 응답 본문까지 읽은 뒤 타이머를 해제하며 지연 시 요청을 중단한다. */
async function requestSession(query: string, id: string, accessToken: string) {
  // React Native에서도 동작하는 controller를 사용한다. AbortSignal.timeout 정적 메서드는 요구하지 않는다.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetchNativeGraphql(query, { id }, accessToken, controller.signal)
    const payload = await response.json() as { data?: Record<string, Session>; errors?: { message: string }[] }
    if (!response.ok || !payload.data) throw new Error(payload.errors?.[0]?.message ?? '광고 보상 정보를 확인하지 못했어요.')
    return Object.values(payload.data)[0]
  } catch (error) {
    if (controller.signal.aborted) throw new Error('광고 보상 정보 확인이 지연되고 있어요. 잠시 후 다시 시도해 주세요.', { cause: error })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 웹의 광고 실행 요청을 받아 로그인 계정의 세션을 서버에서 다시 읽고 iOS 광고를 표시한다.
 * 로컬 테스트 완료만 별도 지급 요청을 보내며 실제 광고는 Google 서버 검증을 기다린다.
 */
export async function handleNativeRewardedAd(request: NativeRewardedAdRequest, webViewRef: WebViewRef, accessToken?: string) {
  try {
    if (!accessToken) throw new Error('로그인한 뒤 광고를 시청해 주세요.')
    const session = await requestSession(`query PreviewRewardSession($id: ID!) { previewRewardSession(id: $id) { ${sessionFields} } }`, request.sessionId, accessToken)
    if (session.status === 'granted') {
      postNativeBridgeResponse(webViewRef, request.id, { ok: true, data: { status: 'earned', sessionId: session.id } })
      return
    }
    const result = session.watchedAt ? { status: 'earned' as const } : await showPreviewRewardedAd(session)
    if (result.status === 'earned') {
      await requestSession(`mutation MarkPreviewRewardWatched($id: ID!) { markPreviewRewardWatched(id: $id) { ${sessionFields} } }`, session.id, accessToken)
      if (session.mode === 'test') await requestSession(`mutation CompleteTestPreviewReward($id: ID!) { completeTestPreviewReward(id: $id) { ${sessionFields} } }`, session.id, accessToken)
    }
    postNativeBridgeResponse(webViewRef, request.id, { ok: true, data: { ...result, sessionId: session.id } })
  } catch (error) {
    postNativeBridgeResponse(webViewRef, request.id, { ok: false, error: error instanceof Error ? error.message : '광고를 실행하지 못했어요.' })
  }
}

/** 앱 정보 화면에서 광고 개인정보 선택 양식을 다시 연다. 생성권이나 시청 상태는 바꾸지 않는다. */
export async function handleNativeAdPrivacy(request: NativeAdPrivacyRequest, webViewRef: WebViewRef) {
  try { await showAdPrivacyOptions(); postNativeBridgeResponse(webViewRef, request.id, { ok: true, data: null }) }
  catch { postNativeBridgeResponse(webViewRef, request.id, { ok: false, error: '광고 개인정보 설정을 열지 못했어요.' }) }
}
