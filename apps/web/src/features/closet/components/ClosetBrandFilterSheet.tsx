import { useEffect, useId, useRef, useState } from 'react'
import { Check, Search, Settings2, Tags, Trash2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { useWardrobeBrandOptionsQuery } from '../api/wardrobeQueries'
import { useWardrobeBrandManagement } from '../hooks/useWardrobeBrandManagement'
import { getWardrobeBrandKey, getWardrobeBrandOptions } from '../utils/wardrobeBrands'
import './ClosetBrandFilterSheet.css'

interface ClosetBrandFilterSheetProps {
  value: string | null
  unbrandedOnly: boolean
  isOpen: boolean
  onChange: (value: string | null, unbrandedOnly?: boolean) => void
  onClose: () => void
}

interface BrandOptionProps {
  brand: string
  isSelected: boolean
  isManaging: boolean
  isVisible: boolean
  onSelect: () => void
  onDelete: (trigger: HTMLButtonElement) => void
}

/** 브랜드 이름 선택과 삭제 버튼을 분리해 삭제를 눌러도 필터가 변경되지 않게 한다. */
function BrandOption({ brand, isSelected, isManaging, isVisible, onSelect, onDelete }: BrandOptionProps) {
  const mark = /^[A-Za-z]/.test(brand) ? brand.slice(0, 2).toUpperCase() : [...brand][0]
  return (
    <div className="brand-result-row" data-visible={isVisible} aria-hidden={!isVisible} inert={!isVisible}>
      <div className="brand-result-clip">
        <div className="brand-option" data-selected={isSelected} data-managing={isManaging}>
          <button type="button" onClick={onSelect} aria-pressed={isSelected} className="brand-option-select">
            <span className="brand-option-mark" aria-hidden="true">{mark}</span>
            <span className="min-w-0 flex-1 break-words">{brand}</span>
            <span className="brand-option-check" aria-hidden="true"><Check size={13} /></span>
          </button>
          <div className="brand-option-delete" inert={!isManaging} aria-hidden={!isManaging}>
            <button type="button" onClick={(event) => onDelete(event.currentTarget)} aria-label={`${brand} 브랜드 삭제`}><Trash2 size={16} aria-hidden="true" /></button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 브랜드 검색·선택·삭제를 표시한다. 창 높이를 제한하고 제목과 검색창을 고정한 채 목록만 스크롤하며, 삭제는 별도 확인창에서 확정한다. */
export function ClosetBrandFilterSheet({ value, unbrandedOnly, isOpen, onChange, onClose }: ClosetBrandFilterSheetProps) {
  const titleId = useId()
  const [search, setSearch] = useState('')
  const brandsQuery = useWardrobeBrandOptionsQuery()
  const management = useWardrobeBrandManagement({
    selectedBrand: value,
    onSelectedBrandDeleted: () => onChange(null, true),
  })
  const closeRef = useRef<() => void>(() => {})
  const confirmationRef = useRef<HTMLDivElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)
  const brandOptions = getWardrobeBrandOptions(brandsQuery.data ?? [], value ?? '')
  const matchingBrands = brandOptions.filter((brand) => getWardrobeBrandKey(brand).includes(getWardrobeBrandKey(search)))

  /** 처리 중에는 창을 유지하며, 삭제 확인창이 열려 있으면 먼저 그 확인만 취소한다. */
  function dismiss() {
    if (management.isDeleting) return
    if (management.brandToDelete) management.cancelDelete()
    else onClose()
  }

  useEffect(() => { closeRef.current = dismiss })

  // 창이 열려 있는 동안 배경 스크롤을 막고, Escape는 현재 표시된 확인창 또는 브랜드 창에 적용한다.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // 확인창이 열리면 닫기 버튼에 초점을 두고, 취소 후에는 해당 브랜드의 삭제 버튼으로 돌아간다.
  useEffect(() => {
    if (!management.brandToDelete) return
    confirmationRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    const trigger = deleteTriggerRef.current
    return () => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }) }
  }, [management.brandToDelete])

  /** 브랜드 또는 미지정 조건을 부모에 전달하고 선택 창을 닫는다. */
  function selectBrand(brand: string | null, missing = false) {
    onChange(brand, missing)
    onClose()
  }

  return createPortal(
    <>
      <div
        className="brand-filter-backdrop fixed inset-0 z-[130] flex items-end justify-center sm:items-center"
        data-state={isOpen ? 'open' : 'closing'}
        onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss() }}
      >
        <section
          className="room-drawer-sheet brand-filter-sheet flex w-full max-w-md flex-col"
          data-state={isOpen ? 'open' : 'closing'}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          inert={Boolean(management.brandToDelete)}
        >
          <header className="brand-filter-header">
            <span className="brand-filter-icon"><Tags size={19} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-semibold tracking-[-.035em]">브랜드</h2>
              <p className="mt-1 text-xs text-muted">원하는 브랜드의 옷만 모아보세요.</p>
            </div>
            <button type="button" onClick={dismiss} disabled={management.isDeleting} className="brand-filter-close" aria-label="브랜드 필터 닫기" autoFocus><X size={18} /></button>
          </header>

          <div className="brand-filter-tools">
            <label className="brand-filter-search">
              <Search size={17} className="shrink-0 text-muted" aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="브랜드 검색" aria-label="저장된 브랜드 검색" className="min-w-0 flex-1 bg-transparent text-sm outline-none" type="search" />
              <button type="button" onClick={() => setSearch('')} aria-label="브랜드 검색어 지우기" className="brand-search-clear" data-visible={Boolean(search)} inert={!search} aria-hidden={!search}><X size={14} /></button>
            </label>
            <button type="button" onClick={management.toggleManagement} aria-pressed={management.isManaging} aria-label={management.isManaging ? '브랜드 관리 완료' : '브랜드 관리'} className="brand-management-toggle">
              <span className="brand-manage-copy" data-active={!management.isManaging}><Settings2 size={15} /> 관리</span>
              <span className="brand-manage-copy" data-active={management.isManaging}><Check size={15} /> 완료</span>
            </button>
          </div>

          <div className="brand-management-note" data-open={management.isManaging} aria-hidden={!management.isManaging}>
            <div><p>브랜드를 삭제하면 연결된 옷은 미지정으로 바뀌어요.</p></div>
          </div>

          <div className="brand-filter-list scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="brand-scope-tabs">
              <span className="brand-scope-indicator" data-active={value === null || unbrandedOnly} style={{ transform: unbrandedOnly ? 'translateX(100%)' : undefined }} aria-hidden="true" />
              {[
                { label: '전체 브랜드', selected: value === null && !unbrandedOnly, missing: false },
                { label: '브랜드 미지정', selected: unbrandedOnly, missing: true },
              ].map((option) => (
                <button type="button" onClick={() => selectBrand(null, option.missing)} aria-pressed={option.selected} key={option.label}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="brand-list-heading"><span>{search.trim() ? '검색 결과' : '저장한 브랜드'}</span><span>{matchingBrands.length}</span></div>
            <div>
              {brandOptions.map((brand) => (
                <BrandOption
                  brand={brand}
                  isSelected={!unbrandedOnly && getWardrobeBrandKey(brand) === getWardrobeBrandKey(value ?? '')}
                  isManaging={management.isManaging}
                  isVisible={matchingBrands.includes(brand)}
                  onSelect={() => selectBrand(brand)}
                  onDelete={(trigger) => { deleteTriggerRef.current = trigger; management.requestDelete(brand) }}
                  key={brand}
                />
              ))}
            </div>

            {brandsQuery.isPending ? (
              <p className="py-5 text-center text-xs text-muted" role="status">브랜드를 불러오는 중...</p>
            ) : brandsQuery.isError ? (
              <div className="py-5 text-center text-xs text-muted" role="alert">
                <p>브랜드를 불러오지 못했어요.</p>
                <button type="button" className="mt-2 font-bold text-accent" onClick={() => void brandsQuery.refetch()}>다시 시도</button>
              </div>
            ) : (
              <div className="brand-empty-result" data-visible={matchingBrands.length === 0} aria-hidden={matchingBrands.length > 0}>
                <div><Search size={22} aria-hidden="true" /><p>{search.trim() ? '검색한 브랜드가 없어요.' : '옷에 브랜드를 등록하면 여기에 표시돼요.'}</p></div>
              </div>
            )}
          </div>
        </section>
      </div>

      {management.brandToDelete && (
        <div ref={confirmationRef} className="fixed inset-0 z-[140]">
          <ConfirmDialog
            title={`${management.brandToDelete} 브랜드를 삭제할까요?`}
            description="이 브랜드가 등록된 옷은 브랜드 미지정으로 바뀌어요. 옷 사진과 종류, 저장한 코디는 유지돼요."
            confirmLabel="브랜드 삭제"
            isPending={management.isDeleting}
            onCancel={management.cancelDelete}
            onConfirm={() => void management.confirmDelete()}
          />
        </div>
      )}
    </>, document.body,
  )
}
