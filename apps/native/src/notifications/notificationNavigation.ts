/**
 * 용도:
 * 푸시 알림에 담긴 앱 내부 경로를 안전한 WebView 경로로 변환한다.
 *
 * 동작 방식:
 * AI 완료 알림의 path만 허용하고 앱에서 지원하는 화면인지 다시 검증한다.
 */
import { normalizeWebPath } from '../navigation/deepLinks'

export function getNotificationWebPath(data: Record<string, unknown>) {
  if (
    (data.type !== 'ai-completion' && data.type !== 'ai-failure') ||
    typeof data.path !== 'string'
  ) {
    return null
  }
  return normalizeWebPath(data.path)
}

/** 실행 중 룩북 생성 알림은 웹의 완료 팝업에서 확인한다. 나머지 알림의 기존 이동 경로만 반환한다. */
export function getForegroundNotificationWebPath(data: Record<string, unknown>) {
  return data.kind === 'outfit-preview' ? null : getNotificationWebPath(data)
}
