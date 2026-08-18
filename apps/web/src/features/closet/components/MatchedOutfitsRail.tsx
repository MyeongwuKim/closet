import type { WardrobeItem } from '@closet/types'
import { ChevronRight } from 'lucide-react'
import { getOutfitStyleLabel } from '../../../constants/styleOptions'
import { OutfitItemsPreview } from '../../lookbook/components/OutfitItemsPreview'
import type { SavedOutfit } from '../../lookbook/types'

interface MatchedOutfitsRailProps {
  items: WardrobeItem[]
  outfits: SavedOutfit[]
  onOutfitClick: (outfit: SavedOutfit) => void
  onViewAll: () => void
}

export function MatchedOutfitsRail({
  items,
  outfits,
  onOutfitClick,
  onViewAll,
}: MatchedOutfitsRailProps) {
  return (
    <section className="mt-10" aria-labelledby="matched-outfits-title">
      <div className="flex items-end justify-between">
        <div>
          <h2
            id="matched-outfits-title"
            className="text-xl font-black tracking-tight"
          >
            이 아이템이 포함된 코디
          </h2>
          <p className="mt-1 text-sm text-muted">코디북에 저장한 최근 조합</p>
        </div>
        {outfits.length > 0 && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-sm font-bold text-muted hover:text-ink"
          >
            전체보기 <ChevronRight size={16} />
          </button>
        )}
      </div>

      {outfits.length > 0 ? (
        <div className="scrollbar-hidden mt-5 grid auto-cols-[220px] grid-flow-col gap-3 overflow-x-auto pb-3 sm:auto-cols-[250px]">
          {outfits.map((outfit) => (
            <button
              type="button"
              onClick={() => onOutfitClick(outfit)}
              className="group overflow-hidden rounded-3xl border border-line bg-surface p-2 text-left transition hover:-translate-y-0.5 hover:border-ink focus-visible:outline-2 focus-visible:outline-accent"
              aria-label={`${outfit.name} 코디 상세 보기`}
              key={outfit.id}
            >
              <OutfitItemsPreview
                items={items}
                layers={outfit.layers}
                className="aspect-[4/3] w-full"
              />
              <span className="block px-2 pt-3 pb-2">
                <span className="inline-flex rounded-full bg-sage px-2 py-1 text-[10px] font-bold">
                  {getOutfitStyleLabel(outfit.style)}
                </span>
                <strong className="mt-1.5 block truncate text-sm">
                  {outfit.name}
                </strong>
                <span className="mt-1 block text-xs text-muted">
                  {outfit.layers.length}개 아이템 ·{' '}
                  {new Intl.DateTimeFormat('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  }).format(new Date(outfit.createdAt))}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-3xl border border-dashed border-line bg-surface px-6 py-9 text-center">
          <h3 className="font-black">아직 이 옷으로 저장한 코디가 없어요</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            코디 맞추기 버튼으로 첫 조합을 만들어보세요.
          </p>
        </div>
      )}
    </section>
  )
}
