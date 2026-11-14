import { useLayoutEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { WardrobeColorOption } from '../utils/color'
import { wardrobeFilterSelectionKey, type WardrobeFilterSelection } from '../utils/wardrobeFilters'

interface Props {
  selection: WardrobeFilterSelection[]
  colors: WardrobeColorOption[]
  onToggle: (item: WardrobeFilterSelection) => void
  label?: string
}

/** 고른 조건을 선택 순서대로 한 줄에 표시한다. 새 선택만 오른쪽으로 따라가고 칩을 다시 누르면 해당 조건을 해제한다. */
export function ClosetFilterSelection({ selection, colors, onToggle, label = '선택한 필터' }: Props) {
  const scrollRef = useRef<HTMLUListElement>(null)
  const previousKeys = useRef(new Set(selection.map(wardrobeFilterSelectionKey)))
  useLayoutEffect(() => {
    const keys = new Set(selection.map(wardrobeFilterSelectionKey))
    if (selection.some((item) => !previousKeys.current.has(wardrobeFilterSelectionKey(item)))) {
      const element = scrollRef.current
      element?.scrollTo({ left: element.scrollWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }
    previousKeys.current = keys
  }, [selection])
  if (!selection.length) return null
  return (
    <ul ref={scrollRef} aria-label={label} tabIndex={0} className="scrollbar-hidden flex min-w-0 gap-2 overflow-x-auto py-1 focus-visible:outline-2 focus-visible:outline-accent">
      {selection.map((item) => {
        const name = item.kind === 'unbranded' ? '브랜드 미지정' : item.value
        const kindLabel = item.kind === 'color' ? '색상' : item.kind === 'tag' ? '태그' : '브랜드'
        const color = item.kind === 'color' ? colors.find((option) => option.name === item.value)?.hex : null
        return (
          <li key={wardrobeFilterSelectionKey(item)} className="shrink-0">
            <button type="button" onClick={() => onToggle(item)} aria-label={`${name} ${kindLabel} 해제`} title={name} className="flex min-h-9 max-w-52 items-center gap-1.5 rounded-full border border-accent/30 bg-sage px-3 text-xs font-medium text-ink">
              {color && <span className="size-3 shrink-0 rounded-full border border-ink/15" style={{ backgroundColor: color }} aria-hidden="true" />}
              <span className="truncate">{item.kind === 'tag' ? '#' : ''}{name}</span><X size={13} className="shrink-0" aria-hidden="true" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
