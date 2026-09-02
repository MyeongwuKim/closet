/**
 * 용도:
 * 코디 추천 화면에서 조회한 기온과 날씨 상태, 데이터 출처를 함께 보여준다.
 *
 * 구조:
 * 기온 요약 배지와 Open-Meteo 출처 링크로 구성되어 있다.
 */
import type { WeatherSnapshot } from '@closet/types'
import { CloudSun } from 'lucide-react'
import { openNativeExternalUrl } from '../../../native-bridge'

interface WeatherSnapshotSummaryProps {
  weather: WeatherSnapshot
  compact?: boolean
}

export function WeatherSnapshotSummary({
  weather,
  compact = false,
}: WeatherSnapshotSummaryProps) {
  return (
    <div className={compact ? 'mt-1.5' : 'mt-2'}>
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-800">
        <CloudSun size={11} />
        {weather.temperatureC}° · {weather.summary} · 체감{' '}
        {weather.apparentTemperatureC}°
      </span>
      <a
        href={weather.attributionUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          event.preventDefault()
          void openNativeExternalUrl(weather.attributionUrl)
        }}
        className="ml-1.5 text-[9px] font-medium text-muted underline underline-offset-2 hover:text-ink"
      >
        Open-Meteo
      </a>
    </div>
  )
}
