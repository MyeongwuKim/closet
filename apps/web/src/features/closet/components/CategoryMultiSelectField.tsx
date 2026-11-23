import { useEffect, useId, useRef, useState } from 'react'
import type { ClothingCategory } from '@closet/types'
import { Check, ChevronDown, X } from 'lucide-react'
import { closetCategoryLabels } from '../constants'

const categoryOptions = Object.entries(closetCategoryLabels).map(
  ([value, label]) => ({ value: value as ClothingCategory, label }),
)

const MAX_CATEGORY_COUNT = 3

interface CategoryMultiSelectFieldProps {
  value: ClothingCategory[]
  onChange: (value: ClothingCategory[]) => void
  required?: boolean
}

export function CategoryMultiSelectField({
  value,
  onChange,
  required = false,
}: CategoryMultiSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draftValue, setDraftValue] = useState(value)
  const labelId = useId()
  const dialogTitleId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closePicker = () => {
    setIsOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const openPicker = () => {
    setDraftValue(value)
    setIsOpen(true)
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

  const toggleCategory = (category: ClothingCategory) => {
    setDraftValue((currentValue) => {
      if (currentValue.includes(category)) {
        if (currentValue.length === 1) return currentValue
        return currentValue.filter((currentCategory) => currentCategory !== category)
      }
      if (currentValue.length >= MAX_CATEGORY_COUNT) return currentValue
      return [...currentValue, category]
    })
  }

  return (
    <>
      <div className="grid gap-2">
        <span id={labelId} className="text-sm font-bold">
          카테고리
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={openPicker}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2 text-left text-sm outline-none transition hover:border-ink focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
          aria-labelledby={labelId}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-required={required}
        >
          {value.length > 0 ? (
            <span className="flex min-w-0 flex-wrap gap-1.5">
              {value.map((category, index) => (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    index === 0 ? 'bg-ink text-white' : 'bg-sage text-ink'
                  }`}
                  key={category}
                >
                  {closetCategoryLabels[category]}
                  {index === 0 ? ' · 대표' : ''}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-muted">카테고리를 선택해주세요</span>
          )}
          <ChevronDown size={18} className="shrink-0 text-muted" />
        </button>
        <span className="text-xs font-normal leading-5 text-muted">
          대표 카테고리는 기본 코디 위치와 사이즈 항목을 정해요.
          코디북에서는 추가로 등록한 아우터와 중간 아우터 위치에도 담을 수 있어요.
        </span>
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
            className="option-picker-enter flex max-h-[min(78dvh,40rem)] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
          >
            <header className="flex items-start gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold tracking-wide text-accent">
                  최대 세 개까지 선택 가능
                </span>
                <h2 id={dialogTitleId} className="mt-1 text-xl font-semibold">
                  카테고리 선택
                </h2>
                <p className="mt-1.5 text-xs leading-5 text-muted">
                  선택한 항목의 ‘대표로 지정’을 누르면 기본 코디 위치를 바꿀 수 있어요.
                </p>
              </div>
              <button
                type="button"
                onClick={closePicker}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted transition hover:text-ink"
                aria-label="카테고리 선택창 닫기"
                autoFocus
              >
                <X size={18} />
              </button>
            </header>

            <div className="scrollbar-hidden min-h-0 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                {categoryOptions.map((option) => {
                  const selectedIndex = draftValue.indexOf(option.value)
                  const isSelected = selectedIndex >= 0
                  const isAtLimit =
                    !isSelected && draftValue.length >= MAX_CATEGORY_COUNT

                  return (
                    <div className="flex min-w-0 flex-col" key={option.value}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(option.value)}
                        disabled={isAtLimit}
                        className={`flex min-h-20 flex-1 flex-col items-start justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${
                          selectedIndex === 0
                            ? 'border-ink bg-ink text-white'
                            : isSelected
                              ? 'border-accent bg-[#fff0eb] text-ink'
                              : 'border-line bg-canvas text-ink hover:border-accent'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          {option.label}
                          {isSelected && <Check size={17} className="shrink-0" />}
                        </span>
                        {selectedIndex === 0 && (
                          <span className="text-[11px] font-bold text-white/70">
                            대표 카테고리
                          </span>
                        )}
                        {selectedIndex > 0 && (
                          <span className="text-[11px] font-bold text-accent">
                            추가 카테고리
                          </span>
                        )}
                      </button>
                      {selectedIndex > 0 && (
                        <button
                          type="button"
                          aria-label={`${option.label} 대표로 지정`}
                          className="min-h-11 rounded-xl px-2 text-xs font-semibold text-accent underline underline-offset-4 hover:bg-canvas"
                          onClick={(event) => {
                            // 기존 분류를 유지하면서 대표 항목만 맨 앞으로 옮긴다.
                            setDraftValue((currentValue) => [option.value, ...currentValue.filter((category) => category !== option.value)])
                            if (event.currentTarget.previousElementSibling instanceof HTMLButtonElement) {
                              event.currentTarget.previousElementSibling.focus()
                            }
                          }}
                        >
                          대표로 지정
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <footer className="grid grid-cols-[0.8fr_1.2fr] gap-2 border-t border-line bg-canvas/60 px-4 py-3">
              <button
                type="button"
                onClick={closePicker}
                className="rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(draftValue)
                  closePicker()
                }}
                disabled={draftValue.length === 0}
                className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {draftValue.length}개 카테고리 적용
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
