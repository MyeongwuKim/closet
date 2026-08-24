import type { Season } from '@closet/types'
import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { ColorFilter } from '../../../components/ColorFilter'
import { SeasonFilter } from '../../../components/SeasonFilter'
import type { WardrobeColorOption } from '../../closet/utils/color'

interface OutfitFilterControlsProps {
  activeSeason: Season | null
  activeStyle: string
  activeColor?: string | null
  colorOptions?: WardrobeColorOption[]
  isSearchOpen: boolean
  searchQuery: string
  styleOptions: Array<{ label: string; value: string }>
  onSeasonChange: (season: Season | null) => void
  onStyleChange: (style: string) => void
  onColorChange?: (color: string | null) => void
  onSearchChange: (query: string) => void
}

export function OutfitFilterControls({
  activeSeason,
  activeStyle,
  activeColor = null,
  colorOptions = [],
  isSearchOpen,
  searchQuery,
  styleOptions,
  onSeasonChange,
  onStyleChange,
  onColorChange,
  onSearchChange,
}: OutfitFilterControlsProps) {
  const styleScrollContainerRef = useRef<HTMLDivElement>(null)
  const activeStyleButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const container = styleScrollContainerRef.current
      const activeButton = activeStyleButtonRef.current
      if (!container || !activeButton) return

      const containerRect = container.getBoundingClientRect()
      const buttonRect = activeButton.getBoundingClientRect()
      const nextScrollLeft =
        container.scrollLeft +
        buttonRect.left -
        containerRect.left -
        (containerRect.width - buttonRect.width) / 2

      container.scrollTo({
        left: nextScrollLeft,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [activeStyle])

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
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="코디명, 옷 이름, 색상으로 검색"
            className="h-12 w-full rounded-2xl border border-line bg-surface pr-12 pl-11 text-sm outline-none transition placeholder:text-muted/70 focus:border-ink"
            aria-label="코디 검색어"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
              aria-label="검색어 지우기"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      <SeasonFilter
        className="mt-6"
        value={activeSeason}
        onChange={onSeasonChange}
      />

      <div className="mt-3 flex min-w-0 items-start gap-2">
        {onColorChange && colorOptions.length > 1 && (
          <ColorFilter
            value={activeColor}
            options={colorOptions}
            onChange={onColorChange}
          />
        )}
        <div
          ref={styleScrollContainerRef}
          className="scrollbar-hidden flex min-w-0 flex-1 gap-2 overflow-x-auto pb-2"
          aria-label="코디 스타일 필터"
        >
          <button
            ref={activeStyle === 'all' ? activeStyleButtonRef : undefined}
            type="button"
            onClick={() => onStyleChange('all')}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
              activeStyle === 'all'
                ? 'bg-ink text-white'
                : 'border border-line bg-surface text-muted'
            }`}
          >
            전체
          </button>
          {styleOptions.map((option) => (
            <button
              ref={
                activeStyle === option.value
                  ? activeStyleButtonRef
                  : undefined
              }
              type="button"
              onClick={() => onStyleChange(option.value)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                activeStyle === option.value
                  ? 'bg-ink text-white'
                  : 'border border-line bg-surface text-muted'
              }`}
              key={option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
