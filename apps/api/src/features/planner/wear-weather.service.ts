import { ServiceError } from '../../graphql/errors.js'
import { getKoreaTodayUtc } from '../wardrobe/wardrobe.service.js'
import { weatherService } from '../weather/weather.service.js'
import { wearWeatherRepository, type WearWeatherLocation } from './wear-weather.repository.js'

/** 허용된 위치를 약 1km 단위로 반올림해 이후 일정에 연결한다. null은 날씨 사용 해제다. */
export async function syncWearWeatherLocation(userId: string, location: WearWeatherLocation | null) {
  if (location && (!Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 || !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180)) {
    throw new ServiceError('올바른 날씨 지역이 필요합니다.', 'INVALID_WEATHER_LOCATION')
  }
  const rounded = location ? { latitude: Math.round(location.latitude * 100) / 100, longitude: Math.round(location.longitude * 100) / 100 } : null
  await wearWeatherRepository.saveLocation(userId, rounded, getKoreaTodayUtc())
  return true
}

/** 실제 착용을 확인한 지난 코디의 평균 기온을 확정한다. 제공자 오류는 기온을 만들지 않고 한 시간 뒤 재시도한다. */
export async function recordPendingWearWeather() {
  const entries = await wearWeatherRepository.pending(getKoreaTodayUtc(), new Date())
  let recorded = 0
  const temperatures = new Map<string, Promise<number>>()
  for (let index = 0; index < entries.length; index += 3) {
    await Promise.all(entries.slice(index, index + 3).map(async (entry) => {
      if (!entry.wornAt || entry.weatherLatitude === null || entry.weatherLongitude === null || !entry.outfitId) return
      if (!await wearWeatherRepository.claim(entry.id, new Date())) return
      try {
        const input = { latitude: entry.weatherLatitude, longitude: entry.weatherLongitude, date: entry.date.toISOString().slice(0, 10) }
        const key = `${input.latitude}:${input.longitude}:${input.date}`
        let temperature = temperatures.get(key)
        if (!temperature) {
          temperature = weatherService.getPastDailyTemperature(input)
          temperatures.set(key, temperature)
        }
        if (await wearWeatherRepository.record(entry, await temperature, new Date())) recorded++
      } catch {
        // 임시 날씨나 예보를 대신 저장하지 않는다. claim에 저장한 재시도 시각까지 대기한다.
      }
    }))
  }
  return recorded
}

/** 앱 실행 여부와 무관하게 지난 일정을 주기적으로 처리하고, 서버 종료 시 진행 중인 저장을 기다린다. */
export function startWearWeatherWorker() {
  let running: Promise<unknown> | null = null
  let stopped = false
  const tick = () => {
    if (stopped || running) return
    running = recordPendingWearWeather().catch(() => console.warn('[wear-weather] recording failed')).finally(() => { running = null })
  }
  const timer = setInterval(tick, 60_000)
  timer.unref()
  tick()
  return async () => { stopped = true; clearInterval(timer); await running }
}
