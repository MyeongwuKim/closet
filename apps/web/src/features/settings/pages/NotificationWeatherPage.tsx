import { useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BellRing,
  ChevronLeft,
  CloudSun,
  ExternalLink,
  MapPin,
  RefreshCw,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../../../components/PageTitle'
import {
  getNativeAppInfo,
  isNativeWebViewRuntime,
  openNativeAppSettings,
  requestNativePermission,
  type NativePermissionStatus,
} from '../../../native-bridge'

interface NotificationWeatherPreferences {
  completionNotifications: boolean
  locationWeather: boolean
}

interface PermissionStatuses {
  notifications: NativePermissionStatus
  location: NativePermissionStatus
}

const STORAGE_KEY = 'closet:notification-weather-preferences:v1'
const defaultPreferences: NotificationWeatherPreferences = {
  completionNotifications: false,
  locationWeather: false,
}

const permissionLabels: Record<NativePermissionStatus, string> = {
  granted: '권한 허용됨',
  limited: '제한적으로 허용됨',
  denied: '권한 필요',
  undetermined: '권한 요청 전',
  unavailable: '확인 불가',
}

const permissionStyles: Record<NativePermissionStatus, string> = {
  granted: 'bg-sage text-ink',
  limited: 'bg-amber-100 text-amber-700',
  denied: 'bg-[#fff0ec] text-accent',
  undetermined: 'bg-canvas text-muted',
  unavailable: 'bg-canvas text-muted',
}

function readPreferences() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (!value) return defaultPreferences
    const parsed = JSON.parse(value) as Partial<NotificationWeatherPreferences>
    return {
      completionNotifications: parsed.completionNotifications === true,
      locationWeather: parsed.locationWeather === true,
    }
  } catch {
    return defaultPreferences
  }
}

function mapBrowserPermissionStatus(
  status: PermissionState,
): NativePermissionStatus {
  if (status === 'granted' || status === 'denied') return status
  return 'undetermined'
}

async function readWebPermissionStatuses(): Promise<PermissionStatuses> {
  const notifications: NativePermissionStatus =
    'Notification' in window
      ? window.Notification.permission === 'default'
        ? 'undetermined'
        : window.Notification.permission
      : 'unavailable'

  let location: NativePermissionStatus = 'unavailable'
  try {
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({
        name: 'geolocation',
      })
      location = mapBrowserPermissionStatus(permission.state)
    }
  } catch {
    if ('geolocation' in navigator) location = 'undetermined'
  }

  return { notifications, location }
}

async function readPermissionStatuses(isNative: boolean) {
  if (!isNative) return readWebPermissionStatuses()

  const appInfo = await getNativeAppInfo()
  if (!appInfo) throw new Error('기기 권한을 확인할 수 없어요.')
  return {
    notifications: appInfo.permissions.notifications,
    location: appInfo.permissions.location,
  }
}

async function requestWebNotificationPermission() {
  if (!('Notification' in window)) return 'unavailable'
  const status = await window.Notification.requestPermission()
  return status === 'default' ? 'undetermined' : status
}

function requestWebLocationPermission(): Promise<NativePermissionStatus> {
  if (!('geolocation' in navigator)) return Promise.resolve('unavailable')

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (error) =>
        resolve(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    )
  })
}

function isPermissionGranted(status: NativePermissionStatus) {
  return status === 'granted' || status === 'limited'
}

interface PreferenceRowProps {
  icon: LucideIcon
  title: string
  description: string
  checked: boolean
  disabled: boolean
  permissionStatus: NativePermissionStatus
  onChange: (checked: boolean) => void
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  checked,
  disabled,
  permissionStatus,
  onChange,
}: PreferenceRowProps) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-muted">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={`${title} ${checked ? '끄기' : '켜기'}`}
          onClick={() => onChange(!checked)}
          disabled={disabled}
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition disabled:cursor-wait disabled:opacity-50 ${
            checked ? 'bg-ink' : 'bg-line'
          }`}
        >
          <span
            className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
              checked ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${permissionStyles[permissionStatus]}`}
        >
          {permissionLabels[permissionStatus]}
        </span>
      </div>
    </div>
  )
}

export function NotificationWeatherPage() {
  const isNative = isNativeWebViewRuntime()
  const [preferences, setPreferences] =
    useState<NotificationWeatherPreferences>(readPreferences)
  const [permissions, setPermissions] = useState<PermissionStatuses>({
    notifications: 'unavailable',
    location: 'unavailable',
  })
  const [pendingPermission, setPendingPermission] = useState<
    'notifications' | 'location' | null
  >(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const updatePreferences = (
    updates: Partial<NotificationWeatherPreferences>,
  ) => {
    setPreferences((current) => {
      const next = { ...current, ...updates }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const loadPermissions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setPermissions(await readPermissionStatuses(isNative))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : '기기 권한을 확인할 수 없어요.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [isNative])

  useEffect(() => {
    let isActive = true
    void readPermissionStatuses(isNative)
      .then((nextPermissions) => {
        if (isActive) setPermissions(nextPermissions)
      })
      .catch((loadError: unknown) => {
        if (!isActive) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : '기기 권한을 확인할 수 없어요.',
        )
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [isNative])

  const requestPermission = async (
    permission: 'notifications' | 'location',
  ) => {
    if (isNative) {
      return requestNativePermission(permission)
    }
    return permission === 'notifications'
      ? requestWebNotificationPermission()
      : requestWebLocationPermission()
  }

  const toggleCompletionNotifications = async (checked: boolean) => {
    if (!checked) {
      updatePreferences({ completionNotifications: false })
      return
    }

    setPendingPermission('notifications')
    setError(null)
    try {
      const status = await requestPermission('notifications')
      if (!status) throw new Error('알림 권한을 요청할 수 없어요.')
      setPermissions((current) => ({ ...current, notifications: status }))
      if (isPermissionGranted(status)) {
        updatePreferences({ completionNotifications: true })
      } else {
        updatePreferences({ completionNotifications: false })
        setError('작업 완료 알림을 받으려면 기기에서 알림을 허용해주세요.')
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '알림 권한을 요청하지 못했어요.',
      )
    } finally {
      setPendingPermission(null)
    }
  }

  const toggleLocationWeather = async (checked: boolean) => {
    if (!checked) {
      updatePreferences({ locationWeather: false })
      return
    }

    setPendingPermission('location')
    setError(null)
    try {
      const status = await requestPermission('location')
      if (!status) throw new Error('위치 권한을 요청할 수 없어요.')
      setPermissions((current) => ({ ...current, location: status }))
      if (isPermissionGranted(status)) {
        updatePreferences({ locationWeather: true })
      } else {
        updatePreferences({ locationWeather: false })
        setError('현재 위치의 날씨를 받으려면 위치 권한을 허용해주세요.')
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '위치 권한을 요청하지 못했어요.',
      )
    } finally {
      setPendingPermission(null)
    }
  }

  return (
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label="알림 및 날씨"
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-2xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
          <Link
            to="/settings"
            className="flex size-10 shrink-0 items-center justify-center rounded-full transition hover:bg-surface"
            aria-label="알림 및 날씨 닫기"
            autoFocus
          >
            <ChevronLeft size={24} strokeWidth={2.2} />
          </Link>
          <PageTitle
            title="알림 및 날씨"
            description="완료 알림과 위치 기반 날씨 사용을 관리해보세요."
            compact
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl space-y-5 px-5 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">
          <section>
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-sm font-black">기능 설정</h2>
                <p className="mt-1 text-xs text-muted">
                  기능을 켤 때 필요한 기기 권한을 요청해요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadPermissions()}
                disabled={isLoading}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted transition hover:text-ink disabled:opacity-40"
                aria-label="권한 상태 다시 확인"
              >
                <RefreshCw
                  className={isLoading ? 'animate-spin' : ''}
                  size={16}
                />
              </button>
            </div>

            <div className="mt-3 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
              <PreferenceRow
                icon={BellRing}
                title="작업 완료 알림"
                description="AI 옷 분석과 AI 룩북 생성이 끝나면 알려드려요."
                checked={preferences.completionNotifications}
                disabled={pendingPermission !== null || isLoading}
                permissionStatus={permissions.notifications}
                onChange={(checked) =>
                  void toggleCompletionNotifications(checked)
                }
              />
              <PreferenceRow
                icon={CloudSun}
                title="위치 기반 날씨"
                description="현재 위치의 날씨를 플래너와 코디 추천에 사용해요."
                checked={preferences.locationWeather}
                disabled={pendingPermission !== null || isLoading}
                permissionStatus={permissions.location}
                onChange={(checked) => void toggleLocationWeather(checked)}
              />
            </div>
          </section>

          <div className="flex items-start gap-3 rounded-2xl bg-sage/70 px-4 py-3.5 text-xs leading-5 text-muted">
            <MapPin className="mt-0.5 shrink-0" size={17} aria-hidden="true" />
            <p>
              위치는 날씨 조회에만 사용하며, 앱을 사용하지 않을 때는 위치를
              추적하지 않아요.
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-[#fff0ec] px-4 py-3 text-xs leading-5 font-bold text-accent">
              {error}
            </p>
          )}

          {isNative && (
            <button
              type="button"
              onClick={() => void openNativeAppSettings()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold transition hover:border-ink"
            >
              <ExternalLink size={16} /> 기기 설정 열기
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
