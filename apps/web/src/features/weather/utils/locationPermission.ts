import { getNativeAppInfo, isNativeWebViewRuntime } from '../../../native-bridge'

/** 이미 허용된 위치만 자동 조회하도록 권한 상태를 읽는다. 이 함수는 권한 팝업을 열지 않는다. */
export async function readLocationPermission(): Promise<'granted' | 'denied' | 'unknown'> {
  if (isNativeWebViewRuntime()) {
    const status = (await getNativeAppInfo())?.permissions?.location
    if (status === 'granted' || status === 'limited') return 'granted'
    return status === 'denied' ? 'denied' : 'unknown'
  }
  if (!('permissions' in navigator)) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state === 'prompt' ? 'unknown' : status.state
  } catch { return 'unknown' }
}
