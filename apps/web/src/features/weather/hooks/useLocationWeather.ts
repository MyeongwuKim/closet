/**
 * 용도:
 * 현재 위치 권한 요청부터 날씨 조회까지 화면에서 사용할 상태와 동작을 제공한다.
 *
 * 동작 방식:
 * 네이티브 브리지 또는 브라우저에서 좌표를 받은 뒤 날씨 쿼리를 활성화한다.
 * 필요한 화면에서는 자동 조회를 켤 수 있으며,
 * 권한 거절과 위치 서비스 비활성 상태를 사용자가 이해할 수 있는 문구로 변환한다.
 */
import { useCallback, useEffect, useState } from 'react'
import { getCurrentLocation } from '../../../native-bridge'
import {
  useWeatherForecastQuery,
  type WeatherCoordinates,
} from '../api/weatherQueries'

function getLocationErrorMessage(
  result: Exclude<
    Awaited<ReturnType<typeof getCurrentLocation>>,
    { status: 'available' }
  >,
) {
  if (result.status === 'permission-denied') {
    return result.canAskAgain
      ? '현재 날씨를 사용하려면 위치 접근을 허용해 주세요.'
      : '기기 설정에서 위치 권한을 허용해 주세요.'
  }
  if (result.status === 'services-disabled') {
    return '기기의 위치 서비스를 켠 뒤 다시 시도해 주세요.'
  }
  return result.message || '현재 위치를 확인하지 못했어요.'
}

export function useLocationWeather(
  date: string,
  options: { autoLoad?: boolean } = {},
) {
  const [coordinates, setCoordinates] = useState<WeatherCoordinates | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const weatherQuery = useWeatherForecastQuery(date, coordinates)

  const loadWeather = useCallback(async () => {
    setIsLocating(true)
    setLocationError(null)
    try {
      const result = await getCurrentLocation()
      if (result.status !== 'available') {
        setCoordinates(null)
        setLocationError(getLocationErrorMessage(result))
        return
      }
      setCoordinates({
        latitude: result.latitude,
        longitude: result.longitude,
      })
    } catch {
      setCoordinates(null)
      setLocationError('현재 위치를 확인하지 못했어요.')
    } finally {
      setIsLocating(false)
    }
  }, [])

  useEffect(() => {
    if (!options.autoLoad) return
    const timeoutId = window.setTimeout(() => void loadWeather(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [date, loadWeather, options.autoLoad])

  const retry = () => {
    if (coordinates) {
      void weatherQuery.refetch()
      return
    }
    void loadWeather()
  }

  return {
    weather: weatherQuery.data ?? null,
    isLoading: isLocating || weatherQuery.isFetching,
    errorMessage:
      locationError ??
      (weatherQuery.isError
        ? weatherQuery.error instanceof Error
          ? weatherQuery.error.message
          : '현재 위치의 날씨를 불러오지 못했어요.'
        : null),
    actions: { loadWeather, retry },
  }
}
