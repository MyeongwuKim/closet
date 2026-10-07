import { Search } from 'lucide-react'
import { CollectionAddButton } from '../../../components/CollectionAddButton'
import { CollectionHeading } from '../../../components/CollectionHeading'

interface LookbookPageHeaderProps {
  outfitCount: number
  isSearchOpen: boolean
  onToggleSearch: () => void
  onCreate: () => void
}

/** 코디북의 저장 개수와 검색·새 코디 만들기 동작을 표시한다. 화면 이동과 검색 상태 변경은 부모에 맡긴다. */
export function LookbookPageHeader({ outfitCount, isSearchOpen, onToggleSearch, onCreate }: LookbookPageHeaderProps) {
  return (
    <CollectionHeading title="나의 코디북" label="My outfit album" description={`다시 입고 싶은 조합을 한 장씩 · ${outfitCount}개의 코디`} actions={<>
      {outfitCount > 0 && <button type="button" onClick={onToggleSearch} className="collection-action" aria-label={isSearchOpen ? '코디 검색 닫기' : '코디 검색'} aria-expanded={isSearchOpen}><Search size={20} /></button>}
      <CollectionAddButton onClick={onCreate} label="새 코디 만들기" />
    </>} />
  )
}
