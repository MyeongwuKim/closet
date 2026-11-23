import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WeatherSnapshot } from '@closet/types'
import { CloudSun, X } from 'lucide-react'
import { WeatherSnapshotSummary } from '../../weather/components/WeatherSnapshotSummary'
import { WearHistoryLink } from '../../wear-history/components/WearHistoryLink'

interface PlanWeatherBadgeProps {
  weather: WeatherSnapshot
  forecastLabel?: string
  historyDate?: string
}

/** 제목 옆 기온을 누르면 날씨 상세와 착용 기록 입구를 펼친다. 같은 날짜의 예보 평균만 기록 필터로 사용하며 팝업은 본문 높이를 바꾸지 않는다. */
export function PlanWeatherBadge({ weather, forecastLabel, historyDate }: PlanWeatherBadgeProps) {
  const popupId = useId()
  const title = forecastLabel ?? '오늘의 날씨'
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  /** 배지 바로 아래에 팝업을 배치하되 좁은 화면에서도 좌우 여백 16px을 확보한다. */
  function toggleDetails() {
    if (position) {
      setPosition(null)
      return
    }
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(288, window.innerWidth - 32)
    setPosition({ top: rect.bottom + 8, left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)), width })
  }

  const isOpen = position !== null
  // 외부 클릭·바깥 스크롤·Escape·화면 크기 변경 시 닫고 내부 스크롤은 유지한다. Escape는 배지로 초점을 되돌린다.
  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !triggerRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) setPosition(null)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setPosition(null)
      triggerRef.current?.focus({ preventScroll: true })
    }
    function closeDetails() { setPosition(null) }
    function handleScroll(event: Event) {
      if (event.target instanceof Node && popupRef.current?.contains(event.target)) return
      closeDetails()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closeDetails)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closeDetails)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen])

  return (
    <>
      <button ref={triggerRef} type="button" onClick={toggleDetails}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[11px] font-medium text-muted"
        aria-label={`${forecastLabel ?? '오늘'} ${weather.temperatureC}도, ${weather.summary}, 날씨 자세히 보기`}
        aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={isOpen ? popupId : undefined}>
        <CloudSun size={14} aria-hidden="true" />{weather.temperatureC}°
      </button>
      {position && createPortal(
        <section ref={popupRef} id={popupId} role="dialog" aria-label={title}
          className="fixed z-[100] overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-4 shadow-[0_8px_28px_rgba(67,57,47,0.12)]"
          style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 16}px)` }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="min-w-0 text-sm font-semibold break-keep">{title}</h2>
            <button type="button" aria-label="날씨 자세히 보기 닫기" autoFocus
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas"
              onClick={() => { setPosition(null); triggerRef.current?.focus({ preventScroll: true }) }}><X size={16} /></button>
          </div>
          <WeatherSnapshotSummary weather={weather} />
          <p className="mt-3 text-xs text-muted">최저 {weather.minTemperatureC}° · 최고 {weather.maxTemperatureC}°</p>
          {weather.precipitationProbability !== null && <p className="mt-1.5 text-xs text-muted">강수 확률 {weather.precipitationProbability}%</p>}
          {historyDate && <div className="mt-3">
            <WearHistoryLink variant="weather" date={historyDate} from={`/plan?view=today&date=${historyDate}`}
              temperature={historyDate === weather.date ? weather.meanTemperatureC : null} />
          </div>}
        </section>, document.body,
      )}
    </>
  )
}
