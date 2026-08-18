import { useEffect, useId, useRef, useState } from 'react'
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
}

export function OptionPickerField({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
  required = false,
}: OptionPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const labelId = useId()
  const dialogTitleId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selectedOption = options.find((option) => option.value === value)

  const closePicker = () => {
    setIsOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      closePicker()
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen])

  return (
    <>
      <div className="grid gap-2">
        <span id={labelId} className="text-sm font-bold">
          {label}
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 text-left text-sm outline-none transition hover:border-ink focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:bg-line/20 disabled:text-muted"
          aria-labelledby={labelId}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-required={required}
        >
          <span className={selectedOption ? 'font-bold text-ink' : 'text-muted'}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown size={18} className="shrink-0 text-muted" />
        </button>
      </div>

      {isOpen && (
        <div
          className="option-picker-backdrop fixed inset-0 z-[110] flex items-center justify-center bg-ink/40 px-5 py-8 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePicker()
          }}
        >
          <section
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
                <h2 id={dialogTitleId} className="mt-1 text-xl font-black">
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
              <div className="grid grid-cols-2 gap-2">
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
                      <span>{option.label}</span>
                      {isSelected && <Check size={17} className="shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
