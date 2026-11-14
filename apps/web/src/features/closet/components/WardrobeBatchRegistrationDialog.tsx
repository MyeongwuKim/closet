import { useEffect, useRef, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { WardrobeItem } from '@closet/types'
import { ClassificationConfirmModal } from '../../../components/ClassificationConfirmModal'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { SeasonMultiSelect } from '../../../components/SeasonMultiSelect'
import { useUiStore, type ClassificationCandidate } from '../../../stores/useUiStore'
import { useWardrobeImageAnalysis } from '../hooks/useWardrobeImageAnalysis'
import { useWardrobeRegistration } from '../hooks/useWardrobeRegistration'
import type { WardrobeComparisonCatalog } from './SimilarWardrobeItems'
import { WardrobeRegistrationItem } from './WardrobeRegistrationItem'
import { trapDialogFocus } from '../../../lib/dialogFocus'

interface Props {
  candidates: ClassificationCandidate[]
  wardrobeItems: WardrobeItem[]
  wardrobeComparison: WardrobeComparisonCatalog
}

/** 여러 사진의 확인을 한 목록으로 묶고, 상세 편집은 기존 분석 확인 폼에 맡긴다. */
export function WardrobeBatchRegistrationDialog({ candidates, wardrobeItems, wardrobeComparison }: Props) {
  const registration = useWardrobeRegistration(candidates)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const analyzingCount = useWardrobeImageAnalysis((state) => state.analyzingCount)
  const editing = registration.rows.find((row) => row.candidate.itemId === editingId)
  const closeRef = useRef(() => {})
  const dialog = useRef<HTMLElement>(null)
  const confirmation = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!confirmClose) return
    const previous = document.activeElement as HTMLElement | null
    confirmation.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [confirmClose])
  useEffect(() => { closeRef.current = () => { if (!registration.saving && !editing) setConfirmClose((value) => !value) } })
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus() }
  }, [])
  return <>
    <section ref={dialog} role="dialog" aria-modal="true" aria-label="옷 여러 벌 등록" aria-hidden={Boolean(editing || confirmClose)} inert={Boolean(editing || confirmClose)}
      onKeyDown={(event) => trapDialogFocus(event, dialog.current)}
      className="fixed inset-0 z-[80] flex h-dvh flex-col bg-canvas">
      <header className="shrink-0 border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-3 px-4">
          <button type="button" aria-label="옷 추가 취소" disabled={registration.saving} onClick={() => setConfirmClose(true)} className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface disabled:opacity-40"><ChevronLeft size={22} /></button>
          <div className="min-w-0"><h2 className="text-lg font-semibold">옷 여러 벌 등록</h2><p className="mt-0.5 text-xs text-muted">분석 결과를 확인하고 필요한 옷을 골라주세요.</p></div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
          <fieldset disabled={registration.saving} className="border-b border-line pb-5">
            <legend className="mb-3 text-sm font-semibold">선택한 옷의 계절</legend>
            <SeasonMultiSelect value={registration.commonSeasons} onChange={registration.actions.applySeasons} />
            <p className="mt-2 text-xs leading-5 text-muted">선택한 옷에 같은 계절을 한 번에 적용해요. 옷마다 다르면 정보 수정에서 바꿔주세요.</p>
          </fieldset>
          {analyzingCount > 0 && <p role="status" className="mt-4 text-xs text-muted">남은 사진 {analyzingCount}장을 분석하고 있어요. 준비된 옷부터 확인할 수 있어요.</p>}
          {registration.rows.map((row) => <WardrobeRegistrationItem key={row.candidate.itemId} {...row} disabled={registration.saving}
            onChange={(draft) => registration.actions.edit(row.candidate.itemId, draft)}
            onToggle={() => registration.actions.toggle(row.candidate.itemId)} onEdit={() => setEditingId(row.candidate.itemId)}
            onRemove={() => useUiStore.getState().cancelClassification(row.candidate.itemId)} />)}
        </div>
      </div>
      <footer className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl">
          <p role="status" className="mb-2 text-xs text-muted">{registration.saving ? `${registration.progress.total}벌 중 ${registration.progress.done}벌 처리했어요. 저장 중에는 창을 유지해주세요.` : `전체 ${registration.rows.length}벌 중 ${registration.selectedCount}벌 선택`}</p>
          <button type="button" onClick={() => void registration.actions.save()} disabled={registration.saving || !registration.canSave} className="min-h-12 w-full rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40">{registration.saving ? '옷장에 넣는 중…' : `선택한 ${registration.selectedCount}벌 저장`}</button>
        </div>
      </footer>
    </section>
    {editing && <ClassificationConfirmModal key={editing.candidate.itemId} candidate={editing.candidate} initialDraft={editing.draft}
      wardrobeItems={wardrobeItems} wardrobeComparison={wardrobeComparison} onDismiss={() => setEditingId(null)}
      onConfirm={async (id, draft) => { registration.actions.edit(id, draft); setEditingId(null) }} />}
    {confirmClose && <div ref={confirmation} onKeyDown={(event) => trapDialogFocus(event, confirmation.current)}><ConfirmDialog title="옷 등록을 그만할까요?" description="저장한 옷은 유지하고, 아직 저장하지 않은 사진과 입력값은 지워요." confirmLabel="미저장 사진 지우기"
      onCancel={() => setConfirmClose(false)} onConfirm={() => useWardrobeImageAnalysis.getState().resetAnalysis()} /></div>}
  </>
}
