import { useEffect, useRef } from 'react'
import { graphqlRequest } from '../../../lib/graphql'
import { getCurrentLocation } from '../../../native-bridge'
import { useMeQuery } from '../../settings/api/profileQueries'
import { readNotificationWeatherPreferences } from '../../settings/utils/notificationWeatherPreferences'
import { readLocationPermission } from '../../weather/utils/locationPermission'
import { subscribeWeatherReturn } from '../../weather/utils/weatherRefresh'

/**
 * 허용된 현재 지역을 앱 진입·복귀 때 서버에 연결한다. 같은 계정은 30분 동안 중복 위치 조회를 줄인다.
 * 권한 요청은 하지 않으며, 사용 해제·권한 거절은 이후 일정의 지역을 비운다. 계정·화면 변경 뒤 늦게 받은 위치는 전송하지 않는다.
 */
export function useWearWeatherLocationSync(pathname: string) {
  const me = useMeQuery()
  const userId = me.data?.id
  // 같은 계정에서 마지막 동기화에 성공한 시각과 해제 상태로 중복 전송을 줄인다.
  const lastSync = useRef<{ userId: string; at: number; cleared: boolean } | null>(null)

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    let inProgress = false
    let nativeActive = true
    const sync = async () => {
      if (inProgress || controller.signal.aborted || !nativeActive || document.visibilityState !== 'visible') return
      inProgress = true
      try {
        const disabled = readNotificationWeatherPreferences().locationWeatherDisabled
        const permission = await readLocationPermission()
        if (controller.signal.aborted || !nativeActive || document.visibilityState !== 'visible') return
        const clear = disabled || permission === 'denied'
        if (!clear && permission !== 'granted') return
        const previous = lastSync.current
        if (previous?.userId === userId && previous.cleared === clear && Date.now() - previous.at < 30 * 60_000) return
        let input: { latitude: number; longitude: number } | null = null
        if (!clear) {
          const location = await getCurrentLocation()
          if (controller.signal.aborted || location.status !== 'available') return
          input = { latitude: location.latitude, longitude: location.longitude }
        }
        await graphqlRequest('mutation SyncWearWeatherLocation($input: WearWeatherLocationInput) { syncWearWeatherLocation(input: $input) }', { input }, controller.signal)
        if (!controller.signal.aborted) lastSync.current = { userId, at: Date.now(), cleared: clear }
      } catch {
        // 지역 동기화 오류는 코디 저장을 막지 않는다. 다음 앱 복귀 때 다시 시도한다.
      } finally { inProgress = false }
    }
    const timer = window.setTimeout(() => void sync(), 0)
    const onReturn = () => { void sync() }
    const onNativeState = (event: Event) => { nativeActive = (event as CustomEvent<{ isActive: boolean }>).detail.isActive }
    const unsubscribe = subscribeWeatherReturn(onReturn)
    window.addEventListener('closet:weather-preferences-changed', onReturn)
    window.addEventListener('closet:native-app-state', onNativeState)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('closet:weather-preferences-changed', onReturn)
      window.removeEventListener('closet:native-app-state', onNativeState)
    }
  }, [pathname, userId])
}
