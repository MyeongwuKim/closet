import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type {
  OutfitMatchRelation,
  OutfitRecommendation,
  WardrobeItem,
} from '@closet/types'
import { ChevronLeft, LoaderCircle, Palette, RefreshCw, Shirt, Sparkles, X } from 'lucide-react'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import { useOutfitRecommendationQuery } from '../api/lookbookQueries'
import {
  matchesOutfitSelectionCategory,
  outfitSelectionLabels,
  type OutfitSelectionCategory,
} from '../utils/outfitSelection'

type RecommendationMode = 'items' | 'colors'

interface MatchCandidatePreview {
  item: WardrobeItem
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
}

const relationLabels: Record<OutfitMatchRelation, string> = {
  'clean-contrast': '깔끔한 대비',
  'tone-on-tone': '톤온톤',
  'soft-balance': '부드러운 조합',
  accent: '포인트 조합',
}

const colorRoleLabels = {
  safe: '무난하게',
  harmony: '자연스럽게',
  accent: '포인트로',
} as const

/** 작은 선택창과 후보 상세에서 Tab 초점이 뒤쪽 옷장 컨트롤로 넘어가지 않게 한다. */
function keepFocusWithinDialog(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return
  const controls = event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])',
  )
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

/** 추천을 처음 요청할 때 선택한 탭과 옷 종류에 맞는 진행 상태를 표시한다. */
function RecommendationLoading({
  category,
  mode,
}: {
  category: OutfitSelectionCategory
  mode: RecommendationMode
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-sage">
        <LoaderCircle className="animate-spin" size={22} aria-hidden="true" />
      </span>
      <strong className="mt-4 text-sm font-black">
        {mode === 'colors'
          ? '어울리는 컬러 조합을 찾고 있어요'
          : `어울리는 ${outfitSelectionLabels[category]} 아이템을 찾고 있어요`}
      </strong>
      <span className="mt-1 text-xs text-muted">잠깐만 기다려주세요.</span>
    </div>
  )
}

/** 조회 결과를 탭별로 보여준다. 옷 후보를 누르면 상세를 열도록 값을 전달한다. */
function RecommendationResults({
  category,
  mode,
  isLoading,
  isError,
  recommendation,
  onRetry,
  onCandidateSelect,
}: {
  category: OutfitSelectionCategory
  mode: RecommendationMode
  isLoading: boolean
  isError: boolean
  recommendation?: OutfitRecommendation
  onRetry: () => void
  onCandidateSelect: (candidate: MatchCandidatePreview) => void
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
    return <RecommendationLoading category={category} mode={mode} />
  }

  if (mode === 'colors') {
    return recommendedColors.length > 0 ? (
      <div className="space-y-3">
        {recommendedColors.slice(0, 3).map((color) => (
          <div className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-4" key={color.name}>
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
            </div>
          </div>
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
            <span
              className="size-2 rounded-full border border-black/10"
              style={{ backgroundColor: candidate.item.colorHex }}
              aria-hidden="true"
            />
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
      aria-modal="true"
      aria-labelledby="recommendation-item-title"
      onKeyDown={keepFocusWithinDialog}
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
            <span
              className="size-3 rounded-full border border-black/10"
              style={{ backgroundColor: candidate.item.colorHex }}
              aria-hidden="true"
            />
            {candidate.label}
          </span>
          <h2 id="recommendation-item-title" className="mt-1 text-lg font-black">
            {candidate.item.name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{candidate.reason}</p>
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-[0.8fr_1.2fr] gap-2 border-t border-line bg-surface px-5 py-3">
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
 * 옷장 헤더에서 추천 종류를 고르는 작은 선택창을 열고, 선택한 추천을 같은 옷장 시트에 표시한다.
 * 추천 조회는 종류를 고른 뒤에만 실행하며, 옷 후보를 추가하면 부모의 composer 선택 동작을 호출한다.
 * 옷장 목록은 덮개 아래에 그대로 두어 돌아왔을 때 기존 검색·필터·스크롤 상태를 유지한다.
 */
export function OutfitStyleSuggestion({
  category,
  selectedItemIds,
  hasClosetCandidates,
  onAddItem,
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
    mode !== null,
  )
  const categoryLabel = outfitSelectionLabels[category]

  /** 선택창이나 추천 시트를 닫고 진입 버튼으로 초점을 되돌린다. 옷장 목록 상태는 변경하지 않는다. */
  const closeSuggestion = useCallback(() => {
    setSelectedCandidate(null)
    setMode(null)
    setIsChoiceOpen(false)
    setWardrobeContainer(null)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  /** 옷장 시트를 덮개 위치로 저장하고, 추천 조회 전 두 가지 도움 중 하나를 고르게 한다. */
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
    closeSuggestion()
    onAddItem(item)
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
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSuggestion()
          }}
          role="presentation"
        >
          <section
            className="w-full max-w-sm rounded-[1.5rem] border border-line bg-surface p-5 text-ink shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="outfit-style-choice-title"
            aria-describedby="outfit-style-choice-description"
            onKeyDown={keepFocusWithinDialog}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black tracking-[0.12em] text-accent">STYLE ASSIST</span>
                <h2 id="outfit-style-choice-title" className="mt-1 text-lg font-black tracking-[-0.03em]">
                  어떤 도움을 받을까요?
                </h2>
              </div>
              <button
                type="button"
                onClick={closeSuggestion}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas"
                aria-label="스타일 제안 선택 닫기"
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>
            <p id="outfit-style-choice-description" className="mt-1 text-xs leading-5 text-muted">
              지금 만드는 Look에 어울리는 {categoryLabel} 아이템과 색을 살펴보세요.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => chooseMode('items')}
                disabled={!hasClosetCandidates}
                autoFocus={hasClosetCandidates}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-canvas px-4 text-left transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Shirt size={20} strokeWidth={1.5} aria-hidden="true" />
                <span className="flex flex-col gap-0.5">
                  <strong className="text-sm">내 옷 추천</strong>
                  <span className="text-[11px] text-muted">
                    {hasClosetCandidates ? '옷장에서 어울리는 아이템 찾기' : `더 고를 ${categoryLabel} 아이템이 없어요`}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => chooseMode('colors')}
                autoFocus={!hasClosetCandidates}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-canvas px-4 text-left transition hover:border-accent/50"
              >
                <Palette size={20} strokeWidth={1.5} aria-hidden="true" />
                <span className="flex flex-col gap-0.5">
                  <strong className="text-sm">컬러 추천</strong>
                  <span className="text-[11px] text-muted">함께 쓰기 좋은 색 조합 살펴보기</span>
                </span>
              </button>
            </div>
          </section>
        </div>,
        document.body,
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
                onClick={closeSuggestion}
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
                  내 옷 추천
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
                  컬러 추천
                </button>
              </div>
              {!hasClosetCandidates && (
                <p className="mt-2 text-[11px] leading-4 text-muted">
                  더 고를 {categoryLabel} 아이템이 없어 내 옷 추천을 사용할 수 없어요.
                </p>
              )}
              {mode === 'colors' && (
                <p className="mt-2 text-[11px] leading-4 text-muted">
                  컬러 조합은 참고용이에요. 마음에 드는 색의 옷은 옷장에서 직접 골라주세요.
                </p>
              )}
            </div>

            <div
              id="style-suggestion-panel"
              role="tabpanel"
              aria-labelledby={mode === 'items' ? 'style-suggestion-items-tab' : 'style-suggestion-colors-tab'}
              aria-live="polite"
              className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-4"
            >
              <RecommendationResults
                category={category}
                mode={mode}
                isLoading={recommendationQuery.isLoading}
                isError={recommendationQuery.isError}
                recommendation={recommendationQuery.data}
                onRetry={() => void recommendationQuery.refetch()}
                onCandidateSelect={openCandidateDetail}
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
