import { ChevronRight, Thermometer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { createWearHistoryPath, formatWearTemperature } from '../utils/temperatureHistory'

interface WearHistoryLinkProps {
  from: string
  date?: string
  temperature?: number | null
  variant?: 'list' | 'weather' | 'inline'
}

/** 코디북·날씨 영역에서 공통 기록 화면을 연다. 예보 평균이 있으면 비슷한 기온으로, 없으면 전체 기록으로 연결한다. */
export function WearHistoryLink({ from, date, temperature, variant = 'list' }: WearHistoryLinkProps) {
  const inline = variant === 'inline'
  const appearance = variant === 'list'
    ? 'catalog-entry-action mb-4'
    : `flex shrink-0 items-center text-accent transition-colors ${inline
      ? 'min-h-11 gap-1.5 text-xs hover:text-ink'
      : 'min-h-11 w-full basis-full gap-2.5 border-t border-line py-2 hover:text-ink'}`
  const iconSize = variant === 'list' ? 15 : inline ? 14 : 18

  return (
    <Link to={createWearHistoryPath(from, date, temperature)} aria-label={inline ? '온도별 착용 기록' : undefined}
      className={`wear-history-link ${appearance}`}>
      <Thermometer size={iconSize} className="shrink-0" strokeWidth={1.6} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={`block text-xs break-keep ${variant === 'list' ? 'font-bold' : 'font-semibold'}`}>
          {inline ? '온도별 기록' : temperature != null ? '비슷한 기온에 입었던 코디 보기' : '온도별 착용 기록'}
        </span>
        {variant === 'weather' && temperature != null && <span className="mt-0.5 block text-[.6875rem] text-muted break-keep">예보 {formatWearTemperature(temperature)} 기준</span>}
      </span>
      {!inline && <ChevronRight size={variant === 'list' ? 15 : 18} className="shrink-0" strokeWidth={1.6} aria-hidden="true" />}
    </Link>
  )
}
