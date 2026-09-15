/**
 * 사용 위치: 플래너 상단 → 주간 계획 추가 버튼 옆
 *
 * 용도:
 * 위치 권한이 이미 허용됐거나 날씨 사용 설정이 켜져 있으면
 * 오늘의 기온과 날씨를 짧게 보여준다.
 *
 * 구조:
 * 설정 안내, 조회·오류 상태, 날씨 배지와 출처 링크로 구성되어 있다.
 */
import { useEffect, useState } from 'react'
import { CloudSun, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  getNativeAppInfo,
  isNativeWebViewRuntime,
  openNativeExternalUrl,
} from '../../../native-bridge'
import { readNotificationWeatherPreferences } from '../../settings/utils/notificationWeatherPreferences'
import { useLocationWeather } from '../../weather/hooks/useLocationWeather'

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
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-muted" role="status">
        <LoaderCircle size={14} className="animate-spin" />
        위치 확인 중
      </span>
    )
  }

  if (!isEnabled) {
    return (
      <Link
        to="/settings/notifications-weather"
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1.5 text-[11px] font-bold text-muted"
        aria-label="위치 기반 날씨 켜기"
      >
        <CloudSun size={14} /> 날씨 켜기
      </Link>
    )
  }

  if (weather) {
    return (
      <div className="flex min-w-0 max-w-[140px] flex-col items-end gap-0.5 sm:max-w-none" aria-live="polite">
        <span
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-800"
          title={`오늘 ${weather.temperatureC}° · ${weather.summary}`}
        >
          <CloudSun size={14} className="shrink-0" />
          <span className="shrink-0">오늘 {weather.temperatureC}°</span>
          <span className="min-w-0 truncate">{weather.summary}</span>
        </span>
        <a
          href={weather.attributionUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            event.preventDefault()
            void openNativeExternalUrl(weather.attributionUrl)
          }}
          className="pr-1 text-[9px] leading-none text-muted underline underline-offset-2"
        >
          Open-Meteo
        </a>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <button
        type="button"
        onClick={actions.retry}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1.5 text-[11px] font-bold text-muted"
        title={errorMessage}
        aria-label={`${errorMessage} 다시 확인`}
      >
        <CloudSun size={14} /> 날씨 다시 확인
      </button>
    )
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-muted" role="status">
      <LoaderCircle size={14} className={isLoading ? 'animate-spin' : ''} />
      오늘 날씨 확인 중
    </span>
  )
}
