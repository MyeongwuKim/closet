import type { WardrobeItem } from '@closet/types'
import { Images, Search, X } from 'lucide-react'
import { ClosetItemVisual } from './ClosetItemVisual'

interface ClosetMultiSelectBarProps {
  selectedItems: WardrobeItem[]
  onClear: () => void
  onViewInLookbook: () => void
  onSendToLookbook: () => void
}

export function ClosetMultiSelectBar({
  selectedItems,
  onClear,
  onViewInLookbook,
  onSendToLookbook,
}: ClosetMultiSelectBarProps) {
  const selectedCount = selectedItems.length
  const isReady = selectedCount >= 2

  return (
    <div className="selection-bar-enter fixed right-4 bottom-20 left-4 z-40 rounded-[1.75rem] border border-line bg-surface p-3.5 text-ink shadow-[0_18px_55px_rgba(27,27,24,0.2)] md:right-auto md:bottom-6 md:left-1/2 md:w-[460px] md:-translate-x-1/2">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2" aria-hidden="true">
          {selectedItems.slice(0, 3).map((item) => (
            <span
              className="flex size-11 items-center justify-center overflow-hidden rounded-2xl border-2 border-surface bg-canvas p-1 shadow-sm"
              key={item.id}
            >
              <ClosetItemVisual item={item} compact />
            </span>
          ))}
          {selectedCount > 3 && (
            <span className="flex size-11 items-center justify-center rounded-2xl border-2 border-surface bg-sage text-xs font-black">
              +{selectedCount - 3}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">
            {isReady ? '코디 준비 완료' : `${selectedCount}개 선택`}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {isReady
              ? '선택한 옷으로 코디를 만들어보세요.'
              : '이 옷이 들어간 코디를 코디북에서 찾아보세요.'}
          </p>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:border-ink hover:text-ink"
          aria-label="선택한 옷 모두 해제"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onViewInLookbook}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-3 text-sm font-bold transition hover:border-ink"
        >
          <Search size={17} /> 코디북에서 보기
        </button>
        <button
          type="button"
          disabled={!isReady}
          onClick={onSendToLookbook}
          className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-bold transition ${
            isReady
              ? 'bg-accent text-white shadow-[0_8px_22px_rgba(240,90,60,0.24)] hover:bg-accent/90'
              : 'cursor-not-allowed bg-canvas text-muted'
          }`}
        >
          <Images size={17} />
          {isReady ? '코디 만들기' : '옷 더 고르기'}
        </button>
      </div>
    </div>
  )
}
