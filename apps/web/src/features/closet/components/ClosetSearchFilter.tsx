import { useEffect, useRef } from 'react'
import { Tag } from 'lucide-react'
import { CatalogSearchField } from '../../../components/CatalogSearchField'

interface ClosetSearchFilterProps {
  query: string
  tags: string[]
  activeTag: string | null
  isSearchOpen: boolean
  onQueryChange: (query: string) => void
  onTagChange: (tag: string | null) => void
}

/** 검색창을 부드럽게 펼치고 입력·태그 선택은 부모의 목록 조건에 전달한다. 선택 태그는 가로 목록 안에서 보이도록 이동한다. */
export function ClosetSearchFilter({
  query,
  tags,
  activeTag,
  isSearchOpen,
  onQueryChange,
  onTagChange,
}: ClosetSearchFilterProps) {
  const tagButtonRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (!activeTag) return
    tagButtonRefs.current.get(activeTag)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeTag])

  return (
    <>
      <CatalogSearchField
        isOpen={isSearchOpen}
        value={query}
        onChange={onQueryChange}
        label="옷장 검색어"
        placeholder="이름, 브랜드, 종류, 색상 검색"
      />

      {tags.length > 0 && (
        <section
          className="mt-3 rounded-2xl border border-line bg-surface p-3 sm:p-4"
        >
          <p className="flex items-center gap-1.5 px-1 text-[11px] font-bold text-muted">
            <Tag size={13} /> 태그로 빠르게 보기
          </p>
          <div className="scrollbar-hide -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {tags.map((tag) => {
              const isActive = activeTag === tag
              return (
                <button
                  type="button"
                  key={tag}
                  ref={(element) => {
                    if (element) tagButtonRefs.current.set(tag, element)
                    else tagButtonRefs.current.delete(tag)
                  }}
                  aria-pressed={isActive}
                  onClick={() => onTagChange(isActive ? null : tag)}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
                    isActive
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-white text-ink hover:border-ink'
                  }`}
                >
                  #{tag}
                </button>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}
