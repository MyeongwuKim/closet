import { AiCreditActionButton } from './AiCreditActionButton'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

interface OutfitCompletionActionsProps {
  /** 조합이 아직 완성되지 않았을 때 버튼 위에 보여줄 안내. 이때 두 진행 버튼을 비활성화한다. */
  completionMessage: string | null
  /** 비어 있는 Look에서는 슬롯을 눌러 옷장을 여는 방법을 안내한다. */
  isEmpty: boolean
  /** 동일한 옷 조합이 이미 저장된 경우 표시할 안내와 상세로 이동할 경로다. */
  duplicateMessage: string | null
  existingOutfitPath?: string
  /** 기존 AI 이미지가 있으면 보기, 없으면 이미지 만들기 문구를 표시한다. */
  hasAvailableLookbook: boolean
  /** 생성과 이전 이미지 조회를 구분해 진행 문구를 표시하고 새 생성 버튼을 막는다. */
  isPreviewPending?: boolean
  isRestoringPreview?: boolean
  /** 복원할 작업이 있으면 이미 접수한 결과를 열기 전에 사용권을 다시 요구하지 않는다. */
  canResumePreview?: boolean
  /** AI 룩 이미지를 열거나 생성하도록 부모에 요청한다. */
  onOpenLookbook: () => void
  /** 조합 확인과 이름·스타일·계절 입력 단계로 이동하도록 부모에 요청한다. */
  onComplete: () => void
}

/** 코디 편집 하단에서 일반 저장과 AI 이미지 생성을 나누고, 중복 조합은 기존 코디를 열 수 있게 한다. */
export function OutfitCompletionActions({
  completionMessage,
  isEmpty,
  duplicateMessage,
  existingOutfitPath,
  hasAvailableLookbook,
  isPreviewPending = false,
  isRestoringPreview = false,
  canResumePreview = false,
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
      <div className="grid grid-cols-2 gap-2">
        <AiCreditActionButton
          requiresCredit={!hasAvailableLookbook && !canResumePreview}
          label={hasAvailableLookbook ? 'AI 룩 보기' : isPreviewPending ? 'AI 이미지 만드는 중…' : isRestoringPreview ? '기존 이미지 확인 중…' : 'AI 착장 이미지 만들기'}
          adLabel="광고 보고 AI 이미지 만들기"
          onClick={onOpenLookbook}
          disabled={Boolean(completionMessage) || (!hasAvailableLookbook && (isPreviewPending || isRestoringPreview))}
          className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-2 text-xs font-semibold text-ink transition-colors hover:border-accent/40 hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-65"
        >
          <Sparkles size={16} strokeWidth={1.7} aria-hidden="true" />
        </AiCreditActionButton>
        {existingOutfitPath ? (
          <Link
            to={existingOutfitPath}
            replace
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-white transition-colors hover:bg-ink"
          >
            기존 코디 열기
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onComplete}
            disabled={Boolean(completionMessage)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          >
            코디 저장하기
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
