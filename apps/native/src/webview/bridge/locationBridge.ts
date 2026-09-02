/**
 * 호출 위치: WebView JavaScript → 현재 위치 브리지
 *
 * 용도:
 * 날씨 조회를 요청한 웹 화면에 전경 위치 좌표를 반환한다.
 *
 * 동작 방식:
 * 5분 이내의 적당한 정확도 좌표를 재사용하고 없으면 새 좌표를 조회한다.
 */
import * as Location from 'expo-location'
import { captureCurrentLocation } from './locationCapture'
import { postNativeBridgeResponse } from './responses'
import type { NativeCurrentLocationRequest, WebViewRef } from './types'

export async function handleNativeCurrentLocationRequest(
  request: NativeCurrentLocationRequest,
  webViewRef: WebViewRef,
) {
  const result = await captureCurrentLocation({
    hasServicesEnabled: Location.hasServicesEnabledAsync,
    getPermission: Location.getForegroundPermissionsAsync,
    requestPermission: Location.requestForegroundPermissionsAsync,
    getLastKnownPosition: () =>
      Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000,
        requiredAccuracy: 5_000,
      }),
    getCurrentPosition: () =>
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      }),
  })

  postNativeBridgeResponse(webViewRef, request.id, {
    ok: true,
    data: result,
  })
}
