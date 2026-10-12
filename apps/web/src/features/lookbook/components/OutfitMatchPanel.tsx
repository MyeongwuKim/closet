import { useEffect, useRef, useState } from 'react'
import type { ClothingCategory } from '@closet/types'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'
import { closetCategoryLabels } from '../../closet/constants'
import { ClosetCategoryFilter } from '../../closet/components/ClosetCategoryFilter'
import { useUiStore } from '../../../stores/useUiStore'
import { useOutfitComposer } from '../contexts/OutfitComposerContext'
import { OutfitItemBrowser } from './OutfitItemBrowser'
import { OutfitWardrobeCard } from './OutfitWardrobeCard'
import { OutfitStyleSuggestion } from './OutfitRecommendationSection'
import { OutfitStylingLayout } from './OutfitStylingLayout'
import {
  getOutfitSelectionCategory,
  matchesOutfitSelectionCategory,
  outfitSelectionLabels,
  type OutfitSelectionCategory,
} from '../utils/outfitSelection'

const FILTER_EXIT_DURATION = 170
const FILTER_ENTER_DURATION = 280

type FilterTransitionPhase = 'idle' | 'leaving' | 'entering'

/** 편집 중인 Look과 옷장 탐색을 연결한다. 아이템 추가·제거와 종류 선택은 composer 세션에 맡긴다. */
export function OutfitMatchPanel() {
  const navigate = useNavigate()
  const pushToast = useUiStore((state) => state.pushToast)
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
  /** 시작 단계와 다음 아이템 단계가 바뀌어도 모바일 옷장 시트 상태를 유지한다. */
  const [isWardrobeExpanded, setIsWardrobeExpanded] = useState(false)
  const previousSelectedCountRef = useRef(selectedIds.length)
  const [startSubcategory, setStartSubcategory] = useState<string | null>(null)
  const [filterTransitionPhase, setFilterTransitionPhase] =
    useState<FilterTransitionPhase>('idle')
  const filterTransitionTimersRef = useRef<number[]>([])
  const contentRef = useRef<HTMLDivElement>(null)
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
  // 상의 칸은 원피스와 조합 위치를 공유한다. 원피스를 넣을 수 있을 때만 같은 옷장 목록에 표시한다.
  const canChooseDressFromTop = targetCategory === 'top' && targetOptions.includes('dress')
  const targetClosetItems = targetCategory
    ? classifiedItems.filter(
        (item) =>
          (matchesOutfitSelectionCategory(item, targetCategory) ||
            (canChooseDressFromTop && matchesOutfitSelectionCategory(item, 'dress'))) &&
          !selectedIds.includes(item.id),
      )
    : []
  const hasTargetClosetCandidates = targetCategory !== null && targetClosetItems.some(
    (item) => matchesOutfitSelectionCategory(item, targetCategory),
  )
  // 상의가 없고 원피스만 남은 경우 추천 요청도 실제로 고를 수 있는 원피스를 대상으로 한다.
  const recommendationCategory = canChooseDressFromTop && !hasTargetClosetCandidates &&
    targetClosetItems.some((item) => matchesOutfitSelectionCategory(item, 'dress'))
    ? 'dress'
    : targetCategory
  const hasRecommendationCandidates = recommendationCategory !== null && targetClosetItems.some(
    (item) => matchesOutfitSelectionCategory(item, recommendationCategory),
  )
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

  // 옷을 추가·제거하거나 전체 해제하면 시트를 닫아 변경된 Look의 모든 칸을 보여준다.
  useEffect(() => {
    if (selectedIds.length !== previousSelectedCountRef.current) {
      setIsWardrobeExpanded(false)
    }
    previousSelectedCountRef.current = selectedIds.length
  }, [selectedIds.length])

  const selectCanvasSlot = (category: OutfitSelectionCategory) => {
    if (!targetOptions.includes(category)) {
      pushToast('이 종류의 옷을 바꾸려면 먼저 선택한 아이템을 빼주세요.')
      return
    }
    setIsWardrobeExpanded(true)
    selectTargetCategory(category)
  }

  if (step === 'start') {
    return (
      <OutfitStylingLayout
        selectedItems={selectedItems}
        selectableCategories={targetOptions}
        isWardrobeExpanded={isWardrobeExpanded}
        onWardrobeExpandedChange={setIsWardrobeExpanded}
        onSlotSelect={selectCanvasSlot}
        onItemRemove={toggleItem}
      >
      <section className="flex h-full min-h-0 w-full flex-col bg-canvas">
        <div className="shrink-0 px-5 pt-2">
          <span className="text-[10px] font-black tracking-[0.12em] text-accent">MY CLOSET</span>
          <h2 className="mt-0.5 text-base font-black">첫 아이템을 골라주세요</h2>
          <p className="mt-0.5 text-[11px] text-muted">어떤 옷부터 시작해도 좋아요.</p>
        </div>

        <div
          className={`${filterTransitionClass} flex min-h-0 flex-1 flex-col`}
          aria-busy={filterTransitionPhase !== 'idle'}
        >
          <div className="shrink-0 px-5">
          <ClosetCategoryFilter
            className="mt-2"
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

          <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-4">
            {startItems.length > 0 ? (
              <div className="outfit-wardrobe-grid">
                {startItems.map((item) => (
                  <OutfitWardrobeCard
                    item={item}
                    onSelect={toggleItem}
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
      </OutfitStylingLayout>
    )
  }

  const lastSelectionCategory = lastSelectedItem
    ? getOutfitSelectionCategory(lastSelectedItem)
    : null
  const lastCategoryLabel = lastSelectionCategory
    ? outfitSelectionLabels[lastSelectionCategory]
    : '옷'
  const stepAnimationKey = `${selectedIds.join('-')}-${step}-${targetCategory}`

  return (
    <>
      <OutfitStylingLayout
        selectedItems={selectedItems}
        selectableCategories={targetOptions}
        isWardrobeExpanded={isWardrobeExpanded}
        onWardrobeExpandedChange={setIsWardrobeExpanded}
        onSlotSelect={selectCanvasSlot}
        onItemRemove={toggleItem}
        wardrobeAction={step === 'items' && recommendationCategory && recommendationCategory !== 'bag' && selectedIds.length > 0 ? (
          <OutfitStyleSuggestion
            key={targetCategory}
            category={recommendationCategory}
            selectedItemIds={selectedIds}
            hasClosetCandidates={hasRecommendationCandidates}
            onAddItem={toggleItem}
          />
        ) : undefined}
      >
      <section className="flex h-full min-h-0 w-full flex-col bg-canvas">
        <div
          className="outfit-step-enter flex min-h-0 flex-1 flex-col"
          key={stepAnimationKey}
        >
          {step === 'category' && (
            <div className="shrink-0 border-b border-line px-5 pt-2 pb-2">
              <span className="outfit-step-light inline-flex rounded-full px-2 py-1 text-[10px] font-black tracking-[0.1em] text-accent">
                {lastCategoryLabel} 선택됨 · {selectedItems.length}개
              </span>
              <h2 className="mt-1 text-base leading-6 font-black">Look에 무엇을 더할까요?</h2>
            </div>
          )}
          <div
            ref={contentRef}
            className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-3"
          >
            {step === 'category' ? (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  {targetOptions.map((category) => {
                    const availableCount = classifiedItems.filter(
                      (item) =>
                        matchesOutfitSelectionCategory(item, category) &&
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
                          <ClothingCategoryIcon
                            category={category}
                            size={18}
                            strokeWidth={1.8}
                          />
                        </span>
                        <strong className="mt-3 block text-sm font-black">
                          {outfitSelectionLabels[category]}
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
                <OutfitItemBrowser
                  category={targetCategory}
                  categoryLabel={canChooseDressFromTop ? '상의·원피스' : undefined}
                  items={targetClosetItems}
                  onSelect={toggleItem}
                  onOpenCloset={() => navigate('/closet')}
                />
              </div>
            )}
          </div>
        </div>
      </section>
      </OutfitStylingLayout>

    </>
  )
}
