import { ChevronLeft, Pencil, Thermometer, Trash2 } from 'lucide-react'
import type { OutfitWearSummary } from '../utils/outfitWearSummary'

interface Props {
  name: string
  description: string
  isEditing: boolean
  isSaving: boolean
  backLabel: string
  wearSummary?: OutfitWearSummary
  onBack: () => void
  onEditInfo: () => void
  onDelete: () => void
}

/** 보기에서는 뒤로 가기와 삭제를, 편집에서는 제목과 정보 수정 버튼을 표시한다. */
export function OutfitDetailHeader({ name, description, isEditing, isSaving, backLabel, wearSummary, onBack, onEditInfo, onDelete }: Props) {
  return <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
    <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
      {!isEditing && (
        <button type="button" onClick={onBack} disabled={isSaving} className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface disabled:opacity-40" aria-label={backLabel} autoFocus>
          <ChevronLeft size={25} strokeWidth={2.2} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-tight">{isEditing ? '코디 편집' : name}</h1>
        <p className="mt-0.5 truncate text-xs text-muted">{isEditing ? `${name} · ${description}` : description}</p>
        {wearSummary?.temperatureLabel && <p className="mt-1 flex items-center gap-1 text-xs text-muted" title={wearSummary.temperatureTitle}><Thermometer size={12} aria-hidden="true" />{wearSummary.temperatureLabel}</p>}
      </div>
      {isEditing ? <button type="button" onClick={onEditInfo} disabled={isSaving} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface disabled:opacity-40" aria-label="코디 이름과 스타일 수정" title="코디 이름과 스타일 수정"><Pencil size={17} /></button>
        : <button type="button" onClick={onDelete} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-danger-soft hover:text-accent" aria-label="코디북에서 삭제" title="코디북에서 삭제"><Trash2 size={17} /></button>}
    </div>
  </header>
}
