import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, Plus, X } from 'lucide-react'
import { useWardrobeBrandOptionsQuery } from '../api/wardrobeQueries'
import {
  getWardrobeBrandOptions,
  normalizeWardrobeBrand,
} from '../utils/wardrobeBrands'

interface WardrobeBrandFieldProps {
  value: string
  onChange: (value: string) => void
}

/**
 * DB에 저장된 옷의 브랜드를 선택 목록으로 보여주고 목록에 없으면 중앙 입력창에서 새 이름을 받는다.
 * 새 브랜드는 현재 폼 값으로 추가하며 실제 DB 저장은 부모 옷 추가·수정 폼의 저장 시점에 수행한다.
 */
export function WardrobeBrandField({
  value,
  onChange,
}: WardrobeBrandFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCustomInputOpen, setIsCustomInputOpen] = useState(false)
  const [customBrand, setCustomBrand] = useState('')
  const labelId = useId()
  const dialogTitleId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const brandOptionsQuery = useWardrobeBrandOptionsQuery(isOpen)
  const brandOptions = useMemo(
    () => getWardrobeBrandOptions(brandOptionsQuery.data ?? [], value),
    [brandOptionsQuery.data, value],
  )

  const closePicker = () => {
    setIsOpen(false)
    setIsCustomInputOpen(false)
    setCustomBrand('')
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const selectBrand = (brand: string) => {
    onChange(brand)
    closePicker()
  }

  const addCustomBrand = () => {
    const brand = normalizeWardrobeBrand(customBrand)
    if (!brand) return
    selectBrand(brand)
  }

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (isCustomInputOpen) {
        setIsCustomInputOpen(false)
        setCustomBrand('')
        return
      }
      setIsOpen(false)
      window.requestAnimationFrame(() => triggerRef.current?.focus())
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isCustomInputOpen, isOpen])

  return (
    <>
      <div className="grid gap-2">
        <span id={labelId} className="flex items-center gap-1.5 text-sm font-bold">
          브랜드
          <span className="text-xs font-normal text-muted">선택</span>
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 text-left text-sm outline-none transition hover:border-ink focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
          aria-labelledby={labelId}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <span className={value ? 'font-bold text-ink' : 'text-muted'}>
            {value || '브랜드를 선택해주세요'}
          </span>
          <ChevronDown size={18} className="shrink-0 text-muted" />
        </button>
        <span className="text-xs leading-5 text-muted">
          {value
            ? '선택한 브랜드는 아래 변경사항 저장을 누르면 최종 반영돼요.'
            : '목록에 없다면 직접 입력해서 선택할 수 있어요.'}
        </span>
      </div>

      {isOpen && (
        <div
          className="option-picker-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-ink/40 px-5 py-8 backdrop-blur-[2px]"
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
              {isCustomInputOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomInputOpen(false)
                    setCustomBrand('')
                  }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted"
                  aria-label="브랜드 목록으로 돌아가기"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold tracking-wide text-accent">
                  {isCustomInputOpen ? '목록에 없는 브랜드' : '하나를 골라주세요'}
                </span>
                <h2 id={dialogTitleId} className="mt-1 text-xl font-black">
                  {isCustomInputOpen ? '브랜드 직접 입력' : '브랜드 선택'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closePicker}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted transition hover:text-ink"
                aria-label="브랜드 선택창 닫기"
              >
                <X size={18} />
              </button>
            </header>

            {isCustomInputOpen ? (
              <div
                className="grid gap-4 p-5"
                onKeyDown={(event) => {
                  if (
                    event.key !== 'Enter' ||
                    event.nativeEvent.isComposing
                  ) {
                    return
                  }
                  event.preventDefault()
                  event.stopPropagation()
                  addCustomBrand()
                }}
              >
                <label className="grid gap-2 text-sm font-bold">
                  브랜드명
                  <input
                    type="text"
                    value={customBrand}
                    onChange={(event) => setCustomBrand(event.target.value)}
                    placeholder="예: 무신사 스탠다드, COS"
                    maxLength={50}
                    className="h-12 rounded-xl border border-line bg-white px-3 outline-none focus:border-accent"
                    autoFocus
                  />
                </label>
                <p className="text-xs leading-5 text-muted">
                  추가한 브랜드는 선택되며, 수정 화면에서 변경사항을 저장하면
                  DB에 반영돼요.
                </p>
                <button
                  type="button"
                  onClick={addCustomBrand}
                  disabled={!normalizeWardrobeBrand(customBrand)}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40"
                >
                  <Plus size={17} />
                  추가하고 선택
                </button>
              </div>
            ) : (
              <div className="scrollbar-hidden min-h-0 overflow-y-auto p-4">
                <button
                  type="button"
                  onClick={() => setIsCustomInputOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-accent bg-accent/5 px-4 py-3 text-sm font-bold text-accent"
                >
                  <Plus size={17} />
                  목록에 없는 브랜드 직접 입력
                </button>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => selectBrand('')}
                    className={`min-h-14 rounded-2xl border px-4 py-3 text-left text-sm font-bold ${
                      !value
                        ? 'border-ink bg-ink text-white'
                        : 'border-line bg-canvas text-muted'
                    }`}
                    aria-pressed={!value}
                  >
                    브랜드 없음
                  </button>
                  {brandOptions.map((brand) => {
                    const isSelected =
                      normalizeWardrobeBrand(brand).toLocaleLowerCase('ko-KR') ===
                      normalizeWardrobeBrand(value).toLocaleLowerCase('ko-KR')

                    return (
                      <button
                        type="button"
                        onClick={() => selectBrand(brand)}
                        className={`flex min-h-14 items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-bold ${
                          isSelected
                            ? 'border-ink bg-ink text-white'
                            : 'border-line bg-canvas text-ink'
                        }`}
                        aria-pressed={isSelected}
                        key={brand}
                      >
                        <span className="min-w-0 truncate">{brand}</span>
                        {isSelected && <Check size={17} className="shrink-0" />}
                      </button>
                    )
                  })}
                </div>

                {brandOptionsQuery.isPending && (
                  <p className="py-5 text-center text-xs text-muted">
                    저장된 브랜드를 불러오는 중...
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
