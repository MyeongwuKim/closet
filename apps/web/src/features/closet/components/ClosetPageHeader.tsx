import { LoaderCircle, Plus, Search } from 'lucide-react'
import type { Ref } from 'react'
import { PageTitle } from '../../../components/PageTitle'

interface ClosetPageHeaderProps {
  itemCount: number
  analyzingCount: number
  isSearchOpen: boolean
  onToggleSearch: () => void
  onAddItem: () => void
  addButtonRef?: Ref<HTMLButtonElement>
}

export function ClosetPageHeader({
  itemCount,
  analyzingCount,
  isSearchOpen,
  onToggleSearch,
  onAddItem,
  addButtonRef,
}: ClosetPageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 sm:items-end">
      <div className="min-w-0 [&_p]:hidden sm:[&_p]:block">
        <PageTitle
          title="내 옷장"
          description={`옷을 모아보고 원하는 조합을 빠르게 찾아보세요 · ${itemCount}개`}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {itemCount > 0 && (
          <button
            type="button"
            onClick={onToggleSearch}
            className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 sm:size-11 ${
              isSearchOpen
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-surface text-muted hover:text-ink'
            }`}
            aria-label={isSearchOpen ? '옷장 검색 닫기' : '옷장 검색'}
            aria-expanded={isSearchOpen}
            title={isSearchOpen ? '검색 닫기' : '옷장 검색'}
          >
            <Search size={20} strokeWidth={2.3} />
          </button>
        )}
        <button
          ref={addButtonRef}
          type="button"
          onClick={() => {
            if (analyzingCount === 0) onAddItem()
          }}
          aria-disabled={analyzingCount > 0}
          className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 sm:size-11 ${
            analyzingCount > 0
              ? 'cursor-wait opacity-70'
              : 'hover:bg-accent/90'
          }`}
          aria-label={
            analyzingCount > 0 ? 'AI가 옷을 분석하는 중' : '옷장에 옷 추가'
          }
          title={analyzingCount > 0 ? '옷 분석 중' : '옷 추가'}
          aria-live="polite"
        >
          {analyzingCount > 0 ? (
            <LoaderCircle className="animate-spin" size={20} />
          ) : (
            <Plus size={22} strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  )
}
