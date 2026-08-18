import type { Season } from '@closet/types'
import { Search, X } from 'lucide-react'
import { SeasonFilter } from '../../../components/SeasonFilter'

interface OutfitFilterControlsProps {
  activeSeason: Season | null
  activeStyle: string
  isSearchOpen: boolean
  searchQuery: string
  styleOptions: Array<{ label: string; value: string }>
  onSeasonChange: (season: Season | null) => void
  onStyleChange: (style: string) => void
  onSearchChange: (query: string) => void
}

export function OutfitFilterControls({
  activeSeason,
  activeStyle,
  isSearchOpen,
  searchQuery,
  styleOptions,
  onSeasonChange,
  onStyleChange,
  onSearchChange,
}: OutfitFilterControlsProps) {
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

      <div
        className="scrollbar-hidden mt-3 flex gap-2 overflow-x-auto pb-2"
        aria-label="코디 스타일 필터"
      >
        <button
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
    </>
  )
}
