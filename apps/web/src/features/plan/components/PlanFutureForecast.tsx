import { useRef, useState } from 'react'
import { CloudSun, Sparkles, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { openNativeExternalUrl } from '../../../native-bridge'
import type { usePlannerLocationWeather } from '../hooks/usePlannerLocationWeather'
import { TodayOutfitRecommendationPopover } from './today-outfit-recommendation/TodayOutfitRecommendationPopover'
import { WearHistoryLink } from '../../wear-history/components/WearHistoryLink'

interface PlanFutureForecastProps {
  date: string
  forecast: ReturnType<typeof usePlannerLocationWeather>
  /** 내일 날짜에서 AI 코디 추천 버튼을 표시한다. */
  isTomorrow: boolean
}

/** 하루 보기의 접힌 예보 버튼을 열면 선택일 예보와 온도별 착용 기록을 보여준다. */
export function PlanFutureForecast({ date, forecast, isTomorrow }: PlanFutureForecastProps) {
  const location = useLocation()
  const { weather, isEnabled, isCheckingPermission, errorMessage, actions } = forecast
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const forecastToggleRef = useRef<HTMLButtonElement>(null)
  const forecastLabel = isTomorrow ? '내일 예보' : '이날 예보'

  const closeRecommendation = () => {
    setIsRecommendationOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
  }

  const toggleForecast = () => {
    setIsCollapsed(!isCollapsed)
    window.requestAnimationFrame(() => forecastToggleRef.current?.focus({ preventScroll: true }))
  }

  if (isCollapsed) {
    return (
      <button
        ref={forecastToggleRef}
        type="button"
        aria-expanded={false}
        onClick={toggleForecast}
        className="absolute start-3 top-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-accent sm:start-4"
      >
        <CloudSun size={16} aria-hidden="true" />
        {forecastLabel} · 코디 보기
      </button>
    )
  }

  return (
    <section aria-label={forecastLabel}
      className="plan-forecast-bubble absolute inset-x-3 top-4 z-30 flex max-w-[25rem] flex-wrap items-center justify-between gap-x-2 rounded-2xl border border-line bg-surface px-3 pb-2 pt-1 sm:inset-x-4">
      <WearHistoryLink variant="bubble" date={date} from={`${location.pathname}${location.search}`}
        temperature={isEnabled ? weather?.meanTemperatureC : null} />
      <button
        ref={forecastToggleRef}
        type="button"
        aria-label="예보 말풍선 접기"
        aria-expanded={true}
        onClick={toggleForecast}
        className="-me-1 inline-grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-canvas"
      >
        <X size={17} aria-hidden="true" />
      </button>
      <div className="flex min-w-0 flex-1 basis-36 items-start gap-2">
        <CloudSun size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="text-xs font-semibold">{forecastLabel}</h2>
            {isEnabled && weather && (
              <a
                href={weather.attributionUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-muted underline underline-offset-2"
                onClick={(event) => {
                  event.preventDefault()
                  void openNativeExternalUrl(weather.attributionUrl)
                }}
              >{weather.attribution}</a>
            )}
          </div>
          {isEnabled && weather ? (
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs leading-5 text-muted">
              <span className="font-semibold text-ink">{weather.summary}</span>
              <span>최저 {weather.minTemperatureC}° · 최고 {weather.maxTemperatureC}°</span>
              {weather.precipitationProbability !== null && <span>강수 확률 {weather.precipitationProbability}%</span>}
            </div>
          ) : isCheckingPermission || (isEnabled && !errorMessage) ? (
            <p role="status" className="mt-0.5 text-xs leading-5 text-muted">{forecastLabel} 확인 중</p>
          ) : isEnabled ? (
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs leading-5 text-muted">
              <p role="status">예보를 불러오지 못했어요.</p>
              <button type="button" onClick={actions.retry} className="font-semibold text-accent underline underline-offset-2">다시 확인</button>
            </div>
          ) : (
            <Link to="/settings/weather-location" className="mt-0.5 inline-block text-xs leading-5 text-accent underline underline-offset-2">
              위치 기반 날씨 켜기
            </Link>
          )}
        </div>
      </div>
      {isTomorrow && <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsRecommendationOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isRecommendationOpen}
        className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-white transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        <Sparkles size={15} aria-hidden="true" />
        내일 코디 추천
      </button>}
      {isRecommendationOpen && (
        <TodayOutfitRecommendationPopover
          date={date}
          mode="tomorrow"
          initialWeather={isEnabled ? weather ?? undefined : undefined}
          onClose={closeRecommendation}
          onApplied={closeRecommendation}
        />
      )}
    </section>
  )
}
