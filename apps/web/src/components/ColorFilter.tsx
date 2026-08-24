import { useEffect, useId, useState } from 'react'
import { Check, ChevronDown, Palette, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { WardrobeColorOption } from '../features/closet/utils/color'

interface ColorFilterProps {
  className?: string
  value: string | null
  options: WardrobeColorOption[]
  onChange: (value: string | null) => void
}

export function ColorFilter({
  className = '',
  value,
  options,
  onChange,
}: ColorFilterProps) {
  const titleId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((option) => option.name === value)

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const selectColor = (nextColor: string | null) => {
    onChange(nextColor)
    setIsOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-bold transition ${
          value
            ? 'border-ink bg-ink text-white'
            : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
        } ${className}`}
      >
        {selectedOption ? (
          <span
            className="size-3 rounded-full border border-white/60"
            style={{ backgroundColor: selectedOption.hex }}
            aria-hidden="true"
          />
        ) : (
          <Palette size={15} aria-hidden="true" />
        )}
        <span>{selectedOption?.name ?? value ?? '색상'}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {isOpen &&
        createPortal(
          <div
            className="option-picker-backdrop fixed inset-0 z-[130] flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsOpen(false)
            }}
          >
            <section
              className="option-picker-enter w-full max-w-md rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <header className="flex items-start gap-3 border-b border-line px-5 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sage">
                  <Palette size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="text-base font-black">
                    색상별로 보기
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    찾고 싶은 대표 색상을 선택하세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-canvas"
                  aria-label="색상 필터 닫기"
                  autoFocus
                >
                  <X size={18} />
                </button>
              </header>

              <div className="px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5">
                <button
                  type="button"
                  onClick={() => selectColor(null)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold transition ${
                    value === null
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-canvas hover:border-ink'
                  }`}
                >
                  전체 색상
                  {value === null && <Check size={16} aria-hidden="true" />}
                </button>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {options.map((option) => {
                    const isSelected = option.name === value
                    return (
                      <button
                        type="button"
                        onClick={() => selectColor(option.name)}
                        className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-bold transition ${
                          isSelected
                            ? 'border-ink bg-ink text-white'
                            : 'border-line bg-canvas hover:border-ink'
                        }`}
                        aria-pressed={isSelected}
                        key={option.name}
                      >
                        <span
                          className={`size-5 shrink-0 rounded-full border ${
                            isSelected ? 'border-white/60' : 'border-black/10'
                          }`}
                          style={{ backgroundColor: option.hex }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{option.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  )
}
