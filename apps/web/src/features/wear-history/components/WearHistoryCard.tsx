import { OutfitCardVisual } from '../../lookbook/components/OutfitCardVisual'
import { formatWearTemperature, wearFeelingLabels } from '../utils/temperatureHistory'
import type { WearHistoryGroup } from '../types'

/** 사진·기온과 두 줄 요약으로 같은 조합을 표시한다. 날짜별 착용 내역은 선택한 카드의 상세에서 확인한다. */
export function WearHistoryCard({ group, onOpen }: { group: WearHistoryGroup; onOpen: () => void }) {
  const record = group.records.find(candidate => candidate.date === group.matchingDate)!
  return (
    <button type="button" data-catalog-item onClick={onOpen} className="wear-history-card group min-w-0 text-left" aria-label={`${group.outfit.name} 착용 기록 보기`}>
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-1.5">
        <OutfitCardVisual outfit={group.outfit} items={[]} className="aspect-[4/5] rounded-lg" />
        <span className="wear-history-card-temperature">{formatWearTemperature(record.temperatureC)}</span>
      </div>
      <div className="px-0.5 pt-2.5">
        <h3 className="truncate text-sm leading-5 font-semibold" title={group.outfit.name}>{group.outfit.name}</h3>
        <p className="mt-1 text-xs leading-4 text-muted">{record.feeling ? wearFeelingLabels[record.feeling] : '체감 미기록'} · 총 {group.records.length}회 착용</p>
      </div>
    </button>
  )
}

/** 실제 카드와 사진 비율·요약 높이를 맞춰 조회가 끝나도 다음 행이 밀리지 않게 한다. */
export function WearHistoryCardSkeleton() {
  return (
    <div data-history-skeleton aria-hidden="true" className="min-w-0 motion-safe:animate-pulse">
      <div className="overflow-hidden rounded-xl border border-line bg-surface p-1.5"><div className="aspect-[4/5] rounded-lg bg-line/40" /></div>
      <div className="px-0.5 pt-2.5">
        <div className="flex h-5 items-center"><span className="h-3.5 w-2/3 rounded bg-line/40" /></div>
        <div className="mt-1 flex h-4 items-center"><span className="h-3 w-4/5 rounded bg-line/30" /></div>
      </div>
    </div>
  )
}
