/**
 * 용도:
 * 알림·위치 기반 날씨 사용 설정을 화면 간에 공유한다.
 *
 * 동작 방식:
 * 브라우저 저장소에서 설정을 읽고, 누락되거나 잘못된 값은 기본값으로 정리한다.
 * 저장하면 열린 화면에도 변경 이벤트를 보내 날씨 지역 동기화를 갱신한다.
 */
export interface NotificationWeatherPreferences {
  locationWeather: boolean
  locationWeatherDisabled: boolean
}

const STORAGE_KEY = 'closet:notification-weather-preferences:v1'
const defaultPreferences: NotificationWeatherPreferences = {
  locationWeather: false,
  locationWeatherDisabled: false,
}

export function readNotificationWeatherPreferences(): NotificationWeatherPreferences {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (!value) return defaultPreferences
    const parsed = JSON.parse(value) as Partial<NotificationWeatherPreferences>
    return {
      locationWeather: parsed.locationWeather === true,
      locationWeatherDisabled: parsed.locationWeatherDisabled === true,
    }
  } catch {
    return defaultPreferences
  }
}

export function saveNotificationWeatherPreferences(
  preferences: NotificationWeatherPreferences,
) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  window.dispatchEvent(new Event('closet:weather-preferences-changed'))
}
