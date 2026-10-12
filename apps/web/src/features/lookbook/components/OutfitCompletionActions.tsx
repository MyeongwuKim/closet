import { ArrowRight, Sparkles } from 'lucide-react'

interface OutfitCompletionActionsProps {
  /** 동일한 옷 조합이 이미 저장된 경우 표시할 안내. 이때 새 Look 확인 버튼은 숨긴다. */
  duplicateMessage: string | null
  /** 기존 AI 이미지가 있으면 보기, 없으면 이미지 만들기 문구를 표시한다. */
  hasAvailableLookbook: boolean
  /** AI 룩 이미지를 열거나 생성하도록 부모에 요청한다. */
  onOpenLookbook: () => void
  /** 조합 확인과 이름·스타일·계절 입력 단계로 이동하도록 부모에 요청한다. */
  onComplete: () => void
}

/** 선택한 옷의 조합을 확인 단계로 보내고, 선택 사항인 AI 룩 이미지 동작을 별도 버튼으로 표시한다. */
export function OutfitCompletionActions({
  duplicateMessage,
  hasAvailableLookbook,
  onOpenLookbook,
  onComplete,
}: OutfitCompletionActionsProps) {
  return (
    <div className="grid gap-2.5">
      {duplicateMessage && (
        <p className="rounded-xl border border-line bg-canvas px-4 py-2.5 text-center text-[11px] font-medium text-muted">
          {duplicateMessage}
        </p>
      )}
      <div
        className={
          duplicateMessage
            ? 'grid'
            : 'grid grid-cols-[0.88fr_1.12fr] gap-2'
        }
      >
        <button
          type="button"
          onClick={onOpenLookbook}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2 text-xs font-semibold text-ink transition-colors hover:border-accent/40 hover:bg-canvas"
        >
          <Sparkles size={16} strokeWidth={1.7} aria-hidden="true" />
          {hasAvailableLookbook ? 'AI 룩 보기' : 'AI 룩 만들기'}
        </button>
        {!duplicateMessage && (
          <button
            type="button"
            onClick={onComplete}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-white transition-colors hover:bg-ink"
          >
            Look 확인하기
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
