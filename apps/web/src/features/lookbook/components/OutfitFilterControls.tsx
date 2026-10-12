import type { Season } from '@closet/types'
import { useEffect, useRef, type ReactNode } from 'react'
import { CatalogSearchField } from '../../../components/CatalogSearchField'
import { ColorFilter } from '../../../components/ColorFilter'
import {
  DateSortButton,
  type DateSortOrder,
} from '../../../components/DateSortButton'
import { SeasonFilter } from '../../../components/SeasonFilter'
import type { WardrobeColorOption } from '../../closet/utils/color'

interface OutfitFilterControlsProps {
  activeSeason: Season | null
  activeStyle: string
  activeColor?: string | null
  colorOptions?: WardrobeColorOption[]
  isSearchOpen: boolean
  searchQuery: string
  sortOrder?: DateSortOrder
  styleOptions: Array<{ label: string; value: string }>
  onSeasonChange: (season: Season | null) => void
  onStyleChange: (style: string) => void
  onColorChange?: (color: string | null) => void
  onSearchChange: (query: string) => void
  onSortOrderChange?: (order: DateSortOrder) => void
  /** 정렬·색상 버튼 오른쪽에 표시할 목록 보기 전환 UI. 주간 플래너에서는 생략한다. */
  viewControl?: ReactNode
}

/** 코디 검색·계절·정렬·색상·스타일 선택을 부모에 전달한다. viewControl이 있으면 정렬·색상과 같은 줄 오른쪽에 표시한다. */
export function OutfitFilterControls({
  activeSeason,
  activeStyle,
  activeColor = null,
  colorOptions = [],
  isSearchOpen,
  searchQuery,
  sortOrder,
  styleOptions,
  onSeasonChange,
  onStyleChange,
  onColorChange,
  onSearchChange,
  onSortOrderChange,
  viewControl,
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
      <CatalogSearchField
        isOpen={isSearchOpen}
        value={searchQuery}
        onChange={onSearchChange}
        label="코디 검색어"
        placeholder="코디명, 옷 이름, 색상으로 검색"
      />

      <SeasonFilter
        className="mt-6"
        value={activeSeason}
        onChange={onSeasonChange}
      />

      <div className="mt-2 flex min-h-9 items-center gap-2">
        <div className="scrollbar-hidden flex min-w-0 items-center gap-2 overflow-x-auto">
          {sortOrder && onSortOrderChange && (
            <DateSortButton value={sortOrder} onChange={onSortOrderChange} />
          )}
          {onColorChange && colorOptions.length > 1 && (
            <ColorFilter
              value={activeColor}
              options={colorOptions}
              onChange={onColorChange}
            />
          )}
        </div>
        {viewControl && <div className="ml-auto shrink-0">{viewControl}</div>}
      </div>

      <div
        ref={styleScrollContainerRef}
        className="scrollbar-hidden mt-1 flex gap-2 overflow-x-auto pb-1"
        aria-label="코디 스타일 필터"
      >
        <button
          ref={activeStyle === 'all' ? activeStyleButtonRef : undefined}
          type="button"
          onClick={() => onStyleChange('all')}
          className={`flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium ${
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
              activeStyle === option.value ? activeStyleButtonRef : undefined
            }
            type="button"
            onClick={() => onStyleChange(option.value)}
            className={`flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium ${
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
