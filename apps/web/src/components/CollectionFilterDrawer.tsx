import type { ReactNode, Ref } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import type { DateSortOrder } from './DateSortButton'

interface CollectionFilterButtonProps {
  label: string
  count: number
  isOpen: boolean
  panelId?: string
  buttonRef: Ref<HTMLButtonElement>
  onOpen: () => void
}

/** 목록의 필터를 열고 적용된 조건 수를 표시한다. */
export function CollectionFilterButton({ label, count, isOpen, panelId, buttonRef, onOpen }: CollectionFilterButtonProps) {
  return (
    <button ref={buttonRef} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={panelId}
      onClick={onOpen} title={count ? `필터 ${count}개 적용` : label} className="collection-action relative">
      <SlidersHorizontal size={19} aria-hidden="true" />
      {count > 0 && <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-4 text-surface" aria-label={`${count}개 조건 적용`}>{count}</span>}
    </button>
  )
}

interface CollectionFilterDrawerProps {
  title: string
  titleId: string
  panelId: string
  panelRef: Ref<HTMLElement>
  isOpen: boolean
  inert?: boolean
  onDismiss: () => void
  actionLabel: string
  footerContent?: ReactNode
  children: ReactNode
}

/** 목록 필터의 배경·제목·닫기·하단 버튼을 공통으로 배치한다. 필터 내용과 열림 상태는 호출부에서 관리한다. */
export function CollectionFilterDrawer({ title, titleId, panelId, panelRef, isOpen, inert, onDismiss, actionLabel, footerContent, children }: CollectionFilterDrawerProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/30 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onDismiss() }}>
      <section ref={panelRef} id={panelId} role="dialog" aria-modal="true" aria-labelledby={titleId} inert={inert}
        data-state={isOpen ? 'open' : 'closing'} className="room-drawer-sheet flex h-[min(32rem,calc(100dvh-1.5rem))] w-full max-w-lg flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2">
          <h2 id={titleId} className="flex-1 text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onDismiss} autoFocus aria-label={`${title} 닫기`} className="flex size-11 items-center justify-center rounded-full hover:bg-canvas focus-visible:ring-2 focus-visible:ring-accent"><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
          {children}
        </div>
        <footer className="shrink-0 border-t border-line px-4 pt-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
          {footerContent && <div className="mb-2">{footerContent}</div>}
          <button type="button" onClick={onDismiss} className="min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-surface">{actionLabel}</button>
        </footer>
      </section>
    </div>
  )
}


interface CollectionFilterSortProps {
  order: DateSortOrder
  onChange: (order: DateSortOrder) => void
  onReset: () => void
  canReset: boolean
}

const sortOptions = [
  { value: 'latest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
] as const

/** 정렬 순서를 선택하고 상세 필터를 초기화한다. 초기화 범위는 호출부가 정한다. */
export function CollectionFilterSort({ order, onChange, onReset, canReset }: CollectionFilterSortProps) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span className="text-xs font-medium text-muted">정렬</span>
      <div role="group" aria-label="정렬 순서" className="flex gap-1 rounded-xl bg-canvas p-1">
        {sortOptions.map((option) => (
          <button key={option.value} type="button" aria-pressed={order === option.value} onClick={() => onChange(option.value)}
            className={`min-h-8 rounded-lg px-3 text-xs font-medium ${order === option.value ? 'bg-sage text-ink' : 'text-muted'}`}>
            {option.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={onReset} disabled={!canReset} className="ml-auto min-h-10 px-1 text-xs font-medium text-accent disabled:opacity-40">초기화</button>
    </div>
  )
}
