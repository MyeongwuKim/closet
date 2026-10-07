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
  style: OutfitStyle | null
  items: WardrobeItem[]
  closeLabel?: string
  backLabel?: string
  onClose: () => void
  onOpenDetails: () => void
}

/** 추천 결과·기록에서 연 설명을 공통 높이의 하단 시트에 표시한다. 긴 설명만 내부에서 스크롤하며 구성 편집 버튼과 돌아가기 동작은 유지한다. */
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
      className="option-picker-backdrop fixed inset-0 z-[120] flex items-end justify-center bg-ink/20"
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="ai-recommendation-sheet flex w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] border border-line border-b-0 bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-explanation-title"
      >
        <span className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line" aria-hidden="true" />
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1.5 text-[11px] font-black text-accent">
            <Sparkles size={12} /> {seasonLabels[season]} ·{' '}
            {style ? getOutfitStyleLabel(style) : '옷장 추천'}
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

        <footer className="shrink-0 border-t border-line bg-canvas/45 p-3">
          <button
            type="button"
            onClick={onOpenDetails}
            className="flex w-full items-center gap-3 rounded-2xl bg-ink p-2.5 text-left text-white transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            <span className="grid size-12 shrink-0 grid-cols-2 grid-rows-2 gap-0.5 rounded-xl bg-white/12 p-1">
              {items.slice(0, 4).map((item) => (
                <span
                  className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded bg-white/90"
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
