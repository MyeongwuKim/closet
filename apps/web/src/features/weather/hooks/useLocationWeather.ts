/**
 * 용도:
 * 현재 위치 권한 요청부터 날씨 조회까지 화면에서 사용할 상태와 동작을 제공한다.
 *
 * 동작 방식:
 * 네이티브 브리지 또는 브라우저에서 좌표를 받은 뒤 날씨 쿼리를 활성화한다.
 * 화면 진입과 브라우저·네이티브 앱 복귀 때 만료된 예보만 다시 조회한다.
 * 갱신 전에는 위치도 다시 확인하며, 동시에 도착한 복귀 이벤트는 한 요청으로 처리한다.
 * 위치·날씨 조회 실패는 안내 문구로 반환하고 이전 날씨를 현재 값으로 표시하지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getCurrentLocation } from '../../../native-bridge'
import {
  useWeatherForecastQuery,
  weatherForecastQueryOptions,
  type WeatherCoordinates,
} from '../api/weatherQueries'
import { hasWeatherExpired, subscribeWeatherReturn } from '../utils/weatherRefresh'

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
  const queryClient = useQueryClient()
  // 마지막으로 확인한 좌표로 예보를 구독한다. 위치 확인 실패 시 null로 비운다.
  const [coordinates, setCoordinates] = useState<WeatherCoordinates | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  // 자동 조회를 끈 화면에서도 명시적인 날씨 선택 이후에는 복귀 갱신을 사용한다.
  const [hasRequested, setHasRequested] = useState(false)
  const enabled = options.autoLoad ?? hasRequested
  const weatherQuery = useWeatherForecastQuery(date, coordinates, enabled)
  // 진행 중인 조회의 표식이다. 날짜 변경·화면 해제 뒤 이전 결과의 UI 반영을 막는다.
  const pendingRequest = useRef<object | null>(null)

  useEffect(() => () => {
    pendingRequest.current = null
  }, [date])

  /** 위치를 확인한 뒤 해당 좌표의 만료 전 캐시를 사용하거나 새 예보를 조회한다. 중복 요청은 건너뛴다. */
  const loadWeather = useCallback(async () => {
    if (pendingRequest.current) return
    const request = {}
    pendingRequest.current = request
    setHasRequested(true)
    setIsLocating(true)
    setLocationError(null)
    try {
      const result = await getCurrentLocation()
      if (pendingRequest.current !== request) return
      if (result.status !== 'available') {
        setCoordinates(null)
        setLocationError(getLocationErrorMessage(result))
        return
      }
      const nextCoordinates = {
        latitude: result.latitude,
        longitude: result.longitude,
      }
      setCoordinates(nextCoordinates)
      // 같은 좌표여도 fetchQuery가 서버 만료 시각을 확인해 만료된 예보를 갱신한다.
      await queryClient.fetchQuery(weatherForecastQueryOptions(date, nextCoordinates))
    } catch (error) {
      if (pendingRequest.current !== request) return
      setLocationError(
        error instanceof Error ? error.message : '현재 위치의 날씨를 확인하지 못했어요.',
      )
    } finally {
      if (pendingRequest.current === request) {
        pendingRequest.current = null
        setIsLocating(false)
      }
    }
  }, [date, queryClient])

  useEffect(() => {
    if (!options.autoLoad) return
    const timeoutId = window.setTimeout(() => void loadWeather(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [date, loadWeather, options.autoLoad])

  // 타이머로 반복 조회하지 않고 복귀할 때만 만료 여부를 검사한다.
  useEffect(() => {
    if (!enabled) return
    return subscribeWeatherReturn(() => {
      if (hasWeatherExpired(weatherQuery.data, weatherQuery.dataUpdatedAt)) {
        void loadWeather()
      }
    })
  }, [enabled, loadWeather, weatherQuery.data, weatherQuery.dataUpdatedAt])

  /** 실패한 위치·예보 조회를 다시 시도한다. 이전 좌표를 고정해서 재조회하지 않는다. */
  const retry = () => {
    void loadWeather()
  }

  const errorMessage = locationError ??
    (weatherQuery.isError
      ? weatherQuery.error instanceof Error
        ? weatherQuery.error.message
        : '현재 위치의 날씨를 불러오지 못했어요.'
      : null)

  return {
    weather: errorMessage ? null : weatherQuery.data ?? null,
    isLoading: isLocating || weatherQuery.isFetching,
    errorMessage,
    actions: { loadWeather, retry },
  }
}
