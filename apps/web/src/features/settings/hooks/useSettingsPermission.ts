import { useCallback, useEffect, useState } from 'react'
import {
  isNativeWebViewRuntime,
  openNativeAppSettings,
  requestNativePermission,
  type NativePermissionStatus,
} from '../../../native-bridge'
import { readSettingsPermission, type SettingsPermission } from '../utils/settingsPermissions'

/**
 * 설정 화면 하나가 관리하는 알림 또는 위치 권한을 읽고 앱 복귀 때 다시 확인한다.
 * 처음에는 기존 네이티브 허용 요청을, 이미 결정된 권한에는 기기 설정 이동을 사용한다.
 * 날씨 사용 여부와 알림 수신 동의의 저장은 호출부가 담당한다.
 */
export function useSettingsPermission(permission: SettingsPermission) {
  const isNative = isNativeWebViewRuntime()
  const [status, setStatus] = useState<NativePermissionStatus>('unavailable')
  const [isLoading, setIsLoading] = useState(true)
  const [isRequesting, setIsRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** 현재 권한을 다시 읽는다. 조회 실패는 화면에 남겨 사용자가 재시도할 수 있게 한다. */
  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setStatus(await readSettingsPermission(permission, isNative))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '기기 권한을 확인할 수 없어요.')
    } finally {
      setIsLoading(false)
    }
  }, [isNative, permission])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0)
    const event = isNative ? 'closet:native-app-active' : 'focus'
    const onReturn = () => { void refresh() }
    window.addEventListener(event, onReturn)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(event, onReturn)
    }
  }, [isNative, refresh])

  /** 기존 브리지로 기기 설정을 열고 열기 실패를 현재 설정 화면에 표시한다. */
  const openSettings = async () => {
    try {
      await openNativeAppSettings()
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : '기기 설정을 열지 못했어요.')
    }
  }

  /** 앱에서 처음 허용을 요청하거나 기기 설정으로 이동한다. 요청 거절 시에도 기존 기기 설정 경로로 안내한다. */
  const changeNativePermission = async () => {
    if (!isNative || isLoading || isRequesting) return
    setError(null)
    if (status !== 'undetermined') {
      await openSettings()
      return
    }
    setIsRequesting(true)
    const name = permission === 'notifications' ? '알림' : '위치'
    try {
      const next = await requestNativePermission(permission)
      if (!next) throw new Error(`${name} 권한을 요청할 수 없어요.`)
      setStatus(next)
      if (next === 'denied') await openSettings()
      else await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `${name} 권한을 요청하지 못했어요.`)
    } finally {
      setIsRequesting(false)
    }
  }

  return { isNative, status, setStatus, isLoading, isRequesting, error, setError, refresh, openSettings, changeNativePermission }
}
