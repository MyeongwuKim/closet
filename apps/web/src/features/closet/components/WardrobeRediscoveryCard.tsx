import type { WardrobeRediscovery } from '@closet/types'
import { ArrowUpRight } from 'lucide-react'
import { ClosetItemVisual } from './ClosetItemVisual'
import { useRediscoveryImpression } from '../hooks/useRediscoveryImpression'

interface Props {
  entry: WardrobeRediscovery['items'][number]
  day: string
  viewerId: string
  enabled: boolean
  onOpen: () => void
  onRecommend: () => void
}

/** 옷장 하이라이트 한 벌의 사진·선정 근거를 표시하고 상세 열기와 기준 옷 코디 추천을 각각 연결한다. */
export function WardrobeRediscoveryCard({ entry, day, viewerId, enabled, onOpen, onRecommend }: Props) {
  const ref = useRediscoveryImpression(viewerId, day, entry.item.id, enabled)
  return (
    <article ref={ref} className="flex min-w-0 gap-3 rounded-2xl border border-line/70 bg-surface p-3" aria-label={`${entry.item.name} 하이라이트`}>
      <button type="button" onClick={onOpen} aria-label={`${entry.item.name} 다시 보기`} className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas focus-visible:outline-2 focus-visible:outline-accent">
        <ClosetItemVisual item={entry.item} compact />
      </button>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-[10px] font-medium text-muted">
          {entry.reason === 'no_wear_record' ? '아직 착용 기록이 없어요' : `마지막 착용 기록 ${entry.daysSinceLastWorn}일 전`}
        </p>
        <button type="button" onClick={onOpen} className="mt-1 truncate text-left text-sm font-bold hover:text-accent" title={entry.item.name}>{entry.item.name}</button>
        <button type="button" onClick={onRecommend} aria-label={`${entry.item.name} 코디 추천`} className="mt-3 inline-flex min-h-8 items-center gap-1 self-start rounded-lg bg-sage px-2.5 text-[11px] font-bold text-ink transition hover:bg-sage/70 focus-visible:outline-2 focus-visible:outline-accent">
          이 옷으로 코디 <ArrowUpRight size={13} aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}
