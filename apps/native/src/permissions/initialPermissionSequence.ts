/**
 * 용도:
 * 첫 앱 진입에서 안내할 알림과 위치 권한의 순서를 정한다.
 *
 * 동작 방식:
 * 새 설치의 첫 실행에서는 알림 다음 위치 순서를 항상 반환한다.
 * 실제 시스템 권한 요청은 사용자가 안내 팝업에서 허용을 선택한 뒤 실행한다.
 */
export type InitialPermission = 'notifications' | 'location'

export function hasCompletedPermissionPromptsForInstallation(
  completedInstallation: string | null,
  currentInstallation: string,
) {
  return completedInstallation === currentInstallation
}

export function getInitialPermissionPromptSequence(): InitialPermission[] {
  return ['notifications', 'location']
}
