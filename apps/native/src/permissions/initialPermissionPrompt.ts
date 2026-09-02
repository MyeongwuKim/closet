/**
 * 용도:
 * 앱 설치 후 첫 실행에서 보여줄 권한 안내 순서를 준비하고 완료 상태를 저장한다.
 *
 * 동작 방식:
 * 현재 설치 시각과 SecureStore의 완료 기록을 비교해 재설치를 구분하고,
 * 같은 설치에서는 최초 안내를 마친 뒤 다시 노출하지 않는다.
 */
import * as Application from 'expo-application'
import * as SecureStore from 'expo-secure-store'
import {
  getInitialPermissionPromptSequence,
  hasCompletedPermissionPromptsForInstallation,
} from './initialPermissionSequence'

const INITIAL_PERMISSION_PROMPT_KEY =
  'closet.native.initial-permission-guide-completed.v2'

async function getCurrentInstallationMarker() {
  const installationTime = await Application.getInstallationTimeAsync()
  return String(installationTime.getTime())
}

export async function getInitialPermissionPrompts() {
  const [completedInstallation, currentInstallation] = await Promise.all([
    SecureStore.getItemAsync(INITIAL_PERMISSION_PROMPT_KEY),
    getCurrentInstallationMarker(),
  ])
  if (
    hasCompletedPermissionPromptsForInstallation(
      completedInstallation,
      currentInstallation,
    )
  ) {
    return []
  }

  return getInitialPermissionPromptSequence()
}

export async function completeInitialPermissionPrompts() {
  const currentInstallation = await getCurrentInstallationMarker()
  await SecureStore.setItemAsync(
    INITIAL_PERMISSION_PROMPT_KEY,
    currentInstallation,
    {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    },
  )
}
