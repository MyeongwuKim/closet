/**
 * 사용 위치: 플래너 상단 → 화면 제목 옆
 *
 * 용도:
 * 위치 권한이 이미 허용됐거나 날씨 사용 설정이 켜져 있으면
 * 오늘의 기온과 날씨를 짧게 보여준다.
 *
 * 표시:
 * 위치 설정 안내·조회·오류 상태 또는 작은 기온 배지를 표시한다.
 * 날씨의 상세 상태와 출처 표시는 배지 팝업에 맡긴다.
 */
import { useEffect, useState } from 'react'
import { CloudSun, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getNativeAppInfo,
  isNativeWebViewRuntime,
} from '../../../native-bridge'
import { readNotificationWeatherPreferences } from '../../settings/utils/notificationWeatherPreferences'
import { useLocationWeather } from '../../weather/hooks/useLocationWeather'
import { PlanWeatherBadge } from './PlanWeatherBadge'

interface PlanTodayWeatherProps {
  date: string
}

async function hasGrantedLocationPermission() {
  if (isNativeWebViewRuntime()) {
    const appInfo = await getNativeAppInfo()
    return (
      appInfo?.permissions.location === 'granted' ||
      appInfo?.permissions.location === 'limited'
    )
  }

  if (!('permissions' in navigator)) return false
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' })
    return permission.state === 'granted'
  } catch {
    return false
  }
}

export function PlanTodayWeather({ date }: PlanTodayWeatherProps) {
  const preferences = readNotificationWeatherPreferences()
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null)
  const isEnabled =
    !preferences.locationWeatherDisabled &&
    (preferences.locationWeather || hasLocationPermission === true)
  const { weather, isLoading, errorMessage, actions } = useLocationWeather(
    date,
    { autoLoad: isEnabled },
  )

  useEffect(() => {
    if (preferences.locationWeather || preferences.locationWeatherDisabled) return

    let active = true
    void hasGrantedLocationPermission()
      .then((granted) => {
        if (active) setHasLocationPermission(granted)
      })
      .catch(() => {
        if (active) setHasLocationPermission(false)
      })

    return () => {
      active = false
    }
  }, [preferences.locationWeather, preferences.locationWeatherDisabled])

  if (!isEnabled && hasLocationPermission === null && !preferences.locationWeatherDisabled) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted" role="status" aria-label="위치 확인 중">
        <LoaderCircle size={14} className="animate-spin" />
        날씨 확인
      </span>
    )
  }

  if (!isEnabled) {
    return (
      <Link
        to="/settings/notifications-weather"
        className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[11px] font-medium text-muted"
        aria-label="위치 기반 날씨 켜기"
      >
        <CloudSun size={14} /> 날씨
      </Link>
    )
  }

  if (weather) {
    return <PlanWeatherBadge weather={weather} />
  }

  if (errorMessage) {
    return (
      <button
        type="button"
        onClick={actions.retry}
        className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[11px] font-medium text-muted"
        title={errorMessage}
        aria-label={`${errorMessage} 다시 확인`}
      >
        <CloudSun size={14} /> 재시도
      </button>
    )
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted" role="status" aria-label="오늘 날씨 확인 중">
      <LoaderCircle size={14} className={isLoading ? 'animate-spin' : ''} />
      날씨 확인
    </span>
  )
}
