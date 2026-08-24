import { useEffect, useRef } from 'react'
import { Search, Tag, X } from 'lucide-react'

interface ClosetSearchFilterProps {
  query: string
  tags: string[]
  activeTag: string | null
  onQueryChange: (query: string) => void
  onTagChange: (tag: string | null) => void
}

export function ClosetSearchFilter({
  query,
  tags,
  activeTag,
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
    <section className="mt-6 rounded-2xl border border-line bg-surface p-3 sm:p-4">
      <label className="flex h-12 items-center gap-2 rounded-xl border border-line bg-white px-3 focus-within:border-ink">
        <Search size={18} className="shrink-0 text-muted" />
        <span className="sr-only">옷장 검색</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="이름, 종류, 색상, 태그 검색"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
        {query && (
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
            onClick={() => onQueryChange('')}
            aria-label="검색어 지우기"
          >
            <X size={16} />
          </button>
        )}
      </label>

      {tags.length > 0 && (
        <div className="mt-3">
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
        </div>
      )}
    </section>
  )
}
