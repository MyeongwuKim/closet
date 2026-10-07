import { createPortal } from 'react-dom'
import type { WardrobeItem } from '@closet/types'
import { ChevronLeft } from 'lucide-react'
import { PageTitle } from '../../../components/PageTitle'
import { LookbookOutfitCard } from '../../lookbook/components/LookbookOutfitCard'
import { useOutfitWearSummaries } from '../../lookbook/hooks/useOutfitWearSummaries'
import type { SavedOutfit } from '../../lookbook/types'
import { ClosetItemVisual } from './ClosetItemVisual'

interface MatchedOutfitsModalProps {
  item: WardrobeItem
  items: WardrobeItem[]
  outfits: SavedOutfit[]
  onSelect: (outfitId: string) => void
  onClose: () => void
}

/** 아이템 상세의 전체보기에서 해당 옷이 포함된 모든 코디를 전체 화면으로 표시한다. 부모가 조회한 목록을 재사용하며, 코디 상세 선택과 아이템으로 돌아가는 동작은 부모에 맡긴다. */
export function MatchedOutfitsModal({
  item,
  items,
  outfits,
  onSelect,
  onClose,
}: MatchedOutfitsModalProps) {
  const wearSummaries = useOutfitWearSummaries(
    outfits.map((outfit) => outfit.id),
  )

  return createPortal(
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name}이 포함된 코디`}
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface"
            aria-label="아이템 상세로 돌아가기"
            autoFocus
          >
            <ChevronLeft size={25} strokeWidth={2.2} />
          </button>
          <PageTitle title="포함된 코디" description={item.name} compact />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-5 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface">
              <ClosetItemVisual item={item} compact />
            </div>
            <p className="text-sm text-muted">
              저장한 코디 <strong className="font-semibold text-ink">{outfits.length}</strong>개
            </p>
          </div>

          {outfits.length > 0 ? (
            <div className="wardrobe-item-grid grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
              {outfits.map((outfit) => (
                <LookbookOutfitCard
                  key={outfit.id}
                  outfit={outfit}
                  items={items}
                  wearSummary={wearSummaries.get(outfit.id)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted">아직 매칭한 코디가 없어요.</p>
          )}
        </div>
      </div>
    </section>,
    document.body,
  )
}
