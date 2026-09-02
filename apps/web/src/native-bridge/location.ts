/**
 * 용도:
 * 네이티브 앱과 일반 브라우저에서 현재 위치를 같은 형태로 조회한다.
 *
 * 동작 방식:
 * WebView에서는 네이티브 위치 브리지를 사용하고,
 * 브라우저에서는 Geolocation API 결과를 공통 상태로 변환한다.
 */
import { isNativeWebViewRuntime } from './runtime'
import type { CurrentLocationResult } from './types'

function getBrowserCurrentLocation(): Promise<CurrentLocationResult> {
  if (!('geolocation' in navigator)) {
    return Promise.resolve({
      status: 'error',
      code: 'LOCATION_UNAVAILABLE',
      message: '이 브라우저에서는 현재 위치를 사용할 수 없어요.',
    })
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          status: 'available',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ status: 'permission-denied', canAskAgain: true })
          return
        }
        resolve({
          status: 'error',
          code: `GEOLOCATION_${error.code}`,
          message: error.message || '현재 위치를 확인하지 못했어요.',
        })
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 15_000 },
    )
  })
}

export function getCurrentLocation(): Promise<CurrentLocationResult> {
  if (isNativeWebViewRuntime()) {
    return (
      window.ClosetNative?.getCurrentLocation() ??
      Promise.resolve({
        status: 'error',
        code: 'NATIVE_BRIDGE_UNAVAILABLE',
        message: '기기 위치 기능을 사용할 수 없어요.',
      })
    )
  }
  return getBrowserCurrentLocation()
}
