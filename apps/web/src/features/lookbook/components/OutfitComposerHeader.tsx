import { ChevronLeft, RotateCcw } from 'lucide-react'
import { PageTitle } from '../../../components/PageTitle'
import { useOutfitComposer } from '../contexts/OutfitComposerContext'

export function OutfitComposerHeader() {
  const {
    selectedItems,
    hasPreviousStep,
    goBackStep,
    reset,
  } = useOutfitComposer()
  const selectedCount = selectedItems.length
  const baseItemName = selectedItems[0]?.name

  return (
    <header className="shrink-0 border-b border-line bg-canvas pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:min-h-18 sm:px-6">
        <button
          type="button"
          onClick={goBackStep}
          className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface"
          aria-label={hasPreviousStep ? '이전 단계로 돌아가기' : '코디 만들기 닫기'}
          title={hasPreviousStep ? '이전 단계' : '닫기'}
        >
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <PageTitle
            title="코디 맞춰보기"
            description={
              baseItemName
                ? `${baseItemName}에서 시작한 조합 · ${selectedCount}개`
                : '입고 싶은 옷 하나부터 시작해보세요.'
            }
            compact
          />
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={selectedCount === 0}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-ink disabled:opacity-35"
          aria-label="코디 선택 처음부터 다시"
          title="처음부터 다시"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </header>
  )
}
