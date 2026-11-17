/**
 * 용도:
 * 푸시 알림에 담긴 앱 내부 경로를 안전한 WebView 경로로 변환한다.
 *
 * 동작 방식:
 * AI 결과의 내부 path와 옷 재발견 전용 경로를 검증한다. 재발견 리마인드는 눌렀을 때만 이동한다.
 */
import { normalizeWebPath } from '../navigation/deepLinks'

export function getNotificationWebPath(data: Record<string, unknown>) {
  if (data.type === 'wardrobe-rediscovery') {
    return data.path === '/closet/rediscovery' ? normalizeWebPath(data.path) : null
  }
  if (
    (data.type !== 'ai-completion' && data.type !== 'ai-failure') ||
    typeof data.path !== 'string'
  ) {
    return null
  }
  return normalizeWebPath(data.path)
}

/** 실행 중 룩북 알림과 재발견 리마인드는 자동 이동하지 않는다. 사용자가 누른 알림은 getNotificationWebPath에서 처리한다. */
export function getForegroundNotificationWebPath(data: Record<string, unknown>) {
  return data.kind === 'outfit-preview' || data.type === 'wardrobe-rediscovery' ? null : getNotificationWebPath(data)
}
