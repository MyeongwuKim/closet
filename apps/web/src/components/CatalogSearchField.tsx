import { useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

interface CatalogSearchFieldProps {
  isOpen: boolean
  value: string
  label: string
  placeholder: string
  onChange: (value: string) => void
}

/** 옷장·코디 검색창을 높이와 투명도로 펼치거나 접는다. 입력은 즉시 부모에 전달하고, 열리는 동작이 시작된 뒤 초점을 주며 닫힌 상태에서는 키보드 접근을 막는다. */
export function CatalogSearchField({ isOpen, value, label, placeholder, onChange }: CatalogSearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 120)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  return (
    <div className="catalog-search-panel" data-open={isOpen} inert={!isOpen} aria-hidden={!isOpen}>
      <div className="catalog-search-clip">
        <div className="catalog-search-field">
          <Search size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <input ref={inputRef} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} />
          <button type="button" onClick={() => onChange('')} aria-label="검색어 지우기" className="catalog-search-clear" data-visible={Boolean(value)} inert={!value} aria-hidden={!value}>
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
