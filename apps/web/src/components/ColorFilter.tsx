import { useEffect, useId, useRef } from 'react'
import { Check, ChevronDown, Palette, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { WardrobeColorOption } from '../features/closet/utils/color'
import { useDrawerDisclosure } from '../hooks/useDrawerDisclosure'

interface ColorFilterProps {
  className?: string
  value: string | null
  options: WardrobeColorOption[]
  onChange: (value: string | null) => void
}

/** 대표 색상 목록을 서랍 형태의 시트로 보여준다. 선택은 onChange에 맡기고 닫힘 후 원래 필터 버튼으로 초점을 돌린다. */
export function ColorFilter({
  className = '',
  value,
  options,
  onChange,
}: ColorFilterProps) {
  const titleId = useId()
  const { isOpen, isVisible, open, close } = useDrawerDisclosure()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close }, [close])
  const selectedOption = options.find((option) => option.name === value)

  useEffect(() => {
    if (!isVisible) return

    const previousOverflow = document.body.style.overflow
    const trigger = triggerRef.current
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      trigger?.focus({ preventScroll: true })
    }
  }, [isVisible])

  /** 선택한 대표 색상 또는 전체를 뜻하는 null을 전달한 뒤 서랍을 닫는다. */
  const selectColor = (nextColor: string | null) => {
    onChange(nextColor)
    close()
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={open}
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

      {isVisible &&
        createPortal(
          <div
            className="option-picker-backdrop fixed inset-0 z-[130] flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center sm:p-6"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close()
            }}
          >
            <section
              className="room-drawer-sheet flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col shadow-2xl"
              data-state={isOpen ? 'open' : 'closing'}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
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
                  onClick={close}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-canvas"
                  aria-label="색상 필터 닫기"
                  autoFocus
                >
                  <X size={18} />
                </button>
              </header>

              <div className="min-h-0 overflow-y-auto px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5">
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
