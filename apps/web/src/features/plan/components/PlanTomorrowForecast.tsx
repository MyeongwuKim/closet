import { useCallback, useEffect, useRef, useState } from 'react'
import { CloudSun, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { openNativeExternalUrl } from '../../../native-bridge'
import { usePlannerLocationWeather } from '../hooks/usePlannerLocationWeather'
import { TodayOutfitRecommendationPopover } from './today-outfit-recommendation/TodayOutfitRecommendationPopover'

interface PlanTomorrowForecastProps {
  date: string
  /** 날짜 상세는 추천 시트가 열려 있는 동안 배경 편집을 잠근다. */
  onOpenChange?: (isOpen: boolean) => void
  /** 날짜 코디를 저장한 뒤 기존 편집 초안을 비울 때 사용한다. */
  onApplied?: () => void
}

/** 플래너의 내일에 해당 날짜 예보를 표시한다. 추천 버튼을 눌렀을 때만 예보를 추천에 넘겨 실행한다. */
export function PlanTomorrowForecast({ date, onOpenChange, onApplied }: PlanTomorrowForecastProps) {
  const { weather, isEnabled, isCheckingPermission, errorMessage, actions } = usePlannerLocationWeather(date)
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => () => onOpenChange?.(false), [onOpenChange])

  const openRecommendation = () => {
    setIsRecommendationOpen(true)
    onOpenChange?.(true)
  }

  const closeRecommendation = useCallback(() => {
    setIsRecommendationOpen(false)
    onOpenChange?.(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
  }, [onOpenChange])

  return (
    <section aria-label="내일 예보" className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-line bg-surface p-3 sm:px-4">
      <div className="flex min-w-0 flex-1 basis-36 items-start gap-2.5">
        <CloudSun size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h2 className="text-sm font-bold">내일 예보</h2>
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
            <p role="status" className="mt-0.5 text-xs leading-5 text-muted">내일 예보 확인 중</p>
          ) : isEnabled ? (
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs leading-5 text-muted">
              <p role="status">예보를 불러오지 못했어요.</p>
              <button type="button" onClick={actions.retry} className="font-semibold text-accent underline underline-offset-2">다시 확인</button>
            </div>
          ) : (
            <Link to="/settings/notifications-weather" className="mt-0.5 inline-block text-xs leading-5 text-accent underline underline-offset-2">
              위치 기반 날씨 켜기
            </Link>
          )}
        </div>
      </div>
      <button
        ref={triggerRef}
        type="button"
        onClick={openRecommendation}
        aria-haspopup="dialog"
        aria-expanded={isRecommendationOpen}
        className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-white transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
      >
        <Sparkles size={15} aria-hidden="true" />
        내일 코디 추천
      </button>
      {isRecommendationOpen && (
        <TodayOutfitRecommendationPopover
          date={date}
          mode="tomorrow"
          initialWeather={isEnabled ? weather ?? undefined : undefined}
          onClose={closeRecommendation}
          onApplied={() => {
            onApplied?.()
            closeRecommendation()
          }}
        />
      )}
    </section>
  )
}
