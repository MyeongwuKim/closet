import { SettingsDetailLayout } from '../components/SettingsDetailLayout'
import { PermissionSettingRow, ToggleSettingRow } from '../components/SettingRow'
import { useWeatherLocationSettings } from '../hooks/useWeatherLocationSettings'
import { permissionActionLabel, permissionStatusLabels } from '../utils/settingsPermissions'

/** 설정 → 날씨 및 위치에서 날씨 사용과 위치 권한·기록 범위를 확인한다. 알림 수신 동의와 별도로 기존 날씨 설정 키를 유지한다. */
export function WeatherLocationPage() {
  const weather = useWeatherLocationSettings()
  const { isNative, status, isLoading, isRequesting } = weather
  return (
    <SettingsDetailLayout title="날씨 및 위치" description="코디와 착용 기록에 사용할 위치를 설정해요."
      entryTo="/settings/weather-location" refreshing={isLoading} onRefresh={() => void weather.refresh()}>
      <section aria-labelledby="weather-location-heading">
        <h2 id="weather-location-heading" className="settings-detail-section-heading">날씨 사용</h2>
        <div className="settings-detail-group">
          {isNative ? (
            <PermissionSettingRow title="위치 기반 날씨" description="현재 지역의 날씨를 코디 추천과 착용일 기온 기록에 사용해요."
              status={isLoading ? '확인 중…' : permissionStatusLabels[status]}
              actionLabel={permissionActionLabel('location', status, isRequesting)} disabled={isRequesting || isLoading}
              onActivate={() => void weather.changeNativePermission()} />
          ) : (
            <ToggleSettingRow title="위치 기반 날씨" description="현재 지역의 날씨를 코디 추천과 착용일 기온 기록에 사용해요."
              checked={weather.weatherEnabled} disabled={isRequesting || isLoading} onChange={(checked) => void weather.toggleWebWeather(checked)} />
          )}
        </div>
      </section>
      <section aria-labelledby="weather-location-privacy-heading">
        <h2 id="weather-location-privacy-heading" className="settings-detail-section-heading">위치 사용 안내</h2>
        <div className="settings-detail-group">
          <div className="settings-detail-note settings-detail-privacy">
            <p className="settings-detail-note-title">착용한 날의 기온을 남겨요</p>
            <p>날씨를 확인한 지역을 저장해, 날짜가 지난 착용 기록에 그날의 평균 기온을 남겨요.</p>
          </div>
          <div className="settings-detail-note settings-detail-privacy">
            <p className="settings-detail-note-title">앱을 사용할 때만 확인해요</p>
            <p>앱을 사용하지 않을 때 새 위치를 수집하지 않아요.</p>
          </div>
        </div>
      </section>
      {weather.error && <p role="alert" className="settings-detail-message settings-detail-error settings-detail-feedback">{weather.error}</p>}
    </SettingsDetailLayout>
  )
}
