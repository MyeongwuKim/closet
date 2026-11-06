import type { Season } from '@closet/types'
import type { ReactNode } from 'react'
import { seasonOptions } from '../../../constants/seasons'
import type { getOutfitItemFilterOptions } from '../utils/outfitItemFilters'
import './OutfitItemBrowser.css'

interface OutfitWardrobeFiltersProps {
  id: string
  isOpen: boolean
  options: ReturnType<typeof getOutfitItemFilterOptions>
  season: Season | null
  color: string | null
  recentWearDays: number
  hideRecentlyWorn: boolean
  onSeasonChange: (season: Season | null) => void
  onColorChange: (color: { name: string; hex: string } | null) => void
  onHideRecentlyWornChange: (value: boolean) => void
  onClear: () => void
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`outfit-item-browser__chip shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/** 코디에 담을 옷의 계절·색상과 최근 착용 숨기기를 표시한다. 선택과 초기화는 부모에 맡긴다. */
export function OutfitWardrobeFilters({
  id,
  isOpen,
  options,
  season,
  color,
  recentWearDays,
  hideRecentlyWorn,
  onSeasonChange,
  onColorChange,
  onHideRecentlyWornChange,
  onClear,
}: OutfitWardrobeFiltersProps) {
  return (
    <div
      id={id}
      className="outfit-item-browser__filter-panel"
      data-open={isOpen}
      inert={!isOpen}
      aria-hidden={!isOpen}
    >
      <div className="outfit-item-browser__filter-clip">
        <div className="outfit-item-browser__filter-content space-y-3">
          {options.seasons.size > 0 && (
            <div>
              <p className="px-0.5 text-[10px] font-bold text-muted">계절</p>
              <div className="scrollbar-hidden mt-1.5 flex gap-1.5 overflow-x-auto">
                {seasonOptions
                  .filter((option) => options.seasons.has(option.value))
                  .map((option) => (
                    <FilterChip
                      active={season === option.value}
                      onClick={() => onSeasonChange(season === option.value ? null : option.value)}
                      key={option.value}
                    >
                      {option.label}
                    </FilterChip>
                  ))}
              </div>
            </div>
          )}

          {options.colors.length > 0 && (
            <div>
              <p className="px-0.5 text-[10px] font-bold text-muted">색상</p>
              <div className="scrollbar-hidden mt-1.5 flex gap-1.5 overflow-x-auto">
                {options.colors.map((option) => (
                  <FilterChip
                    active={color === option.name}
                    onClick={() => onColorChange(color === option.name ? null : option)}
                    key={option.name}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-full border border-black/10"
                        style={{ backgroundColor: option.hex }}
                      />
                      {option.name}
                    </span>
                  </FilterChip>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="px-0.5 text-[10px] font-bold text-muted">최근 착용 · 오늘 기준</p>
            <div className="mt-1.5">
              <FilterChip
                active={hideRecentlyWorn}
                onClick={() => onHideRecentlyWornChange(!hideRecentlyWorn)}
              >
                최근 {recentWearDays}일 입은 옷 숨기기
              </FilterChip>
            </div>
          </div>

          {(season || color || hideRecentlyWorn) && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-bold text-muted underline underline-offset-2"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
