import { useEffect } from 'react'
import { History, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import {
  getOutfitStyleLabel,
  type OutfitStyle,
} from '../../../../constants/styleOptions'
import { seasonLabels } from '../../../../constants/seasons'
import { ClosetItemVisual } from '../../../closet/components/ClosetItemVisual'
import type { TodayRecommendationHistoryEntry } from '../../api/todayOutfitQueries'

interface RecommendationHistorySheetProps {
  entries: TodayRecommendationHistoryEntry[]
  onSelect: (entry: TodayRecommendationHistoryEntry) => void
  onClose: () => void
}

function formatStoredAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '저장된 추천'

  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function RecommendationHistorySheet({
  entries,
  onSelect,
  onClose,
}: RecommendationHistorySheetProps) {
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
      className="option-picker-backdrop fixed inset-0 z-[120] flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="option-picker-enter flex max-h-[84dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-history-title"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sage">
            <History size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="recommendation-history-title" className="text-base font-black">
              추천 기록
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              최근 추천 10개를 보관해요. 카드를 누르면 코디를 편집하고
              일정에 추가할 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-canvas"
            aria-label="추천 기록 닫기"
            autoFocus
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-canvas px-5 py-10 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-sage">
                <History size={19} />
              </span>
              <p className="mt-3 text-sm font-black">아직 추천 기록이 없어요</p>
              <p className="mt-1 text-xs leading-5 text-muted">
                코디를 추천받으면 최근 10개까지 여기에 보관해요.
              </p>
            </div>
          ) : (
            entries.map((entry) => {
              const recommendation = entry.recommendation

              return (
                <button
                  type="button"
                  key={`${entry.season}:${entry.style}:${entry.id}`}
                  onClick={() => onSelect(entry)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-2.5 text-left transition hover:border-ink"
                  aria-label={`${recommendation.headline} 코디 상세 열기`}
                >
                  <span className="grid size-20 shrink-0 grid-cols-2 gap-1 rounded-xl bg-canvas p-1.5">
                    {recommendation.items.slice(0, 4).map((item) => (
                      <span
                        className="flex min-h-0 items-center justify-center overflow-hidden rounded-lg bg-surface"
                        key={item.id}
                      >
                        <ClosetItemVisual item={item} compact />
                      </span>
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted">
                      <span>
                        {seasonLabels[recommendation.season]} ·{' '}
                        {getOutfitStyleLabel(
                          recommendation.style as OutfitStyle,
                        )}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{formatStoredAt(entry.createdAt)}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm leading-5 font-black">
                      {recommendation.headline}
                    </span>
                    <span className="mt-1 line-clamp-1 block text-[11px] text-muted">
                      {recommendation.items.map((item) => item.name).join(', ')}
                    </span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
