import { useEffect, useRef, useState } from 'react'
import type {
  ClothingCategory,
  OutfitMatchRelation,
  WardrobeItem,
} from '@closet/types'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  LoaderCircle,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import {
  closetCategoryLabels,
} from '../../closet/constants'
import { ClosetCategoryFilter } from '../../closet/components/ClosetCategoryFilter'
import { useOutfitRecommendationQuery } from '../api/lookbookQueries'
import { useOutfitComposer } from '../contexts/OutfitComposerContext'

const FILTER_EXIT_DURATION = 170
const FILTER_ENTER_DURATION = 280

type FilterTransitionPhase = 'idle' | 'leaving' | 'entering'

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

function withObjectParticle(label: string) {
  const lastCode = label.charCodeAt(label.length - 1)
  const hasFinalConsonant =
    lastCode >= 0xac00 && lastCode <= 0xd7a3
      ? (lastCode - 0xac00) % 28 !== 0
      : false
  return `${label}${hasFinalConsonant ? '을' : '를'}`
}

interface MatchCandidatePreview {
  item: WardrobeItem
  label: string
  reason: string
}

function ClosetChoiceCard({
  item,
  onClick,
}: {
  item: WardrobeItem
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative min-w-0 rounded-2xl bg-surface p-1.5 text-left shadow-[inset_0_0_0_1px_#dedad1] transition hover:-translate-y-0.5"
    >
      <span className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-canvas">
        <ClosetItemVisual item={item} compact />
      </span>
      <span className="mt-1.5 block truncate px-1 pb-0.5 text-[11px] font-bold">
        {item.name}
      </span>
    </button>
  )
}

function SelectedItemCard({
  item,
  isBase,
  isLatest,
  onRemove,
}: {
  item: WardrobeItem
  isBase: boolean
  isLatest: boolean
  onRemove: () => void
}) {
  return (
    <div
      className={`relative w-[5.25rem] shrink-0 ${
        isLatest ? 'outfit-selected-flash' : ''
      }`}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface p-1.5">
        <span className="flex size-full items-center justify-center overflow-hidden rounded-xl bg-canvas">
          <ClosetItemVisual item={item} compact />
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-white/95 text-muted shadow-sm"
          aria-label={`${item.name} 코디에서 빼기`}
        >
          <X size={12} />
        </button>
      </div>
      <span className="mt-1.5 block truncate text-center text-[10px] font-bold">
        {item.name}
      </span>
      {isBase && (
        <span className="mt-0.5 block text-center text-[9px] font-black text-accent">
          시작한 옷
        </span>
      )}
    </div>
  )
}

function RecommendationLoading({
  category,
  mode,
}: {
  category: ClothingCategory
  mode: 'items' | 'colors'
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-sage">
        <LoaderCircle className="animate-spin" size={22} />
      </span>
      <strong className="mt-4 text-sm font-black">
        {mode === 'colors'
          ? '어울리는 컬러 조합을 찾고 있어요'
          : `어울리는 ${closetCategoryLabels[category]}를 찾고 있어요`}
      </strong>
      <span className="mt-1 text-xs text-muted">잠깐만 기다려주세요.</span>
    </div>
  )
}

function RecommendationDetailDialog({
  candidate,
  onConfirm,
  onClose,
}: {
  candidate: MatchCandidatePreview | null
  onConfirm: () => void
  onClose: () => void
}) {
  useEffect(() => {
    if (!candidate) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [candidate, onClose])

  if (!candidate) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-[1.75rem] bg-surface p-4 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-item-title"
      >
        <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-2xl bg-canvas">
          <ClosetItemVisual item={candidate.item} />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/95 text-muted shadow-sm"
            aria-label="추천 상세 닫기"
          >
            <X size={17} />
          </button>
        </div>

        <div className="px-1 pt-4">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-accent">
            <span
              className="size-3 rounded-full border border-black/10"
              style={{ backgroundColor: candidate.item.colorHex }}
            />
            {candidate.label}
          </span>
          <h3
            id="recommendation-item-title"
            className="mt-1 text-lg font-black"
          >
            {candidate.item.name}
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {candidate.reason}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-canvas px-4 py-3 text-sm font-bold"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white"
          >
            코디에 추가
          </button>
        </div>
      </div>
    </div>
  )
}

export function OutfitMatchPanel() {
  const navigate = useNavigate()
  const {
    items,
    selectedIds,
    selectedItems,
    targetCategory,
    targetOptions,
    recommendedCategory,
    step,
    toggleItem,
    selectTargetCategory,
  } = useOutfitComposer()
  const [startCategory, setStartCategory] =
    useState<ClothingCategory | null>(null)
  const [startSubcategory, setStartSubcategory] = useState<string | null>(null)
  const [filterTransitionPhase, setFilterTransitionPhase] =
    useState<FilterTransitionPhase>('idle')
  const filterTransitionTimersRef = useRef<number[]>([])
  const [selectedCandidate, setSelectedCandidate] =
    useState<MatchCandidatePreview | null>(null)
  const [recommendationView, setRecommendationView] = useState<{
    category: ClothingCategory
    mode: 'items' | 'colors'
  } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const baseItem = selectedItems[0]
  const lastSelectedItem = selectedItems[selectedItems.length - 1]
  const classifiedItems = items.filter(
    (item) => item.classificationStatus === 'classified' && item.category,
  )
  const availableStartCategories = (
    Object.keys(closetCategoryLabels) as ClothingCategory[]
  ).filter((category) =>
    classifiedItems.some((item) => item.category === category),
  )
  const availableStartSubcategories = Array.from(
    new Set(
      classifiedItems.flatMap((item) =>
        item.category === startCategory && item.subcategory?.trim()
          ? [item.subcategory.trim()]
          : [],
      ),
    ),
  )
  const startItems = classifiedItems.filter(
    (item) =>
      (startCategory === null || item.category === startCategory) &&
      (startSubcategory === null || item.subcategory === startSubcategory),
  )
  const targetClosetItems = targetCategory
    ? classifiedItems.filter(
        (item) =>
          item.category === targetCategory && !selectedIds.includes(item.id),
      )
    : []
  const recommendationMode =
    recommendationView?.category === targetCategory
      ? recommendationView.mode
      : null
  const isRecommendationRequested = Boolean(
    recommendationMode && targetCategory,
  )
  const recommendationQuery = useOutfitRecommendationQuery(
    selectedIds,
    targetCategory,
    isRecommendationRequested && step === 'items',
  )
  const recommendation = recommendationQuery.data
  const isRecommendationLoading =
    isRecommendationRequested && recommendationQuery.isLoading
  const isRecommendationError =
    isRecommendationRequested && recommendationQuery.isError
  const aiCandidates = recommendation?.candidates ?? []
  const recommendedColors = recommendation?.recommendedColors ?? []

  useEffect(
    () => () => {
      filterTransitionTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      )
    },
    [],
  )

  const changeStartFilter = (
    nextCategory: ClothingCategory | null,
    nextSubcategory: string | null,
  ) => {
    if (
      nextCategory === startCategory &&
      nextSubcategory === startSubcategory
    ) {
      return
    }

    filterTransitionTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    )
    filterTransitionTimersRef.current = []

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStartCategory(nextCategory)
      setStartSubcategory(nextSubcategory)
      setFilterTransitionPhase('idle')
      return
    }

    setFilterTransitionPhase('leaving')

    const swapTimer = window.setTimeout(() => {
      setStartCategory(nextCategory)
      setStartSubcategory(nextSubcategory)
      setFilterTransitionPhase('entering')

      const settleTimer = window.setTimeout(() => {
        setFilterTransitionPhase('idle')
        filterTransitionTimersRef.current = []
      }, FILTER_ENTER_DURATION)

      filterTransitionTimersRef.current = [settleTimer]
    }, FILTER_EXIT_DURATION)

    filterTransitionTimersRef.current = [swapTimer]
  }

  const filterTransitionClass =
    filterTransitionPhase === 'leaving'
      ? 'closet-filter-leave'
      : filterTransitionPhase === 'entering'
        ? 'closet-filter-enter'
        : ''

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedIds.length, step, targetCategory])

  if (step === 'start') {
    return (
      <section className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col bg-canvas">
        <div className="shrink-0 px-5 pt-6">
          <span className="text-[11px] font-black tracking-[0.12em] text-accent">
            첫 번째
          </span>
          <h2 className="mt-1 text-xl font-black">시작할 옷을 골라주세요</h2>
          <p className="mt-1 text-sm text-muted">
            무엇을 먼저 골라도 다음 옷을 이어서 추천해드릴게요.
          </p>
        </div>

        <div
          className={`${filterTransitionClass} flex min-h-0 flex-1 flex-col`}
          aria-busy={filterTransitionPhase !== 'idle'}
        >
          <div className="shrink-0 px-5">
          <ClosetCategoryFilter
            className="mt-4"
            category={startCategory}
            subcategory={startSubcategory}
            availableCategories={availableStartCategories}
            availableSubcategories={availableStartSubcategories}
            onCategoryChange={(category) => changeStartFilter(category, null)}
            onSubcategoryChange={(subcategory) =>
              changeStartFilter(startCategory, subcategory)
            }
          />
          </div>

          <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-6">
            {startItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {startItems.map((item) => (
                  <ClosetChoiceCard
                    item={item}
                    onClick={() => toggleItem(item)}
                    key={item.id}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                먼저 옷장에 옷을 추가해주세요.
              </div>
            )}
          </div>
        </div>
      </section>
    )
  }

  const targetLabel = targetCategory
    ? closetCategoryLabels[targetCategory]
    : null
  const lastCategoryLabel = lastSelectedItem.category
    ? closetCategoryLabels[lastSelectedItem.category]
    : '옷'
  const title = step === 'category'
    ? '다음에 무엇을 추가할까요?'
    : targetLabel
      ? `다음은 ${withObjectParticle(targetLabel)} 골라볼까요?`
      : '코디가 완성됐어요'
  const description = step === 'category'
    ? '정해진 순서 없이 원하는 종류를 직접 골라보세요.'
    : targetLabel
      ? `${baseItem.name}에서 시작한 조합이에요.`
      : '이대로 코디북에 저장할 수 있어요.'
  const stepAnimationKey = `${selectedIds.join('-')}-${step}-${targetCategory}`

  return (
    <>
      <section className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col bg-canvas">
        <div
          className="outfit-step-enter flex min-h-0 flex-1 flex-col"
          key={stepAnimationKey}
        >
          <div className="shrink-0 border-b border-line px-5 pt-5 pb-4">
            <span className="outfit-step-light inline-flex rounded-full px-2 py-1 text-[10px] font-black tracking-[0.1em] text-accent">
              {step === 'category'
                ? `${lastCategoryLabel} 선택 완료`
                : `${selectedItems.length + 1}번째`}
            </span>
            <h2 className="mt-2 text-xl leading-7 font-black">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-muted">{description}</p>

            <div className="scrollbar-hidden mt-4 flex gap-3 overflow-x-auto pb-1">
              {selectedItems.map((item, index) => (
                <SelectedItemCard
                  item={item}
                  isBase={index === 0}
                  isLatest={index === selectedItems.length - 1}
                  onRemove={() => toggleItem(item)}
                  key={item.id}
                />
              ))}
            </div>
          </div>

          <div
            ref={contentRef}
            className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-5"
          >
            {step === 'category' ? (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  {targetOptions.map((category) => {
                    const availableCount = classifiedItems.filter(
                      (item) =>
                        item.category === category &&
                        !selectedIds.includes(item.id),
                    ).length
                    const isRecommended = category === recommendedCategory

                    return (
                      <button
                        type="button"
                        onClick={() => selectTargetCategory(category)}
                        className={`relative min-h-24 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                          isRecommended
                            ? 'border-accent bg-accent/5'
                            : 'border-line bg-surface hover:border-ink'
                        }`}
                        key={category}
                      >
                        {isRecommended && (
                          <span className="absolute top-3 right-3 rounded-full bg-accent px-2 py-1 text-[9px] font-black text-white">
                            추천
                          </span>
                        )}
                        <span className="flex size-8 items-center justify-center rounded-xl bg-sage">
                          <Plus size={16} />
                        </span>
                        <strong className="mt-3 block text-sm font-black">
                          {closetCategoryLabels[category]}
                        </strong>
                        <span className="mt-0.5 block text-[10px] text-muted">
                          내 옷장 {availableCount}개
                        </span>
                      </button>
                    )
                  })}
                </div>

                {targetOptions.length === 0 && (
                  <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border border-dashed border-line text-center">
                    <Check size={22} />
                    <strong className="mt-3 text-sm font-black">
                      추가할 수 있는 종류를 모두 골랐어요
                    </strong>
                  </div>
                )}
              </div>
            ) : !targetCategory ? (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <Check size={24} />
                <strong className="mt-3 text-base font-black">
                  코디가 완성됐어요
                </strong>
              </div>
            ) : (
              <div>
                <section aria-labelledby="target-closet-title">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black tracking-[0.08em] text-accent">
                        내 옷장
                      </span>
                      <h3 id="target-closet-title" className="text-sm font-black">
                        {closetCategoryLabels[targetCategory]} 목록
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-muted">
                      {targetClosetItems.length}개
                    </span>
                  </div>

                  {targetClosetItems.length > 0 ? (
                    <div className="scrollbar-hidden -mx-5 mt-3 grid auto-cols-[8rem] grid-flow-col gap-3 overflow-x-auto px-5 pb-3">
                      {targetClosetItems.map((item) => (
                        <ClosetChoiceCard
                          item={item}
                          onClick={() => toggleItem(item)}
                          key={item.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 flex min-h-44 flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 text-center">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-sage">
                        <Plus size={19} />
                      </span>
                      <strong className="mt-3 text-sm font-black">
                        옷장에 {closetCategoryLabels[targetCategory]}가 없어요
                      </strong>
                      <button
                        type="button"
                        onClick={() => navigate('/closet')}
                        className="mt-4 rounded-full bg-accent px-4 py-2 text-xs font-bold text-white"
                      >
                        옷장에 추가하기
                      </button>
                    </div>
                  )}
                </section>

                {targetClosetItems.length > 0 && (
                  <section className="mt-5 border-t border-line pt-5">
                    <div className="rounded-3xl bg-surface p-4 shadow-[inset_0_0_0_1px_#dedad1]">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sage">
                          <Sparkles size={18} />
                        </span>
                        <div>
                          <h3 className="text-sm font-black">AI 도움받기</h3>
                          <p className="mt-1 text-xs leading-5 text-muted">
                            필요한 추천만 골라서 확인해보세요.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRecommendationView({
                              category: targetCategory,
                              mode: 'items',
                            })
                          }}
                          className={`rounded-xl border px-3 py-3 text-xs font-bold transition ${
                            recommendationMode === 'items'
                              ? 'border-ink bg-ink text-white'
                              : 'border-line bg-canvas text-ink'
                          }`}
                        >
                          {closetCategoryLabels[targetCategory]} 추천받기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRecommendationView({
                              category: targetCategory,
                              mode: 'colors',
                            })
                          }}
                          className={`rounded-xl border px-3 py-3 text-xs font-bold transition ${
                            recommendationMode === 'colors'
                              ? 'border-ink bg-ink text-white'
                              : 'border-line bg-canvas text-ink'
                          }`}
                        >
                          컬러 조합 추천
                        </button>
                      </div>
                    </div>

                    {recommendationMode && (
                      <div className="mt-4">
                        {isRecommendationError ? (
                          <div className="flex min-h-44 flex-col items-center justify-center rounded-3xl border border-dashed border-line text-center">
                            <strong className="text-sm font-black">
                              추천을 불러오지 못했어요
                            </strong>
                            <button
                              type="button"
                              onClick={() => {
                                void recommendationQuery.refetch()
                              }}
                              className="mt-4 flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white"
                            >
                              <RefreshCw size={13} /> 다시 추천받기
                            </button>
                          </div>
                        ) : !isRecommendationRequested ||
                          isRecommendationLoading ||
                          !recommendation ? (
                          <RecommendationLoading
                            category={targetCategory}
                            mode={recommendationMode}
                          />
                        ) : recommendationMode === 'colors' ? (
                          recommendedColors.length > 0 ? (
                            <div className="rounded-3xl border border-line bg-surface p-5">
                              <span className="text-[10px] font-black tracking-[0.08em] text-accent">
                                AI 컬러 조합
                              </span>
                              <div className="mt-3 space-y-3">
                                {recommendedColors.slice(0, 3).map((color) => (
                                  <p
                                    className="flex items-start gap-2 text-xs leading-5"
                                    key={color.name}
                                  >
                                    <span
                                      className="mt-1 size-3 shrink-0 rounded-full border border-black/10"
                                      style={{ backgroundColor: color.hex }}
                                    />
                                    <span>
                                      <strong className="font-black">
                                        {colorRoleLabels[color.role]} · {color.name}
                                      </strong>
                                      <span className="text-muted">
                                        {' '}· {color.reason}
                                      </span>
                                    </span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-3xl border border-dashed border-line px-5 py-8 text-center text-sm font-bold">
                              추천할 컬러 조합을 찾지 못했어요.
                            </div>
                          )
                        ) : aiCandidates.length > 0 ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="flex size-8 items-center justify-center rounded-xl bg-sage">
                                <Sparkles size={15} />
                              </span>
                              <div>
                                <span className="text-[10px] font-black tracking-[0.08em] text-accent">
                                  AI 옷 추천
                                </span>
                                <h3 className="text-sm font-black">
                                  어울리는 {closetCategoryLabels[targetCategory]}
                                </h3>
                              </div>
                            </div>

                            <div className="scrollbar-hidden -mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3">
                              {aiCandidates.map((candidate) => (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedCandidate({
                                      item: candidate.item,
                                      label: relationLabels[candidate.relation],
                                      reason: candidate.reason,
                                    })
                                  }
                                  className="w-32 shrink-0 snap-start rounded-2xl border border-line bg-surface p-1.5 text-left transition hover:-translate-y-0.5 hover:border-accent/50"
                                  key={candidate.item.id}
                                >
                                  <span className="flex h-24 items-center justify-center overflow-hidden rounded-xl bg-canvas">
                                    <ClosetItemVisual item={candidate.item} compact />
                                  </span>
                                  <span className="mt-1.5 flex items-center gap-1 px-1 text-[9px] font-bold text-accent">
                                    <span
                                      className="size-2 rounded-full border border-black/10"
                                      style={{ backgroundColor: candidate.item.colorHex }}
                                    />
                                    {relationLabels[candidate.relation]}
                                  </span>
                                  <strong className="mt-1 block truncate px-1 text-xs">
                                    {candidate.item.name}
                                  </strong>
                                  <span className="mt-0.5 block truncate px-1 pb-1 text-[9px] text-muted">
                                    {candidate.reason}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-3xl border border-dashed border-line px-5 py-8 text-center">
                            <strong className="text-sm font-black">
                              추천할 수 있는 {closetCategoryLabels[targetCategory]}가 없어요
                            </strong>
                            <p className="mt-2 text-xs leading-5 text-muted">
                              내 옷장 목록에서 직접 골라보세요.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <RecommendationDetailDialog
        candidate={selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        onConfirm={() => {
          if (!selectedCandidate) return
          toggleItem(selectedCandidate.item)
          setSelectedCandidate(null)
        }}
      />
    </>
  )
}
