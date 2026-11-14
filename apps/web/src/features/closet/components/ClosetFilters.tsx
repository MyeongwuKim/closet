import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import type { DateSortOrder } from '../../../components/DateSortButton'
import { useDrawerDisclosure } from '../../../hooks/useDrawerDisclosure'
import { useWardrobeBrandManagement } from '../hooks/useWardrobeBrandManagement'
import type { WardrobeColorOption } from '../utils/color'
import type { WardrobeFilterSelection } from '../utils/wardrobeFilters'
import { ClosetFilterOptions } from './ClosetFilterOptions'
import { ClosetFilterSelection } from './ClosetFilterSelection'

interface ClosetFiltersProps {
  selection: WardrobeFilterSelection[]
  colors: WardrobeColorOption[]
  tags: string[]
  isLoading: boolean
  sortOrder: DateSortOrder
  onToggle: (item: WardrobeFilterSelection) => void
  onBrandDeleted: (brand: string) => void
  onSortChange: (order: DateSortOrder) => void
  /** 계절·카테고리·검색어를 유지하고 세부 조건만 지운다. */
  onReset: () => void
}

/** 제목 옆 도구에서 세부 필터를 연다. 서랍·선택 칩의 공간을 유지하고 탭의 긴 선택지만 내부에서 스크롤한다. 선택은 URL에 즉시 반영한다. */
export function ClosetFilters({ selection, colors, tags, isLoading, sortOrder, onToggle, onBrandDeleted, onSortChange, onReset }: ClosetFiltersProps) {
  const titleId = useId()
  const panelId = useId()
  const { isOpen, isVisible, open, close } = useDrawerDisclosure()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const confirmationRef = useRef<HTMLDivElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)
  const dismissRef = useRef<() => void>(() => undefined)
  const activeCount = selection.length + Number(sortOrder !== 'latest')
  const management = useWardrobeBrandManagement({
    selectedBrands: selection.filter((item) => item.kind === 'brand').map((item) => item.value),
    onSelectedBrandDeleted: onBrandDeleted,
  })

  /** 삭제 처리 중에는 유지하고, 확인창이 열려 있으면 그 확인만 먼저 닫는다. */
  function dismiss() {
    if (management.isDeleting) return
    if (management.brandToDelete) management.cancelDelete()
    else {
      if (management.isManaging) management.toggleManagement()
      close()
    }
  }
  useEffect(() => { dismissRef.current = dismiss })

  // 최상위 확인창 또는 필터 안에서 Tab을 순환시키고 닫힌 뒤 제목 옆 버튼으로 초점을 돌린다.
  useEffect(() => {
    if (!isVisible) return
    const trigger = triggerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')]
      const topDialog = dialogs.at(-1)
      const isOwnDialog = topDialog === panelRef.current || Boolean(topDialog && confirmationRef.current?.contains(topDialog))
      if (!isOwnDialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        dismissRef.current()
      }
      if (event.key !== 'Tab' || !topDialog) return
      const controls = [...topDialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')]
        .filter((element) => element.getClientRects().length > 0 && !element.closest('[inert]'))
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
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus({ preventScroll: true })
    }
  }, [isVisible])

  // ブランド 삭제 확인으로 이동한 초점을 취소 뒤 원래 브랜드의 삭제 버튼에 돌린다.
  useEffect(() => {
    if (!management.brandToDelete) return
    confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    const trigger = deleteTriggerRef.current
    return () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }) }
  }, [management.brandToDelete])

  return (
    <>
      <button ref={triggerRef} type="button" aria-label="옷장 필터" aria-haspopup="dialog" aria-expanded={isOpen} aria-controls={isVisible ? panelId : undefined}
        onClick={open} title={activeCount ? `필터 ${activeCount}개 적용` : '옷장 필터'} className="collection-action relative">
        <SlidersHorizontal size={19} aria-hidden="true" />
        {activeCount > 0 && <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-4 text-surface" aria-label={`${activeCount}개 조건 적용`}>{activeCount}</span>}
      </button>
      {isVisible && createPortal(
        <>
          <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/30 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss() }}>
            <section ref={panelRef} id={panelId} role="dialog" aria-modal="true" aria-labelledby={titleId} inert={Boolean(management.brandToDelete)}
              data-state={isOpen ? 'open' : 'closing'} className="room-drawer-sheet flex h-[min(32rem,calc(100dvh-1.5rem))] w-full max-w-lg flex-col">
              <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2">
                <h2 id={titleId} className="flex-1 text-lg font-semibold">옷장 필터</h2>
                <button type="button" onClick={dismiss} autoFocus aria-label="옷장 필터 닫기" className="flex size-11 items-center justify-center rounded-full hover:bg-canvas focus-visible:ring-2 focus-visible:ring-accent"><X size={20} /></button>
              </header>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3">
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs font-medium text-muted">정렬</span>
                  <div className="flex gap-1 rounded-xl bg-canvas p-1" role="group" aria-label="정렬 순서">
                    {([{ value: 'latest', label: '최신순' }, { value: 'oldest', label: '오래된순' }] as const).map((option) => <button key={option.value} type="button" aria-pressed={sortOrder === option.value} onClick={() => onSortChange(option.value)} className={`min-h-8 rounded-lg px-3 text-xs font-medium ${sortOrder === option.value ? 'bg-sage text-ink' : 'text-muted'}`}>{option.label}</button>)}
                  </div>
                  <button type="button" onClick={onReset} disabled={!activeCount} className="ml-auto min-h-10 px-1 text-xs font-medium text-accent disabled:opacity-40">초기화</button>
                </div>
                <div className="mt-2 h-11 shrink-0"><ClosetFilterSelection selection={selection} colors={colors} onToggle={onToggle} /></div>
                <ClosetFilterOptions selection={selection} colors={colors} tags={tags} isLoading={isLoading} management={management} onToggle={onToggle}
                  onDeleteBrand={(brand, trigger) => { deleteTriggerRef.current = trigger; management.requestDelete(brand) }} />
                <p className="mt-2 shrink-0 text-xs text-muted">여러 개를 고를 수 있어요. 다시 누르면 해제돼요.</p>
              </div>
              <footer className="shrink-0 border-t border-line px-4 pt-3 pb-[calc(.75rem+env(safe-area-inset-bottom))]">
                <button type="button" onClick={dismiss} className="min-h-11 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-surface">옷 보기</button>
              </footer>
            </section>
          </div>
          {management.brandToDelete && <div ref={confirmationRef}><ConfirmDialog title="브랜드를 삭제할까요?" description={`${management.brandToDelete} 브랜드를 해제해요. 옷과 코디 기록은 그대로 남아요.`} confirmLabel="브랜드 삭제" isPending={management.isDeleting} onCancel={management.cancelDelete} onConfirm={() => void management.confirmDelete()} /></div>}
        </>,
        document.body,
      )}
    </>
  )
}
