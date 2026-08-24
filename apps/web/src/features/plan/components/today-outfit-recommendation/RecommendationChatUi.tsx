import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

export function RecommendationAssistantMessage({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="ai-recommendation-chat-enter flex items-start gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sage text-ink">
        <Sparkles size={15} />
      </span>
      <div className="max-w-[84%] rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-3 text-xs leading-5 shadow-[0_4px_14px_rgba(27,27,24,0.04)]">
        {children}
      </div>
    </div>
  )
}

interface RecommendationQuickReplyProps {
  children: ReactNode
  onClick: () => void
  secondary?: boolean
  delayMs?: number
}

export function RecommendationQuickReply({
  children,
  onClick,
  secondary,
  delayMs = 0,
}: RecommendationQuickReplyProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delayMs}ms` }}
      className={`ai-recommendation-chat-enter rounded-full border px-3.5 py-2 text-xs font-bold transition ${
        secondary
          ? 'border-transparent bg-canvas text-muted hover:text-ink'
          : 'border-line bg-surface text-ink hover:border-ink'
      }`}
    >
      {children}
    </button>
  )
}
