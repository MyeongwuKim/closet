import { useId, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronDown, Plus, Tag, X } from 'lucide-react'
import {
  defaultWardrobeTags,
  getRankedWardrobeTags,
  normalizeWardrobeTag,
} from '../utils/wardrobeTags'

const MAX_TAG_COUNT = 5
const MAX_TAG_LENGTH = 15

interface WardrobeTagFieldProps {
  value: string[]
  suggestions?: string[]
  onChange: (tags: string[]) => void
  defaultOpen?: boolean
}

export function WardrobeTagField({
  value,
  suggestions = [],
  onChange,
  defaultOpen = false,
}: WardrobeTagFieldProps) {
  const inputId = useId()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [inputValue, setInputValue] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const isFull = value.length >= MAX_TAG_COUNT
  const availableSuggestions = useMemo(() => {
    const selectedKeys = new Set(
      value.map((tagValue) => normalizeWardrobeTag(tagValue).toLowerCase()),
    )

    return getRankedWardrobeTags(
      [...suggestions, ...defaultWardrobeTags],
      20,
    )
      .filter(
        (tagValue) =>
          !selectedKeys.has(normalizeWardrobeTag(tagValue).toLowerCase()),
      )
      .slice(0, 8)
  }, [suggestions, value])

  const addTag = (rawValue: string) => {
    const nextTag = normalizeWardrobeTag(rawValue)
    if (!nextTag) return
    if (nextTag.length > MAX_TAG_LENGTH) {
      setErrorMessage(`태그는 ${MAX_TAG_LENGTH}자까지 입력할 수 있어요.`)
      return
    }
    if (isFull) {
      setErrorMessage(`태그는 ${MAX_TAG_COUNT}개까지 추가할 수 있어요.`)
      return
    }
    if (
      value.some(
        (tagValue) =>
          normalizeWardrobeTag(tagValue).toLowerCase() ===
          nextTag.toLowerCase(),
      )
    ) {
      setErrorMessage('이미 추가한 태그예요.')
      return
    }

    onChange([...value, nextTag])
    setInputValue('')
    setErrorMessage('')
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    addTag(inputValue)
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-4 text-left"
        aria-expanded={isOpen}
        aria-controls={`${inputId}-content`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sage">
          <Tag size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-black">
            태그 추가
            {value.length > 0 && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] text-white">
                {value.length}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-muted">
            나만의 기준으로 저장하고 검색할 수 있어요.
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          id={`${inputId}-content`}
          className="border-t border-line px-4 pt-4 pb-5"
        >
          {value.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2" aria-label="추가한 태그">
              {value.map((tagValue) => (
                <span
                  key={tagValue}
                  className="inline-flex h-9 items-center gap-1 rounded-full bg-ink pr-2 pl-3 text-xs font-bold text-white"
                >
                  #{tagValue}
                  <button
                    type="button"
                    className="flex size-6 items-center justify-center rounded-full text-white/70 hover:bg-white/15 hover:text-white"
                    onClick={() =>
                      onChange(value.filter((currentTag) => currentTag !== tagValue))
                    }
                    aria-label={`${tagValue} 태그 삭제`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <label className="sr-only" htmlFor={inputId}>
              새 태그
            </label>
            <input
              id={inputId}
              type="text"
              value={inputValue}
              maxLength={MAX_TAG_LENGTH + 1}
              disabled={isFull}
              placeholder={isFull ? '태그를 모두 추가했어요' : '예: 출근, 여행'}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm outline-none placeholder:text-muted focus:border-accent disabled:bg-canvas"
              onChange={(event) => {
                setInputValue(event.target.value)
                setErrorMessage('')
              }}
              onKeyDown={handleInputKeyDown}
            />
            <button
              type="button"
              disabled={isFull || !inputValue.trim()}
              className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-ink px-3 text-xs font-bold text-white disabled:opacity-35"
              onClick={() => addTag(inputValue)}
            >
              <Plus size={15} /> 추가
            </button>
          </div>

          {errorMessage && (
            <p className="mt-2 text-xs font-bold text-accent" role="alert">
              {errorMessage}
            </p>
          )}

          {!isFull && availableSuggestions.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-bold text-muted">빠른 태그</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {availableSuggestions.map((tagValue) => (
                  <button
                    type="button"
                    key={tagValue}
                    onClick={() => addTag(tagValue)}
                    className="rounded-full border border-line bg-white px-3 py-2 text-xs font-bold hover:border-ink"
                  >
                    + {tagValue}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-5 text-muted">
            Enter 또는 쉼표로 추가 · 최대 {MAX_TAG_COUNT}개
          </p>
        </div>
      )}
    </section>
  )
}
