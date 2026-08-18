import type { KeyboardEvent, ReactNode } from 'react'

export interface SegmentedControlOption<TValue extends string> {
  label: ReactNode
  value: TValue
}

interface SegmentedControlProps<TValue extends string> {
  ariaLabel: string
  className?: string
  onChange: (value: TValue) => void
  options: ReadonlyArray<SegmentedControlOption<TValue>>
  value: TValue | null
}

function getNextIndex(
  key: string,
  currentIndex: number,
  optionCount: number,
) {
  if (key === 'Home') return 0
  if (key === 'End') return optionCount - 1
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (currentIndex + 1) % optionCount
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (currentIndex - 1 + optionCount) % optionCount
  }
  return null
}

export function SegmentedControl<TValue extends string>({
  ariaLabel,
  className = '',
  onChange,
  options,
  value,
}: SegmentedControlProps<TValue>) {
  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const nextIndex = getNextIndex(event.key, currentIndex, options.length)
    if (nextIndex === null) return

    event.preventDefault()
    onChange(options[nextIndex].value)
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="radio"]',
      )
    buttons?.[nextIndex]?.focus()
  }

  return (
    <div
      className={`grid overflow-hidden rounded-xl border border-line bg-canvas ${className}`}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((option, index) => {
        const isSelected = value === option.value

        return (
          <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected || (value === null && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`min-w-0 px-3 py-3 text-sm font-bold transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              index > 0 ? 'border-l border-line' : ''
            } ${
              isSelected
                ? 'bg-ink text-white'
                : 'text-muted hover:bg-surface hover:text-ink'
            }`}
            key={option.value}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
