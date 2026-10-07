import { Search } from 'lucide-react'
import type { Ref } from 'react'
import { CollectionAddButton } from '../../../components/CollectionAddButton'
import { CollectionHeading } from '../../../components/CollectionHeading'

interface ClosetPageHeaderProps {
  itemCount: number
  analyzingCount: number
  isSearchOpen: boolean
  onToggleSearch: () => void
  onAddItem: () => void
  addButtonRef?: Ref<HTMLButtonElement>
}

/** 옷장에 등록한 옷 개수와 검색·추가 버튼을 표시한다. 분석 중에는 추가 동작을 실행하지 않는다. */
export function ClosetPageHeader({
  itemCount,
  analyzingCount,
  isSearchOpen,
  onToggleSearch,
  onAddItem,
  addButtonRef,
}: ClosetPageHeaderProps) {
  return (
    <CollectionHeading
      title="내 옷장"
      label="My dressing room"
      description={`하나씩 모아둔 나의 취향 · ${itemCount}개의 옷`}
      actions={<>
        {itemCount > 0 && (
          <button
            type="button"
            onClick={onToggleSearch}
            className="collection-action"
            aria-label={isSearchOpen ? '옷장 검색 닫기' : '옷장 검색'}
            aria-expanded={isSearchOpen}
            title={isSearchOpen ? '검색 닫기' : '옷장 검색'}
          >
            <Search size={20} />
          </button>
        )}
        <CollectionAddButton
          buttonRef={addButtonRef}
          onClick={onAddItem}
          isLoading={analyzingCount > 0}
          label={
            analyzingCount > 0 ? 'AI가 옷을 분석하는 중' : '옷장에 옷 추가'
          }
          title={analyzingCount > 0 ? '옷 분석 중' : '옷 추가'}
        />
      </>}
    />
  )
}
