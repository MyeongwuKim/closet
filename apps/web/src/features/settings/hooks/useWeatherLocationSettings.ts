import { useCallback, useEffect, useState } from 'react'
import type { NativePermissionStatus } from '../../../native-bridge'
import {
  readNotificationWeatherPreferences,
  saveNotificationWeatherPreferences,
  type NotificationWeatherPreferences,
} from '../utils/notificationWeatherPreferences'
import { isPermissionGranted } from '../utils/settingsPermissions'
import { useSettingsPermission } from './useSettingsPermission'

/** 브라우저에서 날씨 사용을 직접 켤 때만 현재 위치 권한을 요청한다. */
function requestWebLocationPermission(): Promise<NativePermissionStatus> {
  if (!('geolocation' in navigator)) return Promise.resolve('unavailable')
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (error) => resolve(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    )
  })
}

/** 위치 권한과 날씨 사용 여부만 관리한다. 앱은 기기 권한을 따르고 웹은 기존 저장 키의 사용 해제 선택을 유지한다. */
export function useWeatherLocationSettings() {
  const permission = useSettingsPermission('location')
  const { isNative, status, setStatus, setError } = permission
  const [preferences, setPreferences] = useState(readNotificationWeatherPreferences)
  const [isRequestingWeb, setIsRequestingWeb] = useState(false)

  const updatePreferences = useCallback((updates: Partial<NotificationWeatherPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...updates }
      if (next.locationWeather === current.locationWeather && next.locationWeatherDisabled === current.locationWeatherDisabled) return current
      saveNotificationWeatherPreferences(next)
      return next
    })
  }, [])

  // 앱의 위치 권한 변경을 기존 저장소·날씨 동기화 이벤트에 반영한다. 알림 화면 진입은 이 값을 건드리지 않는다.
  useEffect(() => {
    if (!isNative || (!isPermissionGranted(status) && status !== 'denied')) return
    const enabled = isPermissionGranted(status)
    const current = readNotificationWeatherPreferences()
    if (current.locationWeather !== enabled || current.locationWeatherDisabled !== !enabled) {
      saveNotificationWeatherPreferences({ locationWeather: enabled, locationWeatherDisabled: !enabled })
    }
  }, [isNative, status])

  /** 웹의 날씨 사용만 즉시 저장한다. 켤 때 필요한 위치 권한을 요청하고 실패하면 원인과 함께 꺼진 상태로 남긴다. */
  const toggleWebWeather = async (checked: boolean) => {
    if (!checked) {
      updatePreferences({ locationWeather: false, locationWeatherDisabled: true })
      return
    }
    setIsRequestingWeb(true)
    setError(null)
    try {
      const next = await requestWebLocationPermission()
      setStatus(next)
      const granted = isPermissionGranted(next)
      updatePreferences({ locationWeather: granted, locationWeatherDisabled: false })
      if (!granted) setError('현재 위치의 날씨를 받으려면 위치 권한을 허용해주세요.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '위치 권한을 요청하지 못했어요.')
    } finally {
      setIsRequestingWeb(false)
    }
  }

  return {
    ...permission,
    isRequesting: permission.isRequesting || isRequestingWeb,
    weatherEnabled: isPermissionGranted(status) && (isNative || !preferences.locationWeatherDisabled),
    toggleWebWeather,
  }
}
