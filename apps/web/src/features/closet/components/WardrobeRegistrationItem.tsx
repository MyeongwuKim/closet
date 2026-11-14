import { Pencil, Trash2 } from 'lucide-react'
import type { ClassificationCandidate } from '../../../stores/useUiStore'
import { seasonLabels } from '../../../constants/seasons'
import { validateWardrobeRegistrationDraft, type WardrobeRegistrationDraft } from '../utils/wardrobeRegistration'

interface Props {
  candidate: ClassificationCandidate
  draft: WardrobeRegistrationDraft
  selected: boolean
  disabled: boolean
  error?: string
  onChange: (draft: WardrobeRegistrationDraft) => void
  onToggle: () => void
  onEdit: () => void
  onRemove: () => void
}

/** 묶음 등록의 한 벌을 표시한다. 이름은 목록에서 고치고 분류·유사도·상세 속성은 기존 확인 폼에서 수정한다. */
export function WardrobeRegistrationItem({ candidate, draft, selected, disabled, error, onChange, onToggle, onEdit, onRemove }: Props) {
  const validation = validateWardrobeRegistrationDraft(draft)
  return <article aria-label={`${candidate.originalFilename ?? candidate.itemName} 등록 정보`} className="border-b border-line py-5 last:border-b-0">
    <div className="flex items-start gap-3 sm:gap-4">
      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
        <input type="checkbox" checked={selected} disabled={disabled} onChange={onToggle} aria-label={`${draft.name} 저장 선택`} className="size-5 accent-accent" />
      </label>
      <img src={candidate.imageUrl} alt={draft.name} className="size-18 shrink-0 rounded-xl bg-surface object-contain p-1 sm:size-24" />
      <div className="min-w-0 flex-1">
        <label className="grid gap-1 text-xs font-medium text-muted">아이템 이름
          <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} disabled={disabled} maxLength={40} className="h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-2 text-sm font-semibold text-ink focus:border-accent focus:outline-none" />
        </label>
        <p className="mt-2 break-words text-xs leading-5 text-muted">{draft.subcategory || '종류 확인 필요'} · {draft.colorName || '색상 확인 필요'}</p>
        <p className="mt-1 text-xs text-muted">{draft.seasons.length ? draft.seasons.map((season) => seasonLabels[season]).join(' · ') : '입을 계절을 골라주세요.'}</p>
      </div>
    </div>
    <div className="mt-2 flex items-center justify-between gap-2 pl-8">
      <button type="button" onClick={onEdit} disabled={disabled} className="inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold"><Pencil size={14} /> 정보 수정 · 비슷한 옷 비교</button>
      <button type="button" onClick={onRemove} disabled={disabled} aria-label={`${draft.name} 등록 제외`} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface"><Trash2 size={16} /></button>
    </div>
    {error ? <p role="alert" className="mt-2 pl-8 text-sm text-danger">{error}</p> : validation && <p className="mt-1 pl-8 text-xs text-muted">{validation}</p>}
  </article>
}
