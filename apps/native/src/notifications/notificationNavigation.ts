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
