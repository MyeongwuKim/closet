import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { CollectionFilterButton, CollectionFilterDrawer, CollectionFilterSort } from '../../../components/CollectionFilterDrawer'
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

/** 제목 옆 도구에서 세부 필터를 연다. 서랍 높이를 유지하고 선택 칩은 하단에 표시하며 탭의 긴 선택지만 내부에서 스크롤한다. 선택은 URL에 즉시 반영한다. */
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
      <CollectionFilterButton label="옷장 필터" count={activeCount} isOpen={isOpen} panelId={isVisible ? panelId : undefined} buttonRef={triggerRef} onOpen={open} />
      {isVisible && createPortal(
        <>
          <CollectionFilterDrawer title="옷장 필터" titleId={titleId} panelId={panelId} panelRef={panelRef} isOpen={isOpen} onDismiss={dismiss} actionLabel="옷 보기" inert={Boolean(management.brandToDelete)}
            footerContent={selection.length > 0 && <ClosetFilterSelection selection={selection} colors={colors} onToggle={onToggle} />}>
            <CollectionFilterSort order={sortOrder} onChange={onSortChange} onReset={onReset} canReset={activeCount > 0} />
            <ClosetFilterOptions selection={selection} colors={colors} tags={tags} isLoading={isLoading} management={management} onToggle={onToggle}
              onDeleteBrand={(brand, trigger) => { deleteTriggerRef.current = trigger; management.requestDelete(brand) }} />
            <p className="mt-2 shrink-0 text-xs text-muted">여러 개를 고를 수 있어요. 다시 누르면 해제돼요.</p>
          </CollectionFilterDrawer>
          {management.brandToDelete && <div ref={confirmationRef}><ConfirmDialog title="브랜드를 삭제할까요?" description={`${management.brandToDelete} 브랜드를 해제해요. 옷과 코디 기록은 그대로 남아요.`} confirmLabel="브랜드 삭제" isPending={management.isDeleting} onCancel={management.cancelDelete} onConfirm={() => void management.confirmDelete()} /></div>}
        </>,
        document.body,
      )}
    </>
  )
}
