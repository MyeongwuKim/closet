import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, X } from 'lucide-react'

export interface OptionPickerItem {
  value: string
  label: string
}

interface OptionPickerFieldProps {
  label: string
  value: string
  options: OptionPickerItem[]
  placeholder: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  /** 한 줄 필터에서는 라벨을 접근성 이름으로 유지하고 조작부만 작게 표시한다. 선택창은 기본 필드와 공유한다. */
  compact?: boolean
  /** 서랍 안의 선택창은 잘림을 피하도록 서랍 위에 연다. 배경 스크롤은 서랍이 관리한다. */
  inDrawer?: boolean
  onOpenChange?: (isOpen: boolean) => void
}

/** 앱 공통 옵션 선택창을 연다. compact는 목록 필터용 표현이며 선택·닫기·초점 복귀 동작은 같은 경로를 따른다. */
export function OptionPickerField({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
  required = false,
  compact = false,
  inDrawer = false,
  onOpenChange,
}: OptionPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const labelId = useId()
  const dialogTitleId = useId()
  const valueId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const selectedOption = options.find((option) => option.value === value)

  const closePicker = useCallback(() => {
    setIsOpen(false)
    onOpenChange?.(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [onOpenChange])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    if (!inDrawer) document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closePicker()
      } else if (inDrawer && event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        if (!buttons?.length) return
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      if (!inDrawer) document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [closePicker, inDrawer, isOpen])

  const pickerDialog = isOpen ? (
    <div
      className={`option-picker-backdrop fixed inset-0 flex items-center justify-center bg-ink/40 px-5 py-8 backdrop-blur-[2px] ${inDrawer ? 'z-[130]' : 'z-[110]'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePicker()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="option-picker-enter flex max-h-[min(72dvh,36rem)] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold tracking-wide text-accent">
              하나를 골라주세요
            </span>
            <h2 id={dialogTitleId} className={`mt-1 text-xl font-semibold ${compact ? 'break-keep' : ''}`}>
              {label} 선택
            </h2>
          </div>
          <button
            type="button"
            onClick={closePicker}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted transition hover:text-ink"
            aria-label={`${label} 선택창 닫기`}
            autoFocus
          >
            <X size={18} />
          </button>
        </header>

        <div className="scrollbar-hidden min-h-0 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2"
            style={compact ? { gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 8.5rem), 1fr))' } : undefined}>
            {options.map((option) => {
              const isSelected = option.value === value

              return (
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    closePicker()
                  }}
                  className={`flex min-h-14 items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                    isSelected
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-canvas text-ink hover:border-accent'
                  }`}
                  aria-pressed={isSelected}
                  key={option.value}
                >
                  <span className={compact ? 'min-w-0 break-keep' : undefined}>{option.label}</span>
                  {isSelected && <Check size={17} className="shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  ) : null

  return (
    <>
      <div className={compact ? 'min-w-0' : 'grid gap-2'}>
        <span id={labelId} className={compact ? 'sr-only' : 'text-sm font-bold'}>
          {label}
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => { setIsOpen(true); onOpenChange?.(true) }}
          disabled={disabled}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3 text-left outline-none transition hover:border-ink focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:bg-line/20 disabled:text-muted ${compact ? 'min-h-11 bg-surface py-2 text-xs' : 'h-12 bg-white text-sm'}`}
          aria-labelledby={compact ? `${labelId} ${valueId}` : labelId}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-required={required}
        >
          <span id={valueId} className={selectedOption ? 'font-bold text-ink' : 'text-muted'}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown size={18} className="shrink-0 text-muted" />
        </button>
      </div>

      {isOpen && (inDrawer ? createPortal(pickerDialog, document.body) : pickerDialog)}
    </>
  )
}
