import { useEffect, useState } from 'react'
import { readNotificationWeatherPreferences } from '../../settings/utils/notificationWeatherPreferences'
import { useLocationWeather } from '../../weather/hooks/useLocationWeather'
import { readLocationPermission } from '../../weather/utils/locationPermission'

/** 오늘 배지와 내일 예보에 같은 자동 조회 기준을 적용한다. 설정이 켜져 있거나 기기에 허용된 위치로 선택한 날짜의 예보를 읽는다. */
export function usePlannerLocationWeather(date: string) {
  const { locationWeather, locationWeatherDisabled } = readNotificationWeatherPreferences()
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null)
  const isEnabled = !locationWeatherDisabled && (locationWeather || hasLocationPermission === true)
  const forecast = useLocationWeather(date, { autoLoad: isEnabled })

  useEffect(() => {
    if (locationWeather || locationWeatherDisabled) return

    let active = true
    void readLocationPermission()
      .then((status) => {
        if (active) setHasLocationPermission(status === 'granted')
      })
      .catch(() => {
        if (active) setHasLocationPermission(false)
      })

    return () => {
      active = false
    }
  }, [locationWeather, locationWeatherDisabled])

  return {
    ...forecast,
    isEnabled,
    isCheckingPermission: !isEnabled && hasLocationPermission === null && !locationWeatherDisabled,
  }
}
