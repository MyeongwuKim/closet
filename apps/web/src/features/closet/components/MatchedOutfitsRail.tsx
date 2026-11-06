import type { WardrobeItem } from '@closet/types'
import { ChevronRight, Plus } from 'lucide-react'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'
import { getOutfitStyleLabel } from '../../../constants/styleOptions'
import { OutfitItemsPreview } from '../../lookbook/components/OutfitItemsPreview'
import type { SavedOutfit } from '../../lookbook/types'
import { getSavedOutfitItems } from '../../lookbook/utils/savedOutfitItems'

interface MatchedOutfitsRailProps {
  items: WardrobeItem[]
  outfits: SavedOutfit[]
  isLoading?: boolean
  onOutfitClick: (outfit: SavedOutfit) => void
  onViewAll: () => void
}

const railClassName = 'scrollbar-hidden mt-3 grid auto-cols-[160px] grid-flow-col gap-2.5 overflow-x-auto pb-2 sm:auto-cols-[180px]'

/** 옷 상세 아래에 해당 옷의 코디를 표시한다. 조회 중과 빈 상태는 같은 높이의 안내를 사용하며 카드 선택·전체보기는 부모에 맡긴다. */
export function MatchedOutfitsRail({
  items,
  outfits,
  isLoading = false,
  onOutfitClick,
  onViewAll,
}: MatchedOutfitsRailProps) {
  const showOutfits = !isLoading && outfits.length > 0

  return (
    <section aria-labelledby="matched-outfits-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2
            id="matched-outfits-title"
            className="text-sm font-semibold tracking-tight"
          >
            이 아이템이 포함된 코디
          </h2>
          <p className="mt-1 text-[11px] text-muted">코디북에 저장한 최근 조합</p>
        </div>
        {showOutfits && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          >
            전체보기 <ChevronRight size={14} />
          </button>
        )}
      </div>

      {showOutfits ? (
        <div className={railClassName}>
          {outfits.map((outfit) => (
            <button
              type="button"
              onClick={() => onOutfitClick(outfit)}
              className="group overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-left transition hover:-translate-y-0.5 hover:border-ink focus-visible:outline-2 focus-visible:outline-accent"
              aria-label={`${outfit.name} 코디 상세 보기`}
              key={outfit.id}
            >
              <OutfitItemsPreview
                items={getSavedOutfitItems(outfit, items)}
                layers={outfit.layers}
                showArchivedStatus
                className="aspect-[4/3] w-full"
              />
              <span className="block px-1 pt-2 pb-1">
                <span className="inline-flex rounded-full bg-sage px-1.5 py-0.5 text-[9px] font-medium">
                  {getOutfitStyleLabel(outfit.style)}
                </span>
                <strong className="mt-1 block truncate text-xs font-medium">
                  {outfit.name}
                </strong>
                <span className="mt-1 block text-[10px] text-muted">
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
        <div
          className="mt-3 flex flex-col items-center rounded-2xl bg-surface/60 px-3 py-4 text-center"
          role={isLoading ? 'status' : undefined}
          aria-label={isLoading ? '저장한 코디를 불러오는 중' : undefined}
        >
          <div className="flex h-7 items-center justify-center gap-1.5 text-accent" aria-hidden="true">
            {isLoading ? (
              <div className="flex gap-1.5 motion-safe:animate-pulse">
                {['top', 'bottom'].map((category) => (
                  <span key={category} className="grid size-7 place-items-center rounded-lg border border-line bg-accent/10">
                    <ClothingCategoryIcon category={category} size={16} strokeWidth={1.5} />
                  </span>
                ))}
              </div>
            ) : (
              <>
                <ClothingCategoryIcon category="top" size={28} strokeWidth={1.4} />
                <Plus size={10} strokeWidth={1.5} />
                <ClothingCategoryIcon category="bottom" size={28} strokeWidth={1.4} />
              </>
            )}
          </div>
          {isLoading ? (
            <p className="mt-2 text-xs font-medium text-muted">저장한 코디를 불러오는 중이에요</p>
          ) : (
            <h3 className="mt-2 text-xs font-medium text-muted">아직 매칭한 코디가 없어요</h3>
          )}
        </div>
      )}
    </section>
  )
}
