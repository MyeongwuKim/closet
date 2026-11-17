import {
  getNativeAppInfo,
  type NativePermissionStatus,
} from '../../../native-bridge'

export type SettingsPermission = 'notifications' | 'location'

export const permissionStatusLabels: Record<NativePermissionStatus, string> = {
  granted: '허용됨',
  limited: '일부 허용',
  denied: '허용 안 됨',
  undetermined: '허용 전',
  unavailable: '확인 불가',
}

/** 제한적 허용도 해당 기능을 사용할 수 있는 권한으로 취급한다. */
export function isPermissionGranted(status: NativePermissionStatus) {
  return status === 'granted' || status === 'limited'
}

/** 요청한 종류의 현재 권한만 읽는다. 브라우저의 prompt는 앱과 같은 undetermined로 정리하며 권한을 요청하지 않는다. */
export async function readSettingsPermission(
  permission: SettingsPermission,
  isNative: boolean,
): Promise<NativePermissionStatus> {
  if (isNative) {
    const appInfo = await getNativeAppInfo()
    if (!appInfo) throw new Error('기기 권한을 확인할 수 없어요.')
    return appInfo.permissions[permission]
  }
  if (permission === 'notifications') {
    if (!('Notification' in window)) return 'unavailable'
    return window.Notification.permission === 'default'
      ? 'undetermined'
      : window.Notification.permission
  }
  try {
    if ('permissions' in navigator) {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      return result.state === 'prompt' ? 'undetermined' : result.state
    }
  } catch {
    if ('geolocation' in navigator) return 'undetermined'
  }
  return 'unavailable'
}

/** 첫 허용 요청과 이미 결정된 기기 권한의 변경 경로를 구분해 화면에 표시한다. */
export function permissionActionLabel(
  permission: SettingsPermission,
  status: NativePermissionStatus,
  requesting: boolean,
) {
  if (requesting) return '권한 요청 중…'
  if (status !== 'undetermined') return '기기 설정에서 변경'
  return permission === 'notifications' ? '알림 권한 허용하기' : '위치 권한 허용하기'
}
