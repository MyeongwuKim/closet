import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { CollectionFilterButton, CollectionFilterDrawer, CollectionFilterSort } from '../../../components/CollectionFilterDrawer'
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
  viewControl?: ReactNode
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
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown, true)
      trigger?.focus({ preventScroll: true })
    }
  }, [isVisible])

  return <>
    <CollectionFilterButton label="코디북 필터" count={count} isOpen={isOpen} panelId={isVisible ? panelId : undefined} buttonRef={triggerRef} onOpen={open} />
    {isVisible && createPortal(
      <CollectionFilterDrawer title="코디북 필터" titleId={titleId} panelId={panelId} panelRef={panelRef} isOpen={isOpen} onDismiss={close} actionLabel="코디 보기">
        {viewControl && <div className="mb-3 flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-line pb-3">
          <span className="text-xs font-medium text-muted">보기</span>
          {viewControl}
        </div>}
        <CollectionFilterSort order={sortOrder} onChange={onSortChange} onReset={() => { onColorChange(null); onSortChange('latest') }} canReset={count > 0} />
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
      </CollectionFilterDrawer>, document.body,
    )}
  </>
}
