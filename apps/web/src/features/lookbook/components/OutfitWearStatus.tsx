import { CalendarDays } from 'lucide-react'
import type { OutfitWearSummary } from '../hooks/useOutfitWearSummaries'

interface OutfitWearStatusProps {
  summary?: OutfitWearSummary
}

export function OutfitWearStatus({ summary }: OutfitWearStatusProps) {
  if (!summary) return null

  return (
    <span
      className="mt-2 flex min-w-0 items-center gap-1 border-t border-line pt-2 text-[10px] font-bold text-muted"
      title={summary.title}
    >
      <CalendarDays className="shrink-0" size={12} />
      <span className="truncate">{summary.label}</span>
    </span>
  )
}
