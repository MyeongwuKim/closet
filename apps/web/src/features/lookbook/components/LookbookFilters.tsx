import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, SlidersHorizontal, X } from 'lucide-react'
import type { DateSortOrder } from '../../../components/DateSortButton'
import { useDrawerDisclosure } from '../../../hooks/useDrawerDisclosure'
import type { WardrobeColorOption } from '../../closet/utils/color'

interface Props {
  color: string | null
  colors: WardrobeColorOption[]
  isLoading: boolean
  sortOrder: DateSortOrder
  onColorChange: (color: string | null) => void
  onSortChange: (order: DateSortOrder) => void
  viewControl: ReactNode
}

/** 제목 옆에서 보기·정렬·색상을 고른다. 계절·스타일은 유지하고, 선택지 수와 관계없이 서랍 높이를 유지한다. */
export function LookbookFilters({ color, colors, isLoading, sortOrder, onColorChange, onSortChange, viewControl }: Props) {
  const titleId = useId()
  const panelId = useId()
  const { isOpen, isVisible, open, close } = useDrawerDisclosure()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef(close)
  const count = Number(Boolean(color)) + Number(sortOrder !== 'latest')
  useEffect(() => { closeRef.current = close }, [close])

  // 서랍 안에서 키보드 초점을 순환시키고 닫힌 뒤 제목 옆 필터 버튼으로 돌린다.
  useEffect(() => {
    if (!isVisible) return
    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const controls = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])]
      const first = controls[0]
      const last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      trigger?.focus({ preventScroll: true })
    }
  }, [isVisible])

  return <>
    <button ref={triggerRef} type="button" aria-label="코디북 필터" aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={isVisible ? panelId : undefined} onClick={open} className="collection-action relative" title={count ? `필터 ${count}개 적용` : '코디북 필터'}>
      <SlidersHorizontal size={19} aria-hidden="true" />
      {count > 0 && <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-4 text-surface" aria-label={`${count}개 조건 적용`}>{count}</span>}
    </button>
    {isVisible && createPortal(
      <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/30 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
        <section ref={panelRef} id={panelId} role="dialog" aria-modal="true" aria-labelledby={titleId} data-state={isOpen ? 'open' : 'closing'} className="room-drawer-sheet flex h-[min(32rem,calc(100dvh-1.5rem))] w-full max-w-lg flex-col">
          <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2">
            <h2 id={titleId} className="flex-1 text-lg font-semibold">코디북 필터</h2>
            <button type="button" onClick={close} autoFocus aria-label="코디북 필터 닫기" className="flex size-11 items-center justify-center rounded-full hover:bg-canvas focus-visible:ring-2 focus-visible:ring-accent"><X size={20} /></button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
            <div className="mb-3 flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-line pb-3">
              <span className="text-xs font-medium text-muted">보기</span>
              {viewControl}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs font-medium text-muted">정렬</span>
              <div role="group" aria-label="정렬 순서" className="flex gap-1 rounded-xl bg-canvas p-1">
                {([{ value: 'latest', label: '최신순' }, { value: 'oldest', label: '오래된순' }] as const).map((option) => <button key={option.value} type="button" aria-pressed={sortOrder === option.value} onClick={() => onSortChange(option.value)} className={`min-h-8 rounded-lg px-3 text-xs font-medium ${sortOrder === option.value ? 'bg-sage text-ink' : 'text-muted'}`}>{option.label}</button>)}
              </div>
              <button type="button" disabled={!count} onClick={() => { onColorChange(null); onSortChange('latest') }} className="ml-auto min-h-10 px-1 text-xs font-medium text-accent disabled:opacity-40">초기화</button>
            </div>
            <h3 className="mt-4 shrink-0 border-b border-line pb-3 text-sm font-medium">색상</h3>
            <div className="min-h-0 flex-1 overflow-y-auto pt-3">
              {isLoading ? <p role="status" className="py-4 text-sm text-muted">색상을 불러오는 중</p> : <div className="grid grid-cols-3 gap-2">
                {[{ name: '전체 색상', hex: null }, ...colors].map((option) => {
                  const value = option.hex === null ? null : option.name
                  const active = color === value
                  return <button key={option.name} type="button" aria-pressed={active} onClick={() => onColorChange(active ? null : value)} className={`flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${active ? 'border-accent bg-sage text-ink' : 'border-line bg-surface text-muted hover:border-accent'}`}>
                    {option.hex && <span className="size-4 shrink-0 rounded-full border border-ink/15" style={{ backgroundColor: option.hex }} aria-hidden="true" />}<span className="truncate">{option.name}</span>{active && <Check size={13} className="shrink-0" aria-hidden="true" />}
                  </button>
                })}
              </div>}
            </div>
          </div>
          <footer className="shrink-0 border-t border-line px-4 pt-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
            <button type="button" onClick={close} className="min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-surface">코디 보기</button>
          </footer>
        </section>
      </div>, document.body,
    )}
  </>
}
