import { CalendarDays, Thermometer } from 'lucide-react'
import type { OutfitWearSummary } from '../hooks/useOutfitWearSummaries'

interface OutfitWearStatusProps {
  summary?: OutfitWearSummary
  /** 사진 아래 캡션에서는 구분선 없이 착용 기록을 작게 표시한다. */
  compact?: boolean
}

/** 착용을 확인한 기록의 최근 착용·횟수·기온 범위 또는 착용 예정을 표시한다. compact는 목록 사진의 캡션, 기본 형태는 코디 선택 카드에 사용한다. */
export function OutfitWearStatus({ summary, compact = false }: OutfitWearStatusProps) {
  if (!summary) return null

  return (
    <span
      className={`mt-2 flex min-w-0 flex-col gap-1 text-[10px] text-muted ${compact ? 'font-normal' : 'border-t border-line pt-2 font-bold'}`}
      title={summary.title}
    >
      <span className="flex min-w-0 items-center gap-1">
        <CalendarDays className="shrink-0" size={12} aria-hidden="true" />
        <span className="truncate">{summary.label}</span>
      </span>
      {summary.temperatureLabel && <span className="flex items-center gap-1" title={summary.temperatureTitle}>
        <Thermometer className="shrink-0" size={12} aria-hidden="true" />
        <span>{summary.temperatureLabel}</span>
      </span>}
    </span>
  )
}
