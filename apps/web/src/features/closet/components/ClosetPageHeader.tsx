import { CollectionSearchButton } from '../../../components/CollectionSearchButton'
import type { ReactNode, Ref } from 'react'
import { CollectionAddButton } from '../../../components/CollectionAddButton'
import { CollectionHeading } from '../../../components/CollectionHeading'

interface ClosetPageHeaderProps {
  analyzingCount: number
  isSearchOpen: boolean
  onToggleSearch: () => void
  onAddItem: () => void
  addButtonRef?: Ref<HTMLButtonElement>
  filterControl?: ReactNode
}

/** 조회 전부터 옷장 제목과 검색·필터·추가 도구의 자리를 유지한다. 분석 중에는 추가 동작을 실행하지 않는다. */
export function ClosetPageHeader({
  analyzingCount,
  isSearchOpen,
  onToggleSearch,
  onAddItem,
  addButtonRef,
  filterControl,
}: ClosetPageHeaderProps) {
  return (
    <CollectionHeading
      title="내 옷장"
      actions={<>
        <CollectionSearchButton label="옷장 검색" isOpen={isSearchOpen} onToggle={onToggleSearch} />
        {filterControl}
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
