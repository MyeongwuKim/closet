import { ArrowRight, Sparkles } from 'lucide-react'

interface OutfitCompletionActionsProps {
  /** 조합이 아직 완성되지 않았을 때 버튼 위에 보여줄 안내. 이때 두 진행 버튼을 비활성화한다. */
  completionMessage: string | null
  /** 비어 있는 Look에서는 슬롯을 눌러 옷장을 여는 방법을 안내한다. */
  isEmpty: boolean
  /** 동일한 옷 조합이 이미 저장된 경우 표시할 안내. 이때 새 Look 확인 버튼은 숨긴다. */
  duplicateMessage: string | null
  /** 기존 AI 이미지가 있으면 보기, 없으면 이미지 만들기 문구를 표시한다. */
  hasAvailableLookbook: boolean
  /** AI 룩 이미지를 열거나 생성하도록 부모에 요청한다. */
  onOpenLookbook: () => void
  /** 조합 확인과 이름·스타일·계절 입력 단계로 이동하도록 부모에 요청한다. */
  onComplete: () => void
}

/** 코디 편집 화면 하단에 AI 룩과 Look 확인 버튼을 표시한다. 조합이 미완성이면 이유를 안내하고 두 버튼을 비활성화한다. */
export function OutfitCompletionActions({
  completionMessage,
  isEmpty,
  duplicateMessage,
  hasAvailableLookbook,
  onOpenLookbook,
  onComplete,
}: OutfitCompletionActionsProps) {
  return (
    <div className="grid gap-2.5">
      {completionMessage && (
        <p className="text-center text-[11px] font-medium text-muted" aria-live="polite">
          {isEmpty ? '룩 박스의 +를 눌러 옷장에서 아이템을 골라주세요.' : completionMessage}
        </p>
      )}
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
          disabled={Boolean(completionMessage)}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2 text-xs font-semibold text-ink transition-colors hover:border-accent/40 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-65"
        >
          <Sparkles size={16} strokeWidth={1.7} aria-hidden="true" />
          {hasAvailableLookbook ? 'AI 룩 보기' : 'AI 룩 만들기'}
        </button>
        {!duplicateMessage && (
          <button
            type="button"
            onClick={onComplete}
            disabled={Boolean(completionMessage)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          >
            Look 확인하기
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
