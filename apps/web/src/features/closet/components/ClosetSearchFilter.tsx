import { useEffect, useRef } from 'react'
import { Search, Tag, X } from 'lucide-react'

interface ClosetSearchFilterProps {
  query: string
  tags: string[]
  activeTag: string | null
  isSearchOpen: boolean
  onQueryChange: (query: string) => void
  onTagChange: (tag: string | null) => void
}

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
      {isSearchOpen && (
        <div className="relative mt-5">
          <Search
            size={18}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="이름, 종류, 색상, 태그 검색"
            className="h-12 w-full rounded-2xl border border-line bg-surface pr-12 pl-11 text-sm outline-none transition placeholder:text-muted/70 focus:border-ink"
            aria-label="옷장 검색어"
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
              onClick={() => onQueryChange('')}
              aria-label="검색어 지우기"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {tags.length > 0 && (
        <section
          className={`${isSearchOpen ? 'mt-3' : 'mt-5'} rounded-2xl border border-line bg-surface p-3 sm:p-4`}
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
