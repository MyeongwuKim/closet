import { useId, useState } from 'react'
import { Check, Search, Trash2 } from 'lucide-react'
import { useWardrobeBrandOptionsQuery } from '../api/wardrobeQueries'
import type { useWardrobeBrandManagement } from '../hooks/useWardrobeBrandManagement'
import type { WardrobeColorOption } from '../utils/color'
import { getWardrobeBrandKey, getWardrobeBrandOptions } from '../utils/wardrobeBrands'
import { wardrobeFilterSelectionKey, type WardrobeFilterKind, type WardrobeFilterSelection } from '../utils/wardrobeFilters'

interface Props {
  selection: WardrobeFilterSelection[]
  colors: WardrobeColorOption[]
  tags: string[]
  isLoading: boolean
  management: ReturnType<typeof useWardrobeBrandManagement>
  onToggle: (item: WardrobeFilterSelection) => void
  onDeleteBrand: (brand: string, trigger: HTMLButtonElement) => void
}

const tabs = [{ kind: 'color', label: '색상' }, { kind: 'brand', label: '브랜드' }, { kind: 'tag', label: '태그' }] as const

/** 색상·브랜드·태그를 같은 선택 영역의 탭으로 전환한다. 선택지를 바로 눌러 복수 선택하고 브랜드 검색·관리도 이 영역에서 처리한다. */
export function ClosetFilterOptions({ selection, colors, tags, isLoading, management, onToggle, onDeleteBrand }: Props) {
  const id = useId()
  const [activeTab, setActiveTab] = useState<'color' | 'brand' | 'tag'>('color')
  const [brandSearch, setBrandSearch] = useState('')
  const brandsQuery = useWardrobeBrandOptionsQuery(activeTab === 'brand')
  const selectedKeys = new Set(selection.map(wardrobeFilterSelectionKey))
  const selectedBrands = selection.filter((item) => item.kind === 'brand').map((item) => item.value)
  const brands = getWardrobeBrandOptions([...(brandsQuery.data ?? []), ...selectedBrands])
    .filter((brand) => getWardrobeBrandKey(brand).includes(getWardrobeBrandKey(brandSearch)))
  const selected = (kind: WardrobeFilterKind, value: string) => selectedKeys.has(wardrobeFilterSelectionKey({ kind, value }))
  const optionClass = (active: boolean) => `flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${active ? 'border-accent bg-sage text-ink' : 'border-line bg-surface text-muted hover:border-accent'}`

  return (
    <>
      <div role="tablist" aria-label="필터 항목" className="mt-3 grid shrink-0 grid-cols-3 border-b border-line">
        {tabs.map((tab, index) => {
          const count = selection.filter((item) => item.kind === tab.kind || (tab.kind === 'brand' && item.kind === 'unbranded')).length
          return (
            <button key={tab.kind} type="button" id={`${id}-${tab.kind}`} role="tab" aria-selected={activeTab === tab.kind} aria-controls={`${id}-panel`} tabIndex={activeTab === tab.kind ? 0 : -1}
              className={`min-h-10 border-b-2 px-3 text-sm font-medium ${activeTab === tab.kind ? 'border-accent text-accent' : 'border-transparent text-muted'}`}
              onClick={() => setActiveTab(tab.kind)}
              onKeyDown={(event) => {
                const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
                if (next === null) return
                event.preventDefault()
                setActiveTab(tabs[next].kind)
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
              }}
            >{tab.label}{count > 0 && <span className="ml-1.5 text-xs tabular-nums">{count}</span>}</button>
          )
        })}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${activeTab}`} className="min-h-0 flex-1 overflow-y-auto pt-3">
        {activeTab === 'color' && (isLoading ? <p role="status" className="py-4 text-sm text-muted">색상을 불러오는 중</p> : (
          <div className="grid grid-cols-3 gap-2">
            {[...colors, ...selection.filter((item) => item.kind === 'color' && !colors.some((color) => color.name === item.value)).map((item) => ({ name: item.value, hex: '#e3dace' }))].map((color) => {
              const active = selected('color', color.name)
              return <button type="button" key={color.name} aria-pressed={active} onClick={() => onToggle({ kind: 'color', value: color.name })} className={optionClass(active)}>
                <span className="size-4 shrink-0 rounded-full border border-ink/15" style={{ backgroundColor: color.hex }} aria-hidden="true" /><span className="truncate">{color.name}</span>{active && <Check size={13} className="shrink-0" aria-hidden="true" />}
              </button>
            })}
            {!colors.length && !selection.some((item) => item.kind === 'color') && <p className="col-span-3 py-4 text-sm text-muted">등록된 색상이 없어요.</p>}
          </div>
        ))}
        {activeTab === 'brand' && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-canvas px-3"><Search size={15} aria-hidden="true" /><input type="search" value={brandSearch} onChange={(event) => setBrandSearch(event.target.value)} placeholder="브랜드 검색" aria-label="저장된 브랜드 검색" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
              <button type="button" onClick={management.toggleManagement} disabled={management.isDeleting} aria-pressed={management.isManaging} className="min-h-10 px-2 text-xs font-medium text-accent">{management.isManaging ? '관리 완료' : '관리'}</button>
            </div>
            {brandsQuery.isPending ? <p role="status" className="py-3 text-sm text-muted">브랜드를 불러오는 중</p> : brandsQuery.isError ? <div className="flex items-center justify-between gap-2 text-sm"><p role="alert">브랜드를 불러오지 못했어요.</p><button type="button" onClick={() => void brandsQuery.refetch()} className="min-h-10 px-2 text-accent">다시 시도</button></div> : null}
            <div className="grid grid-cols-2 gap-2">
              {!brandSearch && <button type="button" aria-pressed={selected('unbranded', '1')} onClick={() => onToggle({ kind: 'unbranded', value: '1' })} className={optionClass(selected('unbranded', '1'))}>브랜드 미지정{selected('unbranded', '1') && <Check size={13} aria-hidden="true" />}</button>}
              {brands.map((brand) => <div className="flex min-w-0 items-center gap-1" key={getWardrobeBrandKey(brand)}>
                <button type="button" aria-pressed={selected('brand', brand)} onClick={() => onToggle({ kind: 'brand', value: brand })} disabled={management.isDeleting} className={`${optionClass(selected('brand', brand))} flex-1`}><span className="truncate">{brand}</span>{selected('brand', brand) && <Check size={13} className="shrink-0" aria-hidden="true" />}</button>
                {management.isManaging && <button type="button" onClick={(event) => onDeleteBrand(brand, event.currentTarget)} disabled={management.isDeleting} aria-label={`${brand} 브랜드 삭제`} className="flex size-10 shrink-0 items-center justify-center rounded-xl text-danger hover:bg-danger-soft"><Trash2 size={15} aria-hidden="true" /></button>}
              </div>)}
              {brandSearch && !brands.length && !brandsQuery.isPending && <p className="col-span-2 py-3 text-sm text-muted">검색한 브랜드가 없어요.</p>}
            </div>
          </>
        )}
        {activeTab === 'tag' && (isLoading ? <p role="status" className="py-4 text-sm text-muted">태그를 불러오는 중</p> : (
          <div className="flex flex-wrap gap-2">
            {[...new Set([...tags, ...selection.filter((item) => item.kind === 'tag').map((item) => item.value)])].map((tag) => <button type="button" key={tag} aria-pressed={selected('tag', tag)} onClick={() => onToggle({ kind: 'tag', value: tag })} className={optionClass(selected('tag', tag))}>#{tag}{selected('tag', tag) && <Check size={13} aria-hidden="true" />}</button>)}
            {!tags.length && !selection.some((item) => item.kind === 'tag') && <p className="py-4 text-sm text-muted">옷에 등록한 태그가 없어요.</p>}
          </div>
        ))}
      </div>
    </>
  )
}
