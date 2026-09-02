import { useEffect } from 'react'
import type { Season, WardrobeItem } from '@closet/types'
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
  getOutfitStyleLabel,
  type OutfitStyle,
} from '../../../../constants/styleOptions'
import { seasonLabels } from '../../../../constants/seasons'
import { ClosetItemVisual } from '../../../closet/components/ClosetItemVisual'
import { formatRecommendationHeadline } from '../../utils/todayOutfitRecommendation'

interface RecommendationExplanationDialogProps {
  headline: string
  summary: string
  reasons: string[]
  season: Season
  style: OutfitStyle
  items: WardrobeItem[]
  closeLabel?: string
  backLabel?: string
  onClose: () => void
  onOpenDetails: () => void
}

export function RecommendationExplanationDialog({
  headline,
  summary,
  reasons,
  season,
  style,
  items,
  closeLabel = '추천 설명 닫기',
  backLabel,
  onClose,
  onOpenDetails,
}: RecommendationExplanationDialogProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onClose])

  return createPortal(
    <div
      className="option-picker-backdrop fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="option-picker-enter flex max-h-[82dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-explanation-title"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
          {backLabel && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-canvas"
              aria-label={backLabel}
              autoFocus
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sage">
            <Sparkles size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="recommendation-explanation-title"
              className="text-base font-black"
            >
              이 조합을 추천한 이유
            </h2>
            <p className="mt-1 text-xs text-muted">
              실루엣과 아이템 조합을 기준으로 설명해요.
            </p>
          </div>
          {!backLabel && (
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-canvas"
              aria-label={closeLabel}
              autoFocus
            >
              <X size={18} />
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1.5 text-[11px] font-black text-accent">
            <Sparkles size={12} /> {seasonLabels[season]} ·{' '}
            {getOutfitStyleLabel(style)}
          </span>
          <h3 className="mt-3 text-lg leading-7 font-black tracking-[-0.025em]">
            {formatRecommendationHeadline(headline)}
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted">{summary}</p>

          {reasons.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs font-black">조합 포인트</p>
              <ul className="mt-3 space-y-2.5">
                {reasons.map((reason, index) => (
                  <li
                    className="flex items-start gap-2 text-xs leading-5 text-muted"
                    key={`${reason}-${index}`}
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-line bg-canvas/45 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4">
          <button
            type="button"
            onClick={onOpenDetails}
            className="flex w-full items-center gap-3 rounded-2xl bg-ink p-2.5 text-left text-white transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            <span className="grid size-12 shrink-0 grid-cols-2 gap-0.5 rounded-xl bg-white/12 p-1">
              {items.slice(0, 4).map((item) => (
                <span
                  className="flex min-h-0 items-center justify-center overflow-hidden rounded bg-white/90"
                  key={item.id}
                >
                  <ClosetItemVisual item={item} compact />
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm">코디 구성 보기</strong>
              <span className="mt-0.5 block truncate text-[10px] text-white/70">
                아이템을 바꾸거나 오늘 일정에 담을 수 있어요.
              </span>
            </span>
            <ChevronRight className="shrink-0" size={18} />
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
