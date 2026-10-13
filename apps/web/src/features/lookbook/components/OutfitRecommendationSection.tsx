import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  OutfitMatchRelation,
  OutfitRecommendation,
  OutfitRecommendationColor,
  WardrobeItem,
} from '@closet/types'
import { ChevronLeft, RefreshCw, Shirt, Sparkles } from 'lucide-react'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { useOutfitRecommendationQuery } from '../api/lookbookQueries'
import { OutfitRecommendationChoice } from './OutfitRecommendationChoice'
import { OutfitRecommendationLoading } from './OutfitRecommendationLoading'
import {
  matchesOutfitSelectionCategory,
  outfitSelectionLabels,
  type OutfitSelectionCategory,
} from '../utils/outfitSelection'

type RecommendationMode = 'items' | 'colors'

interface MatchCandidatePreview {
  item: WardrobeItem
  relation: OutfitMatchRelation
  label: string
  reason: string
}

interface OutfitStyleSuggestionProps {
  /** 현재 Look에 더할 옷 종류. 가방과 첫 아이템 단계에서는 부모가 버튼을 렌더링하지 않는다. */
  category: OutfitSelectionCategory
  /** 추천 요청에 전달하는 현재 Look의 아이템 ID 목록. */
  selectedItemIds: string[]
  /** 이 종류에서 아직 선택하지 않은 보유 옷이 있는지 여부. 없으면 옷 추천 선택을 비활성화한다. */
  hasClosetCandidates: boolean
  /** 후보 상세에서 추가를 누르면 부모의 composer 세션에 해당 옷을 전달한다. */
  onAddItem: (item: WardrobeItem) => void
  /** 추천 색을 고르면 현재 종류의 옷장 목록에 색상 필터를 적용하도록 부모에 전달한다. */
  onColorSelect: (color: Pick<OutfitRecommendationColor, 'name' | 'hex'>) => void
}

const relationLabels: Record<OutfitMatchRelation, string> = {
  'clean-contrast': '깔끔한 대비',
  'tone-on-tone': '톤온톤',
  'soft-balance': '부드러운 조합',
  accent: '포인트 조합',
  'design-balance': '디자인 균형',
}

const colorRoleLabels = {
  safe: '무난하게',
  harmony: '자연스럽게',
  accent: '포인트로',
} as const

/** 조회 결과를 탭별로 보여준다. 옷 후보를 누르면 상세를 열도록 값을 전달한다. */
function RecommendationResults({
  category,
  mode,
  isLoading,
  isError,
  recommendation,
  onRetry,
  onCandidateSelect,
  onColorSelect,
}: {
  category: OutfitSelectionCategory
  mode: RecommendationMode
  isLoading: boolean
  isError: boolean
  recommendation?: OutfitRecommendation
  onRetry: () => void
  onCandidateSelect: (candidate: MatchCandidatePreview) => void
  onColorSelect: (color: Pick<OutfitRecommendationColor, 'name' | 'hex'>) => void
}) {
  const categoryLabel = outfitSelectionLabels[category]
  const candidates = (recommendation?.candidates ?? []).filter((candidate) =>
    matchesOutfitSelectionCategory(candidate.item, category),
  )
  const recommendedColors = recommendation?.recommendedColors ?? []

  if (isError) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl bg-surface px-4 text-center">
        <strong className="text-sm font-black">추천을 불러오지 못했어요</strong>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-xs font-bold text-white"
        >
          <RefreshCw size={15} aria-hidden="true" /> 다시 추천받기
        </button>
      </div>
    )
  }

  if (isLoading || !recommendation) {
    return <OutfitRecommendationLoading category={category} mode={mode} />
  }

  if (mode === 'colors') {
    return recommendedColors.length > 0 ? (
      <div className="space-y-3">
        {recommendedColors.slice(0, 3).map((color) => (
          <button
            type="button"
            onClick={() => onColorSelect(color)}
            className="flex w-full items-start gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-accent/50 focus-visible:outline-accent"
            aria-label={`${color.name} 색상의 ${categoryLabel} 아이템 옷장에서 보기`}
            key={color.name}
          >
            <span
              className="mt-0.5 size-9 shrink-0 rounded-full border border-black/10 shadow-sm"
              style={{ backgroundColor: color.hex }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <span className="text-[10px] font-black tracking-[0.08em] text-accent">
                {colorRoleLabels[color.role]}
              </span>
              <h3 className="mt-0.5 text-sm font-black">{color.name}</h3>
              <p className="mt-1 text-xs leading-5 text-muted">{color.reason}</p>
              <span className="mt-2 block text-[11px] font-bold text-accent">내 옷장에서 보기 →</span>
            </div>
          </button>
        ))}
      </div>
    ) : (
      <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-sm font-bold">
        추천할 컬러 조합을 찾지 못했어요.
      </div>
    )
  }

  return candidates.length > 0 ? (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {candidates.map((candidate) => (
        <button
          type="button"
          onClick={() => onCandidateSelect({
            item: candidate.item,
            relation: candidate.relation,
            label: relationLabels[candidate.relation],
            reason: candidate.reason,
          })}
          className="min-w-0 rounded-2xl border border-line bg-surface p-2 text-left transition hover:border-accent/50"
          key={candidate.item.id}
        >
          <span className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-canvas">
            <ClosetItemVisual item={candidate.item} compact />
          </span>
          <span className="mt-2 flex items-center gap-1 px-1 text-[10px] font-bold text-accent">
            {candidate.relation === 'design-balance' ? (
              <Shirt size={11} aria-hidden="true" />
            ) : (
              <span
                className="size-2 rounded-full border border-black/10"
                style={{ backgroundColor: candidate.item.colorHex }}
                aria-hidden="true"
              />
            )}
            {relationLabels[candidate.relation]}
          </span>
          <strong className="mt-1 block truncate px-1 text-xs">{candidate.item.name}</strong>
          <span className="mt-0.5 block px-1 pb-1 text-[10px] leading-4 text-muted">
            {candidate.reason}
          </span>
        </button>
      ))}
    </div>
  ) : (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center">
      <strong className="text-sm font-black">추천할 수 있는 {categoryLabel} 아이템이 없어요</strong>
      <p className="mt-2 text-xs leading-5 text-muted">옷장 목록에서 직접 골라보세요.</p>
    </div>
  )
}

/** 추천 결과의 후보를 현재 옷장 시트 안에서 자세히 보여주고, 추가 버튼은 부모의 선택 동작을 실행한다. */
function RecommendationCandidateDetail({
  candidate,
  onClose,
  onConfirm,
}: {
  candidate: MatchCandidatePreview
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <section
      className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-surface text-ink"
      role="dialog"
      aria-labelledby="recommendation-item-title"
      aria-modal="false"
    >
      <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-line px-4">
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full hover:bg-canvas"
          aria-label="추천 목록으로 돌아가기"
          autoFocus
        >
          <ChevronLeft size={21} aria-hidden="true" />
        </button>
        <span className="text-[10px] font-black tracking-[0.12em] text-accent">STYLE ASSIST</span>
        <span className="size-11" aria-hidden="true" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="mt-4 flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-canvas sm:h-52">
          <ClosetItemVisual item={candidate.item} />
        </div>
        <div className="pt-4">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-accent">
            {candidate.relation === 'design-balance' ? (
              <Shirt size={13} aria-hidden="true" />
            ) : (
              <span
                className="size-3 rounded-full border border-black/10"
                style={{ backgroundColor: candidate.item.colorHex }}
                aria-hidden="true"
              />
            )}
            {candidate.label}
          </span>
          <h2 id="recommendation-item-title" className="mt-1 text-lg font-black">
            {candidate.item.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{candidate.reason}</p>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-[0.8fr_1.2fr] gap-2 border-t border-line bg-surface px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl border border-line bg-canvas px-4 text-sm font-bold"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-white"
        >
          코디에 추가
        </button>
      </div>
    </section>
  )
}

/**
 * 옷장 헤더에서 추천 방식을 고르고 결과와 후보 상세를 같은 하단 시트 안에 표시한다.
 * 추천 조회는 선택한 탭의 작업만 실행하며, 옷 후보를 추가하면 부모의 composer 선택 동작을 호출한다.
 * 취소하면 덮개 아래의 옷장 목록을 유지하고, 추천 색을 누르면 부모가 해당 색 필터로 목록을 다시 연다.
 */
export function OutfitStyleSuggestion({
  category,
  selectedItemIds,
  hasClosetCandidates,
  onAddItem,
  onColorSelect,
}: OutfitStyleSuggestionProps) {
  const [isChoiceOpen, setIsChoiceOpen] = useState(false)
  const [mode, setMode] = useState<RecommendationMode | null>(null)
  const [wardrobeContainer, setWardrobeContainer] = useState<HTMLElement | null>(null)
  const [selectedCandidate, setSelectedCandidate] =
    useState<MatchCandidatePreview | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const candidateTriggerRef = useRef<HTMLElement | null>(null)
  const recommendationQuery = useOutfitRecommendationQuery(
    selectedItemIds,
    category === 'bag' ? null : category,
    mode,
  )
  const categoryLabel = outfitSelectionLabels[category]
  const isRecommendationPending = !recommendationQuery.isError &&
    (recommendationQuery.isLoading || !recommendationQuery.data)

  /** 추천 화면을 닫는다. 취소 시에만 계속 남는 옷장 헤더 버튼으로 초점을 되돌린다. */
  const closeSuggestion = useCallback((restoreFocus = true) => {
    setSelectedCandidate(null)
    setMode(null)
    setIsChoiceOpen(false)
    setWardrobeContainer(null)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  /** 현재 옷장 시트를 덮을 위치를 저장하고, 추천 조회 전 두 가지 도움 중 하나를 고르게 한다. */
  const openSuggestion = () => {
    const container = triggerRef.current?.closest<HTMLElement>('.outfit-styling-layout__wardrobe')
    if (!container) return
    setWardrobeContainer(container)
    setSelectedCandidate(null)
    setIsChoiceOpen(true)
  }

  /** 선택한 모드로 같은 시트 안의 추천 결과를 열며, 이때 조회를 활성화한다. */
  const chooseMode = (nextMode: RecommendationMode) => {
    setMode(nextMode)
    setIsChoiceOpen(false)
  }

  /** 후보 상세만 닫고 이전에 누른 추천 카드로 초점을 되돌린다. */
  const closeCandidateDetail = useCallback(() => {
    setSelectedCandidate(null)
    window.requestAnimationFrame(() => candidateTriggerRef.current?.focus())
  }, [])

  /** 추천 카드를 누르면 현재 포커스를 기억하고 옷장 시트 안에 상세를 연다. */
  const openCandidateDetail = (candidate: MatchCandidatePreview) => {
    candidateTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setSelectedCandidate(candidate)
  }

  /** 후보 추가 후 추천 시트를 닫고 선택한 옷을 composer 세션에 전달한다. */
  const confirmCandidate = () => {
    if (!selectedCandidate) return
    const item = selectedCandidate.item
    closeSuggestion(false)
    onAddItem(item)
  }

  /** 색상 결과를 누르면 추천 덮개를 닫고 해당 색으로 현재 옷장 목록을 좁힌다. */
  const selectRecommendedColor = (color: Pick<OutfitRecommendationColor, 'name' | 'hex'>) => {
    closeSuggestion(false)
    onColorSelect(color)
  }

  useEffect(() => {
    if (!isChoiceOpen && !mode) return
    // 부모 composer의 Escape 뒤로가기를 막고 현재 시트에서 가장 위에 열린 화면만 닫는다.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (selectedCandidate) {
        closeCandidateDetail()
      } else {
        closeSuggestion()
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [closeCandidateDetail, closeSuggestion, isChoiceOpen, mode, selectedCandidate])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openSuggestion}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-accent/35 bg-sage/50 px-3 text-[11px] font-black text-accent transition hover:bg-sage"
      >
        <Sparkles size={14} aria-hidden="true" /> 스타일 제안
      </button>

      {wardrobeContainer && isChoiceOpen && createPortal(
        <OutfitRecommendationChoice
          categoryLabel={categoryLabel}
          hasClosetCandidates={hasClosetCandidates}
          onClose={() => closeSuggestion()}
          onChooseMode={chooseMode}
        />,
        wardrobeContainer,
      )}

      {wardrobeContainer && mode && createPortal(
        <section
          className="absolute -top-px right-0 bottom-0 left-0 z-20 flex min-h-0 flex-col overflow-hidden bg-canvas text-ink"
          role="region"
          aria-label="스타일 추천"
        >
          <div className="flex min-h-0 flex-1 flex-col" inert={Boolean(selectedCandidate)} aria-hidden={Boolean(selectedCandidate)}>
            <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
              <button
                type="button"
                onClick={() => closeSuggestion()}
                className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-canvas"
                aria-label="옷장으로 돌아가기"
                autoFocus
              >
                <ChevronLeft size={21} aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <span className="block text-[9px] font-black tracking-[0.12em] text-accent">STYLE ASSIST</span>
                <h2 className="truncate text-sm font-black">{categoryLabel} 스타일 제안</h2>
              </div>
            </header>

            <div className="shrink-0 border-b border-line bg-surface px-4 py-3">
              <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="스타일 제안 종류">
                <button
                  id="style-suggestion-items-tab"
                  type="button"
                  role="tab"
                  aria-selected={mode === 'items'}
                  aria-controls="style-suggestion-panel"
                  disabled={!hasClosetCandidates}
                  onClick={() => setMode('items')}
                  className={`min-h-11 rounded-xl border px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                    mode === 'items'
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-canvas text-ink'
                  }`}
                >
                  내 옷장에서 찾기
                </button>
                <button
                  id="style-suggestion-colors-tab"
                  type="button"
                  role="tab"
                  aria-selected={mode === 'colors'}
                  aria-controls="style-suggestion-panel"
                  onClick={() => setMode('colors')}
                  className={`min-h-11 rounded-xl border px-3 text-xs font-bold transition ${
                    mode === 'colors'
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-canvas text-ink'
                  }`}
                >
                  어울리는 컬러 찾기
                </button>
              </div>
              {!hasClosetCandidates && (
                <p className="mt-2 text-[11px] leading-4 text-muted">
                  더 고를 {categoryLabel} 아이템이 없어 옷장에서 찾을 수 없어요.
                </p>
              )}
              {mode === 'colors' && (
                <p className="mt-2 text-[11px] leading-4 text-muted">
                  마음에 드는 색을 누르면 현재 종류의 옷장에서 해당 색 아이템을 볼 수 있어요.
                </p>
              )}
            </div>

            <div
              id="style-suggestion-panel"
              role="tabpanel"
              aria-labelledby={mode === 'items' ? 'style-suggestion-items-tab' : 'style-suggestion-colors-tab'}
              aria-live="polite"
              className={`scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] ${
                isRecommendationPending ? 'flex flex-col' : ''
              }`}
            >
              <RecommendationResults
                category={category}
                mode={mode}
                isLoading={recommendationQuery.isLoading}
                isError={recommendationQuery.isError}
                recommendation={recommendationQuery.data}
                onRetry={() => void recommendationQuery.refetch()}
                onCandidateSelect={openCandidateDetail}
                onColorSelect={selectRecommendedColor}
              />
            </div>
          </div>

          {selectedCandidate && (
            <RecommendationCandidateDetail
              candidate={selectedCandidate}
              onClose={closeCandidateDetail}
              onConfirm={confirmCandidate}
            />
          )}
        </section>,
        wardrobeContainer,
      )}
    </>
  )
}
