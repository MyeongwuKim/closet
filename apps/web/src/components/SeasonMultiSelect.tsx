import type { Season } from '@closet/types'
import { Check } from 'lucide-react'
import { allSeasons, seasonOptions } from '../constants/seasons'

interface SeasonMultiSelectProps {
  ariaLabel?: string
  value: Season[]
  onChange: (value: Season[]) => void
}

export function SeasonMultiSelect({
  ariaLabel = '입을 계절',
  value,
  onChange,
}: SeasonMultiSelectProps) {
  const allSelected = allSeasons.every((season) => value.includes(season))

  const toggleSeason = (season: Season) => {
    onChange(
      value.includes(season)
        ? value.filter((selectedSeason) => selectedSeason !== season)
        : allSeasons.filter(
            (availableSeason) =>
              value.includes(availableSeason) || availableSeason === season,
          ),
    )
  }

  return (
    <div>
      <div
        className="grid grid-cols-4 overflow-hidden rounded-xl border border-line bg-canvas"
        role="group"
        aria-label={ariaLabel}
      >
        {seasonOptions.map((option, index) => {
          const isSelected = value.includes(option.value)

          return (
            <button
              type="button"
              onClick={() => toggleSeason(option.value)}
              className={`min-w-0 px-2 py-3 text-sm font-bold transition-colors ${
                index > 0 ? 'border-l border-line' : ''
              } ${
                isSelected
                  ? 'bg-ink text-white'
                  : 'text-muted hover:bg-surface hover:text-ink'
              }`}
              aria-pressed={isSelected}
              key={option.value}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange(allSelected ? [] : [...allSeasons])}
        className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
          allSelected
            ? 'border-sage bg-sage text-ink'
            : 'border-line text-muted hover:border-ink hover:text-ink'
        }`}
        aria-pressed={allSelected}
      >
        {allSelected && <Check size={13} />}
        사계절
      </button>
    </div>
  )
}
