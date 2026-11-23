import type { OutfitWardrobeItem } from '../types'
import { ArchivedWardrobeItemBadge } from '../../closet/components/ArchivedWardrobeItemBadge'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { outfitSlots } from './outfitSlots'

function categoryLabel(item: OutfitWardrobeItem) {
  if (item.isBaseLayer) return '받쳐 입는 옷'
  if (item.category === 'dress') return '원피스'
  return outfitSlots.find((slot) => slot.matches(item))?.label ?? '기타'
}

/** 저장된 구성만 사진과 이름으로 보여준다. 빈 슬롯을 만들지 않고 삭제된 옷도 기록에 남은 정보로 표시한다. */
export function OutfitReadView({ items }: { items: OutfitWardrobeItem[] }) {
  if (!items.length) return <p className="py-12 text-center text-sm text-muted">담긴 옷이 없어요.</p>
  return (
    <div className="mx-auto w-full max-w-xl">
      <div aria-label="완성한 코디 구성" className={`grid gap-3 rounded-3xl border border-line bg-[#efede6] p-3 ${items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${items.length === 3 ? 'h-96 grid-rows-2' : ''}`}>
        {items.map((item, index) => (
          <div key={item.id} className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-surface ${items.length === 3 ? index === 0 ? 'row-span-2' : '' : 'aspect-[4/5]'}`}>
            <div className="flex min-h-0 flex-1 items-center justify-center p-2"><ClosetItemVisual item={item} /></div>
            {item.archivedAt && <ArchivedWardrobeItemBadge className="absolute top-2 left-2" />}
            <span className="flex min-h-8 shrink-0 items-center justify-center border-t border-line px-2 text-xs font-semibold">{categoryLabel(item)}</span>
          </div>
        ))}
      </div>
      <section className="mt-5" aria-label="이 코디에 담은 옷">
        <h2 className="text-sm font-semibold">이 코디에 담은 옷</h2>
        <dl className="mt-2 space-y-2">
          {items.map((item) => <div key={item.id} className="flex min-h-7 items-start gap-4 text-xs leading-5">
            <dt className="w-16 shrink-0 text-muted">{categoryLabel(item)}</dt>
            <dd className="min-w-0 break-words font-medium">{item.name}{item.archivedAt && <span className="ml-2 text-muted">옷장에서 삭제됨</span>}</dd>
          </div>)}
        </dl>
      </section>
    </div>
  )
}
