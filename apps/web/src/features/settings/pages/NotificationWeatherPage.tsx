/**
 * 진입 경로: 설정 탭 → 알림 및 날씨
 *
 * 용도:
 * 알림·위치 권한을 확인하고 위치 기반 날씨 사용 여부를 관리한다.
 *
 * 구조:
 * 완료 알림·날씨 권한 상태와 기기 설정, 테스트 푸시 영역으로 구성되어 있다.
 */
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
import { useSendTestPushNotificationMutation } from '../api/pushQueries'
import {
  readNotificationWeatherPreferences,
  saveNotificationWeatherPreferences,
  type NotificationWeatherPreferences,
} from '../utils/notificationWeatherPreferences'
import {
  getNativeAppInfo,
  isNativeWebViewRuntime,
  openNativeAppSettings,
  requestNativePermission,
  type NativePermissionStatus,
} from '../../../native-bridge'

interface PermissionStatuses {
  notifications: NativePermissionStatus
  location: NativePermissionStatus
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

interface SettingRowProps {
  icon: LucideIcon
  title: string
  description: string
  permissionStatus: NativePermissionStatus
  statusLabel?: string
  toggle?: {
    checked: boolean
    disabled: boolean
    ariaLabel?: string
    onChange: (checked: boolean) => void
  }
}

function SettingRow({
  icon: Icon,
  title,
  description,
  permissionStatus,
  statusLabel,
  toggle,
}: SettingRowProps) {
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
        {toggle ? (
          <button
            type="button"
            role="switch"
            aria-checked={toggle.checked}
            aria-label={toggle.ariaLabel ?? `${title} ${toggle.checked ? '끄기' : '켜기'}`}
            onClick={() => toggle.onChange(!toggle.checked)}
            disabled={toggle.disabled}
            className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition disabled:cursor-wait disabled:opacity-50 ${
              toggle.checked ? 'bg-ink' : 'bg-line'
            }`}
          >
            <span
              className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition-transform ${
                toggle.checked ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        ) : (
          <span className="mt-1 shrink-0 rounded-full bg-canvas px-2.5 py-1 text-[11px] font-bold text-muted">
            {statusLabel}
          </span>
        )}
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
  const sendTestPush = useSendTestPushNotificationMutation()
  const [preferences, setPreferences] =
    useState<NotificationWeatherPreferences>(readNotificationWeatherPreferences)
  const [permissions, setPermissions] = useState<PermissionStatuses>({
    notifications: 'unavailable',
    location: 'unavailable',
  })
  const [isRequestingLocation, setIsRequestingLocation] = useState(false)
  const [isRequestingNotifications, setIsRequestingNotifications] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)

  const updatePreferences = useCallback((
    updates: Partial<NotificationWeatherPreferences>,
  ) => {
    setPreferences((current) => {
      const next = { ...current, ...updates }
      if (
        next.locationWeather === current.locationWeather &&
        next.locationWeatherDisabled === current.locationWeatherDisabled
      ) return current
      saveNotificationWeatherPreferences(next)
      return next
    })
  }, [])

  const loadPermissions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const nextPermissions = await readPermissionStatuses(isNative)
      setPermissions(nextPermissions)
      if (
        isNative &&
        (isPermissionGranted(nextPermissions.location) ||
          nextPermissions.location === 'denied')
      ) {
        const locationEnabled = isPermissionGranted(nextPermissions.location)
        updatePreferences({
          locationWeather: locationEnabled,
          locationWeatherDisabled: !locationEnabled,
        })
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : '기기 권한을 확인할 수 없어요.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [isNative, updatePreferences])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadPermissions(), 0)
    const refreshOnReturn = () => {
      void loadPermissions()
    }
    if (isNative) {
      window.addEventListener('closet:native-app-active', refreshOnReturn)
    } else {
      window.addEventListener('focus', refreshOnReturn)
    }
    return () => {
      window.clearTimeout(initialLoad)
      window.removeEventListener('closet:native-app-active', refreshOnReturn)
      window.removeEventListener('focus', refreshOnReturn)
    }
  }, [isNative, loadPermissions])

  const openSettings = async () => {
    try {
      await openNativeAppSettings()
    } catch (settingsError) {
      setError(
        settingsError instanceof Error
          ? settingsError.message
          : '기기 설정을 열지 못했어요.',
      )
    }
  }

  const toggleCompletionNotifications = async () => {
    setError(null)
    if (permissions.notifications !== 'undetermined') {
      await openSettings()
      return
    }

    setIsRequestingNotifications(true)
    try {
      const status = await requestNativePermission('notifications')
      if (!status) throw new Error('알림 권한을 요청할 수 없어요.')
      setPermissions((current) => ({ ...current, notifications: status }))
      if (status === 'denied') await openSettings()
      else await loadPermissions()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '알림 권한을 요청하지 못했어요.',
      )
    } finally {
      setIsRequestingNotifications(false)
    }
  }

  const toggleLocationWeather = async (checked: boolean) => {
    if (isNative) {
      setError(null)
      if (permissions.location !== 'undetermined') {
        await openSettings()
        return
      }

      setIsRequestingLocation(true)
      try {
        const status = await requestNativePermission('location')
        if (!status) throw new Error('위치 권한을 요청할 수 없어요.')
        setPermissions((current) => ({ ...current, location: status }))
        if (status === 'denied') await openSettings()
        else await loadPermissions()
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : '위치 권한을 요청하지 못했어요.',
        )
      } finally {
        setIsRequestingLocation(false)
      }
      return
    }

    if (!checked) {
      updatePreferences({
        locationWeather: false,
        locationWeatherDisabled: true,
      })
      return
    }

    setIsRequestingLocation(true)
    setError(null)
    try {
      const status = await requestWebLocationPermission()
      if (!status) throw new Error('위치 권한을 요청할 수 없어요.')
      setPermissions((current) => ({ ...current, location: status }))
      if (isPermissionGranted(status)) {
        updatePreferences({
          locationWeather: true,
          locationWeatherDisabled: false,
        })
      } else {
        updatePreferences({
          locationWeather: false,
          locationWeatherDisabled: false,
        })
        setError('현재 위치의 날씨를 받으려면 위치 권한을 허용해주세요.')
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '위치 권한을 요청하지 못했어요.',
      )
    } finally {
      setIsRequestingLocation(false)
    }
  }

  const sendTestNotification = async () => {
    setError(null)
    setTestMessage(null)
    try {
      await sendTestPush.mutateAsync()
      setTestMessage('테스트 알림을 전송했어요. 기기에서 수신 여부를 확인해주세요.')
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : '테스트 알림을 보내지 못했어요.',
      )
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
            description="알림 권한과 위치 기반 날씨 설정을 확인해보세요."
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
                  {isNative
                    ? '기기 권한은 휴대폰 설정에서 변경할 수 있어요.'
                    : '기능을 켤 때 필요한 기기 권한을 요청해요.'}
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
              <SettingRow
                icon={BellRing}
                title="작업 완료 알림"
                description="AI 옷 분석·코디 추천·코디 이미지 생성이 끝나면 기기에 알려드려요."
                statusLabel={isNative ? undefined : '모바일 앱 전용'}
                permissionStatus={permissions.notifications}
                toggle={isNative ? {
                  checked: isPermissionGranted(permissions.notifications),
                  disabled: isRequestingNotifications || isLoading,
                  ariaLabel: '알림 권한 기기 설정 열기',
                  onChange: () => void toggleCompletionNotifications(),
                } : undefined}
              />
              <SettingRow
                icon={CloudSun}
                title="위치 기반 날씨"
                description="현재 위치의 날씨를 플래너와 코디 추천에 사용해요."
                permissionStatus={permissions.location}
                toggle={{
                  checked: isNative
                    ? isPermissionGranted(permissions.location)
                    : !preferences.locationWeatherDisabled &&
                      isPermissionGranted(permissions.location),
                  disabled: isRequestingLocation || isLoading,
                  ariaLabel: isNative ? '위치 권한 기기 설정 열기' : undefined,
                  onChange: (checked) => void toggleLocationWeather(checked),
                }}
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

          {testMessage && (
            <p className="rounded-xl bg-sage/70 px-4 py-3 text-xs leading-5 font-bold text-ink">
              {testMessage}
            </p>
          )}

          {isNative && (
            <button
              type="button"
              onClick={() => void sendTestNotification()}
              disabled={
                !isPermissionGranted(permissions.notifications) ||
                isLoading ||
                sendTestPush.isPending
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <BellRing size={16} />
              {sendTestPush.isPending ? '테스트 알림 전송 중...' : '테스트 알림 보내기'}
            </button>
          )}

          {isNative && (
            <button
              type="button"
              onClick={() => void openSettings()}
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
