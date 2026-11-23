/**
 * 사용 위치: 플래너 상단 → 화면 제목 옆
 *
 * 용도:
 * 위치 권한이 이미 허용됐거나 날씨 사용 설정이 켜져 있으면
 * 오늘의 기온 또는 선택한 미래 날짜의 예보를 짧게 보여준다.
 *
 * 표시:
 * 날씨를 펼치면 선택 날짜의 착용 기록으로 이어진다. 예보가 없을 때는 같은 상단 영역에 전체 기록 입구를 남긴다.
 */
import { CloudSun, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { usePlannerLocationWeather } from '../hooks/usePlannerLocationWeather'
import { PlanWeatherBadge } from './PlanWeatherBadge'
import { WearHistoryLink } from '../../wear-history/components/WearHistoryLink'

interface PlanHeaderWeatherProps {
  forecast: ReturnType<typeof usePlannerLocationWeather>
  forecastLabel?: string
  historyDate?: string
}

export function PlanHeaderWeather({ forecast, forecastLabel, historyDate }: PlanHeaderWeatherProps) {
  const { weather, isLoading, errorMessage, actions, isEnabled, isCheckingPermission } = forecast

  if (!isCheckingPermission && isEnabled && weather) {
    return <PlanWeatherBadge weather={weather} forecastLabel={forecastLabel} historyDate={historyDate} />
  }

  const status = isCheckingPermission ? (
      <span className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[11px] font-medium text-muted" role="status" aria-label="위치 확인 중">
        <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
        날씨 확인
      </span>
    ) : !isEnabled ? (
      <Link
        to="/settings/weather-location"
        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[11px] font-medium text-muted"
        aria-label="위치 기반 날씨 켜기"
      >
        <CloudSun size={14} aria-hidden="true" /> 날씨
      </Link>
    ) : errorMessage ? (
      <button
        type="button"
        onClick={actions.retry}
        className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[11px] font-medium text-muted"
        title={errorMessage}
        aria-label={`${errorMessage} 다시 확인`}
      >
        <CloudSun size={14} aria-hidden="true" /> 재시도
      </button>
    ) : (
      <span className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[11px] font-medium text-muted" role="status" aria-label={`${forecastLabel ?? '오늘 날씨'} 확인 중`}>
        <LoaderCircle size={14} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
        날씨 확인
      </span>
    )

  return (
    <div className="flex flex-wrap items-center gap-x-3">
      {status}
      {historyDate && !forecastLabel && <WearHistoryLink variant="inline" date={historyDate} from={`/plan?view=today&date=${historyDate}`} />}
    </div>
  )
}
