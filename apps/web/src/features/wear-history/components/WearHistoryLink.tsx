import { ChevronRight, Thermometer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { createWearHistoryPath, formatWearTemperature } from '../utils/temperatureHistory'

/** 기록 입구만 표시하고 실제 조회는 공통 화면에서 한다. 예보가 늦게 도착해도 행 높이를 유지한다. */
export function WearHistoryLink({ from, date, temperature, planner = false }: { from: string; date?: string; temperature?: number | null; planner?: boolean }) {
  return (
    <Link to={createWearHistoryPath(from, date, temperature)} className={`wear-history-link flex shrink-0 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-accent transition-colors hover:bg-sage ${planner ? 'mt-2 min-h-16' : 'mb-3 min-h-11'}`}>
      <Thermometer size={18} strokeWidth={1.6} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{temperature != null ? '비슷한 기온에 입었던 코디' : '온도별 착용 기록'}</span>
        {planner && <span className="mt-0.5 block text-xs text-muted">{temperature != null ? `예보 ${formatWearTemperature(temperature)} 기준` : '입었던 코디를 찾아 이 날짜에 담아보세요.'}</span>}
      </span>
      <ChevronRight size={18} strokeWidth={1.6} aria-hidden="true" />
    </Link>
  )
}
