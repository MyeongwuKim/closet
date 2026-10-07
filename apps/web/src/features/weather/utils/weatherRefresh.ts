import type { WeatherSnapshot } from '@closet/types'

export const WEATHER_VALIDITY_MS = 30 * 60 * 1000

/** 서버의 만료 시각을 사용한다. 만료 정보가 없는 이전 응답은 클라이언트 수신 시각부터 30분으로 계산한다. */
function getWeatherExpiry(weather: WeatherSnapshot, dataUpdatedAt: number) {
  const serverExpiry = weather.expiresAt ? Date.parse(weather.expiresAt) : NaN
  return Number.isFinite(serverExpiry)
    ? serverExpiry
    : dataUpdatedAt + WEATHER_VALIDITY_MS
}

/** 아직 날씨가 없거나 만료 시각에 도달했으면 위치와 날씨를 다시 확인해야 한다. */
export function hasWeatherExpired(
  weather: WeatherSnapshot | undefined,
  dataUpdatedAt: number,
  now = Date.now(),
) {
  return !weather || now >= getWeatherExpiry(weather, dataUpdatedAt)
}

/** 쿼리 수신 시각부터 서버 만료 시각까지의 유효시간을 반환해 캐시 재수신 시 수명이 늘어나는 것을 막는다. */
export function getWeatherStaleTime(
  weather: WeatherSnapshot | undefined,
  dataUpdatedAt: number,
) {
  return weather
    ? Math.max(0, getWeatherExpiry(weather, dataUpdatedAt) - dataUpdatedAt)
    : WEATHER_VALIDITY_MS
}

/** 브라우저의 탭·창 복귀와 네이티브 앱의 포그라운드 복귀를 연결하고, 해제 함수를 반환한다. */
export function subscribeWeatherReturn(
  onReturn: () => void,
  windowTarget: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
  documentTarget: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> = document,
) {
  const onBrowserReturn = () => {
    if (documentTarget.visibilityState === 'visible') onReturn()
  }
  documentTarget.addEventListener('visibilitychange', onBrowserReturn)
  windowTarget.addEventListener('focus', onBrowserReturn)
  windowTarget.addEventListener('closet:native-app-active', onReturn)
  return () => {
    documentTarget.removeEventListener('visibilitychange', onBrowserReturn)
    windowTarget.removeEventListener('focus', onBrowserReturn)
    windowTarget.removeEventListener('closet:native-app-active', onReturn)
  }
}
