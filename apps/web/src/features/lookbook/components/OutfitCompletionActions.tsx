import { Sparkles } from 'lucide-react'

interface OutfitCompletionActionsProps {
  duplicateMessage: string | null
  hasAvailableLookbook: boolean
  onOpenLookbook: () => void
  onComplete: () => void
}

export function OutfitCompletionActions({
  duplicateMessage,
  hasAvailableLookbook,
  onOpenLookbook,
  onComplete,
}: OutfitCompletionActionsProps) {
  return (
    <div className="grid gap-2">
      {duplicateMessage && (
        <p className="rounded-xl bg-canvas px-4 py-2.5 text-center text-[11px] font-bold text-muted">
          {duplicateMessage}
        </p>
      )}
      <div
        className={
          duplicateMessage
            ? 'grid'
            : 'grid grid-cols-[0.95fr_1.05fr] gap-2'
        }
      >
        <button
          type="button"
          onClick={onOpenLookbook}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold text-ink"
        >
          <Sparkles size={15} />
          {hasAvailableLookbook ? 'AI 룩북 보기' : 'AI 룩 미리보기'}
        </button>
        {!duplicateMessage && (
          <button
            type="button"
            onClick={onComplete}
            className="rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white"
          >
            이대로 완성
          </button>
        )}
      </div>
    </div>
  )
}
