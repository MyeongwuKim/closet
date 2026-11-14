import { ChevronRight } from 'lucide-react'
import { OutfitCardVisual } from '../../lookbook/components/OutfitCardVisual'
import { formatTemperatureWearDate, formatWearTemperature, wearFeelingLabels } from '../utils/temperatureHistory'
import type { WearHistoryGroup } from '../types'

/** 같은 조합의 대표 사진과 현재 필터에 맞는 날짜의 기온·체감을 표시한다. */
export function WearHistoryCard({ group, onOpen }: { group: WearHistoryGroup; onOpen: () => void }) {
  const record = group.records.find(candidate => candidate.date === group.matchingDate)!
  return (
    <button type="button" data-catalog-item onClick={onOpen} className="group min-w-0 text-left" aria-label={`${group.outfit.name} 착용 기록 보기`}>
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-1.5">
        <OutfitCardVisual outfit={group.outfit} items={[]} className="aspect-[4/5] rounded-lg" />
        <span className="absolute bottom-3 left-3 rounded-lg bg-surface/95 px-2 py-1.5 text-xs font-semibold text-ink">{formatWearTemperature(record.temperatureC)}</span>
      </div>
      <div className="px-0.5 pt-2.5">
        <h2 className="truncate text-sm font-semibold" title={group.outfit.name}>{group.outfit.name}</h2>
        <p className="mt-1 text-xs text-muted">{record.feeling ? wearFeelingLabels[record.feeling] : '체감 미기록'} · 총 {group.records.length}회 착용</p>
        <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted"><time dateTime={record.date}>{formatTemperatureWearDate(record.date)}</time><ChevronRight size={15} strokeWidth={1.5} aria-hidden="true" /></p>
      </div>
    </button>
  )
}
