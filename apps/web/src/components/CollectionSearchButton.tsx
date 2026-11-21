import { Search } from 'lucide-react'

interface CollectionSearchButtonProps {
  label: string
  isOpen: boolean
  onToggle: () => void
}

/** 목록 제목 옆에서 검색 입력창을 열고 닫으며 현재 펼침 상태를 전달한다. */
export function CollectionSearchButton({ label, isOpen, onToggle }: CollectionSearchButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="collection-action"
      aria-label={isOpen ? `${label} 닫기` : label}
      aria-expanded={isOpen}
      title={isOpen ? '검색 닫기' : label}
    >
      <Search size={20} aria-hidden="true" />
    </button>
  )
}
