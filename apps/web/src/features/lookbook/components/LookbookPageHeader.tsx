import { CollectionSearchButton } from '../../../components/CollectionSearchButton'
import type { ReactNode } from 'react'
import { CollectionAddButton } from '../../../components/CollectionAddButton'
import { CollectionHeading } from '../../../components/CollectionHeading'

interface LookbookPageHeaderProps {
  isSearchOpen: boolean
  onToggleSearch: () => void
  onCreate: () => void
  filterControl: ReactNode
}

/** 조회 전부터 코디북 제목·검색·필터·추가 버튼의 자리를 유지한다. 화면 이동과 검색 상태 변경은 부모에 맡긴다. */
export function LookbookPageHeader({ isSearchOpen, onToggleSearch, onCreate, filterControl }: LookbookPageHeaderProps) {
  return (
    <CollectionHeading title="내 코디북" actions={<>
      <CollectionSearchButton label="코디 검색" isOpen={isSearchOpen} onToggle={onToggleSearch} />
      {filterControl}
      <CollectionAddButton onClick={onCreate} label="새 코디 만들기" />
    </>} />
  )
}
