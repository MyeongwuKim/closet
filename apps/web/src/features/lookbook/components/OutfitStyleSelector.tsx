import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'

interface OutfitStyleSelectorProps {
  value: string
  options: Array<{ label: string; value: string }>
  onChange: (style: string) => void
}

export function OutfitStyleSelector({
  value,
  options,
  onChange,
}: OutfitStyleSelectorProps) {
  const [isAddingStyle, setIsAddingStyle] = useState(false)
  const [customStyleName, setCustomStyleName] = useState('')
  const [customStyleError, setCustomStyleError] = useState<string | null>(null)
  const customSelectedStyle =
    value && !options.some((option) => option.value === value) ? value : null

  const closeCustomStyle = () => {
    setIsAddingStyle(false)
    setCustomStyleName('')
    setCustomStyleError(null)
  }

  useEffect(() => {
    if (!isAddingStyle) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsAddingStyle(false)
      setCustomStyleName('')
      setCustomStyleError(null)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isAddingStyle])

  const addCustomStyle = () => {
    const name = customStyleName.trim().replaceAll(/\s+/g, ' ')
    if (!name) {
      setCustomStyleError('추가할 스타일 이름을 입력해주세요.')
      return
    }
    const existingStyle = options.find(
      (option) => option.value === name || option.label === name,
    )
    onChange(existingStyle?.value ?? name)
    closeCustomStyle()
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-xl px-2 py-2.5 text-xs font-bold transition ${
              value === option.value
                ? 'bg-ink text-white'
                : 'border border-line bg-canvas text-muted hover:border-ink hover:text-ink'
            }`}
            aria-pressed={value === option.value}
            key={option.value}
          >
            {option.label}
          </button>
        ))}
        {customSelectedStyle && (
          <button
            type="button"
            className="min-h-11 rounded-xl bg-ink px-2 py-2.5 text-xs font-bold text-white"
            aria-pressed="true"
          >
            {customSelectedStyle}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setIsAddingStyle(true)
            setCustomStyleError(null)
          }}
          className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-canvas px-2 py-2.5 text-[10px] font-bold text-muted transition hover:border-accent hover:text-accent"
          aria-label="새 코디 스타일 추가"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-sage text-ink">
            <Plus size={15} />
          </span>
          스타일 추가
        </button>
      </div>

      {isAddingStyle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-style-title"
          className="option-picker-backdrop fixed inset-0 z-[160] flex items-center justify-center bg-black/45 p-5 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCustomStyle()
          }}
        >
          <form
            className="option-picker-enter w-full max-w-xs overflow-hidden rounded-[1.5rem] bg-surface shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault()
              addCustomStyle()
            }}
          >
            <header className="flex items-start justify-between border-b border-line px-5 py-4">
              <div>
                <h3 id="custom-style-title" className="text-base font-black">
                  새 스타일 추가
                </h3>
                <p className="mt-1 text-[11px] font-medium text-muted">
                  자주 쓰는 스타일 이름을 입력해주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCustomStyle}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
                aria-label="새 스타일 추가 닫기"
              >
                <X size={18} />
              </button>
            </header>

            <div className="px-5 py-4">
              <label className="grid gap-2 text-xs font-black">
                스타일 이름
                <input
                  type="text"
                  value={customStyleName}
                  onChange={(event) => {
                    setCustomStyleName(event.target.value)
                    setCustomStyleError(null)
                  }}
                  placeholder="예: 출근룩, 여행룩"
                  maxLength={20}
                  className="h-12 rounded-xl border border-line bg-canvas px-4 text-sm font-bold outline-none transition focus:border-accent"
                  autoFocus
                />
              </label>
              {customStyleError && (
                <p
                  role="alert"
                  className="mt-2 text-[11px] font-bold text-red-500"
                >
                  {customStyleError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
              <button
                type="button"
                onClick={closeCustomStyle}
                className="h-11 rounded-xl border border-line bg-canvas text-xs font-bold"
              >
                취소
              </button>
              <button
                type="submit"
                className="h-11 rounded-xl bg-ink text-xs font-bold text-white"
              >
                추가
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
