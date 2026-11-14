import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PauseCircle, X } from 'lucide-react'
import type { WardrobeItem, WearAvoidanceReason } from '@closet/types'
import { getKoreaDate, isWardrobeRecommendationPaused } from '@closet/types/wardrobe-preferences'
import { useUpdateWardrobeItemMutation } from '../api/wardrobeQueries'
import { trapDialogFocus } from '../../../lib/dialogFocus'

const reasons: Array<{ value: WearAvoidanceReason | null; label: string; detail: string }> = [
  { value: 'hard_to_style', label: '조합이 어려워요', detail: '이 옷을 기준으로 코디를 추천받아요.' },
  { value: 'fit_issue', label: '사이즈가 안 맞아요', detail: '보류를 해제할 때까지 자동 추천에서 제외해요.' },
  { value: 'temporarily_unused', label: '당분간 안 입어요', detail: '선택한 재개 날짜부터 자동 추천에 포함해요.' },
  { value: null, label: '사유 지우기 · 보류 해제', detail: '다시 자동 추천 후보에 포함해요.' },
]

interface SheetProps {
  item: WardrobeItem
  onClose: () => void
  onRecommend?: () => void
}

/** 미착용 사유와 재개일을 함께 저장한다. 조합 문제는 저장 후 기존 추천 입구로 연결하며 AI를 직접 실행하지 않는다. */
export function WardrobeWearPreferenceSheet({ item, onClose, onRecommend }: SheetProps) {
  const [reason, setReason] = useState(item.wearAvoidanceReason ?? null)
  const [resumeOn, setResumeOn] = useState(item.recommendationResumeOn ?? '')
  const [error, setError] = useState('')
  const mutation = useUpdateWardrobeItemMutation()
  const dialog = useRef<HTMLElement>(null)
  const dismissRef = useRef(() => {})
  const today = getKoreaDate()
  const tomorrow = new Date(`${today}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const minDate = tomorrow.toISOString().slice(0, 10)
  useEffect(() => { dismissRef.current = () => { if (!mutation.isPending) onClose() } })
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus() }
  }, [])

  const save = async () => {
    if (mutation.isPending) return
    if (reason === 'temporarily_unused' && (!resumeOn || resumeOn <= today)) {
      setError('내일 이후의 추천 재개 날짜를 골라주세요.')
      return
    }
    try {
      await mutation.mutateAsync({ id: item.id, input: {
        wearAvoidanceReason: reason, recommendationResumeOn: reason === 'temporarily_unused' ? resumeOn : null,
      } })
      onClose()
      if (reason === 'hard_to_style') onRecommend?.()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했어요. 다시 시도해주세요.') }
  }

  return createPortal(
    <div className="fixed inset-0 z-[160] flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) dismissRef.current() }}>
      <section ref={dialog} role="dialog" aria-modal="true" aria-label="안 입는 이유"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-canvas p-5 sm:rounded-2xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') { event.stopPropagation(); dismissRef.current() }
          trapDialogFocus(event, dialog.current)
        }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h2 className="text-lg font-semibold">안 입는 이유</h2><p className="mt-1 break-words text-sm text-muted">{item.name}</p></div>
          <button type="button" onClick={() => dismissRef.current()} disabled={mutation.isPending} aria-label="안 입는 이유 닫기" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface"><X size={20} /></button>
        </div>
        <div className="mt-5 grid gap-2" role="radiogroup" aria-label="안 입는 이유 선택" onKeyDown={(event) => {
          const index = reasons.findIndex((entry) => entry.value === reason)
          let next: number
          if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % reasons.length
          else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + reasons.length - 1) % reasons.length
          else if (event.key === 'Home') next = 0
          else if (event.key === 'End') next = reasons.length - 1
          else return
          event.preventDefault()
          setReason(reasons[next].value)
          setError('')
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
        }}>
          {reasons.map((entry) => <button key={entry.value ?? 'clear'} type="button" role="radio" aria-checked={reason === entry.value} disabled={mutation.isPending}
            tabIndex={reason === entry.value ? 0 : -1}
            onClick={() => { setReason(entry.value); setError('') }}
            className={`min-h-16 rounded-xl border px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-accent ${reason === entry.value ? 'border-accent bg-sage/40' : 'border-line bg-surface'}`}>
            <span className="block text-sm font-semibold">{entry.label}</span><span className="mt-1 block text-xs leading-5 text-muted">{entry.detail}</span>
          </button>)}
        </div>
        {reason === 'temporarily_unused' && <label className="mt-4 grid gap-2 text-sm font-semibold">추천 재개 날짜
          <input type="date" min={minDate} value={resumeOn} disabled={mutation.isPending} onChange={(event) => setResumeOn(event.target.value)} className="h-12 min-w-0 rounded-xl border border-line bg-surface px-3" />
        </label>}
        <p className="mt-4 text-xs leading-5 text-muted">옷장과 직접 만드는 코디에서는 계속 사용할 수 있어요.</p>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        <button type="button" onClick={() => void save()} disabled={mutation.isPending} className="mt-5 min-h-12 w-full rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? '저장 중이에요…' : '이유 저장'}</button>
      </section>
    </div>, document.body,
  )
}

/** 카드·옷 상세에서 현재 사유와 보류 상태를 표시하고 같은 설정 창을 연다. */
export function WardrobeWearPreferenceControl({ item, onRecommend }: Omit<SheetProps, 'onClose'>) {
  const [open, setOpen] = useState(false)
  const paused = isWardrobeRecommendationPaused(item, getKoreaDate())
  return <div className="mt-2">
    <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
      {paused && <PauseCircle size={14} />}
      {paused ? item.wearAvoidanceReason === 'fit_issue' ? '사이즈 문제로 추천 보류 중' : `${item.recommendationResumeOn}부터 추천 재개` : item.wearAvoidanceReason === 'hard_to_style' ? '조합이 어려워요 · 이유 수정' : '안 입는 이유'}
    </button>
    {open && <WardrobeWearPreferenceSheet item={item} onClose={() => setOpen(false)} onRecommend={onRecommend} />}
  </div>
}
