import type { WardrobeItem, WardrobeRediscovery } from '@closet/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRediscoveryCarousel } from '../hooks/useRediscoveryCarousel'
import { WardrobeRediscoveryCard } from './WardrobeRediscoveryCard'
import { RediscoveryNotificationLink } from './RediscoveryNotificationLink'

interface Props {
  data: WardrobeRediscovery
  viewerId: string
  enabled: boolean
  initialItemId: string | null
  onOpen: (itemId: string) => void
  onRecommend: (item: WardrobeItem) => void
}

/** 다음 옷이 살짝 보이는 한 벌 중심 목록이다. 한 벌이면 고정하고 여러 벌일 때만 번호와 이전·다음 조작을 표시한다. */
export function WardrobeRediscoveryCarousel({ data, viewerId, enabled, initialItemId, onOpen, onRecommend }: Props) {
  const { rail, activeIndex, onScroll, moveTo } = useRediscoveryCarousel(Math.max(0, data.items.findIndex((entry) => entry.item.id === initialItemId)))
  const multiple = data.items.length > 1
  return (
    <>
      <div ref={rail} className="rediscovery-carousel focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent" data-single={!multiple} role="region" aria-roledescription="캐러셀" aria-label="잊고 있던 옷 목록" tabIndex={multiple ? 0 : -1} onScroll={onScroll}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          const next = event.key === 'ArrowRight' ? activeIndex + 1 : event.key === 'ArrowLeft' ? activeIndex - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? data.items.length - 1 : null
          if (next === null) return
          event.preventDefault()
          moveTo(Math.max(0, Math.min(data.items.length - 1, next)))
        }}>
        {data.items.map((entry, index) => <WardrobeRediscoveryCard key={entry.item.id} entry={entry} day={data.day} viewerId={viewerId} active={index === activeIndex} enabled={enabled}
          position={`${index + 1} / ${data.items.length}`} onOpen={() => onOpen(entry.item.id)} onRecommend={() => onRecommend(entry.item)} />)}
      </div>
      {multiple && <div className="rediscovery-controls mx-5 mt-4 flex items-center justify-between gap-3 pb-2">
        <p className="text-xs text-muted">옆으로 넘겨 다른 옷도 확인해보세요.</p>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="이전 옷" disabled={activeIndex === 0} onClick={() => moveTo(activeIndex - 1)} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:border-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30"><ChevronLeft size={18} aria-hidden="true" /></button>
          <span role="status" aria-live="polite" aria-atomic="true" className="min-w-12 text-center text-xs font-medium tabular-nums">{activeIndex + 1} / {data.items.length}</span>
          <button type="button" aria-label="다음 옷" disabled={activeIndex === data.items.length - 1} onClick={() => moveTo(activeIndex + 1)} className="flex size-11 items-center justify-center rounded-full border border-line bg-surface hover:border-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30"><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
      </div>}
      <RediscoveryNotificationLink itemId={data.items[activeIndex]?.item.id} />
    </>
  )
}
