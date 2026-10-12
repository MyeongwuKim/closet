import { RotateCcw, X } from 'lucide-react'
import { PageTitle } from '../../../components/PageTitle'
import { useOutfitComposer } from '../contexts/OutfitComposerContext'

/** 코디 편집 화면의 선택 개수를 보여주고, 종료 확인과 전체 아이템 해제를 제공한다. */
export function OutfitComposerHeader() {
  const {
    selectedItems,
    requestClose,
    reset,
  } = useOutfitComposer()
  const selectedCount = selectedItems.length
  return (
    <header className="shrink-0 border-b border-line bg-canvas pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-3 sm:min-h-18 sm:px-6">
        <button
          type="button"
          onClick={requestClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface"
          aria-label="Look 만들기 닫기"
          title="닫기"
        >
          <X size={21} strokeWidth={1.8} />
        </button>
        <div className="min-w-0 flex-1">
          <PageTitle
            title="새 Look 만들기"
            description={`선택한 아이템 ${selectedCount}개`}
            compact
          />
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={selectedCount === 0}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:border-accent/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="선택한 아이템 모두 해제"
          title="아이템 모두 해제"
        >
          <RotateCcw size={17} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  )
}
