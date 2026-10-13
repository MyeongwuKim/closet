import { useEffect, useRef, useState } from 'react'
import type { ClothingCategory } from '@closet/types'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { ClothingCategoryIcon } from '../../../components/ClothingCategoryIcon'
import { closetCategoryLabels } from '../../closet/constants'
import { ClosetCategoryFilter } from '../../closet/components/ClosetCategoryFilter'
import { useUiStore } from '../../../stores/useUiStore'
import { useOutfitComposer } from '../contexts/OutfitComposerContext'
import { OutfitItemBrowser, type OutfitColorFilter } from './OutfitItemBrowser'
import { OutfitWardrobeCard } from './OutfitWardrobeCard'
import { OutfitReplacementPicker } from './OutfitReplacementPicker'
import { OutfitStyleSuggestion } from './OutfitRecommendationSection'
import { OutfitStylingLayout } from './OutfitStylingLayout'
import {
  getOutfitSelectionCategory,
  getOutfitSlotId,
  matchesOutfitSelectionCategory,
  outfitSelectionLabels,
  type OutfitSelectionCategory,
} from '../utils/outfitSelection'

const FILTER_EXIT_DURATION = 170
const FILTER_ENTER_DURATION = 280
const SHEET_FOCUS_DELAY = 360

type FilterTransitionPhase = 'idle' | 'leaving' | 'entering'

interface OutfitMatchPanelProps {
  isWardrobeExpanded: boolean
  onWardrobeExpandedChange: (expanded: boolean) => void
}

/** 편집 중인 Look과 옷장 탐색을 연결한다. 시트 표시 상태는 하단 버튼과 함께 부모가 관리한다. */
export function OutfitMatchPanel({ isWardrobeExpanded, onWardrobeExpandedChange }: OutfitMatchPanelProps) {
  const navigate = useNavigate()
  const pushToast = useUiStore((state) => state.pushToast)
  const {
    items,
    selectedIds,
    selectedItems,
    targetCategory,
    targetOptions,
    replacementItemId,
    recommendedCategory,
    step,
    toggleItem,
    removeItem,
    selectTargetCategory,
    selectReplacementItem,
  } = useOutfitComposer()
  const [startCategory, setStartCategory] =
    useState<ClothingCategory | null>(null)
  const lastSlotTriggerRef = useRef<HTMLElement | null>(null)
  const wasWardrobeExpandedRef = useRef(isWardrobeExpanded)
  const [startSubcategory, setStartSubcategory] = useState<string | null>(null)
  const [filterTransitionPhase, setFilterTransitionPhase] =
    useState<FilterTransitionPhase>('idle')
  /** 여러 아이템이 들어간 칸이 꽉 찼을 때 교체할 아이템을 고르는 단계. */
  const [replacementSlotCategory, setReplacementSlotCategory] = useState<OutfitSelectionCategory | null>(null)
  /** 옷장 목록의 색상 필터. 추천 색과 옷장 필터 칩이 같은 값을 읽고 변경한다. */
  const [colorFilter, setColorFilter] = useState<OutfitColorFilter | null>(null)
  /** Look 칸 또는 추천 색을 고를 때 추천 덮개와 옷장 검색·계절 조건을 새로 여는 번호. */
  const [wardrobeViewRevision, setWardrobeViewRevision] = useState(0)
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
  const replacingItem = selectedItems.find((item) => item.id === replacementItemId) ?? null
  const canChooseDressFromTop = targetCategory === 'top' && (
    targetOptions.includes('dress') ||
    (Boolean(replacingItem) && !selectedItems.some((item) => item.id !== replacingItem?.id && item.category === 'bottom'))
  )
  const targetClosetItems = targetCategory
    ? classifiedItems.filter(
        (item) =>
          (matchesOutfitSelectionCategory(item, targetCategory) ||
            (canChooseDressFromTop && matchesOutfitSelectionCategory(item, 'dress'))) &&
          !selectedIds.includes(item.id),
      )
    : []
  const currentTargetSlotItems = targetCategory
    ? selectedItems.filter((item) => getOutfitSlotId(item) === getOutfitSlotId(targetCategory))
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

  // 모바일에서 열림 전환이 끝나면 닫기 버튼으로, 닫으면 원래 누른 Look 칸으로 초점을 돌린다.
  useEffect(() => {
    if (wasWardrobeExpandedRef.current === isWardrobeExpanded) return
    wasWardrobeExpandedRef.current = isWardrobeExpanded
    if (isWardrobeExpanded && !window.matchMedia('(max-width: 767px)').matches) return
    const focusTimer = window.setTimeout(() => {
      if (isWardrobeExpanded) {
        document.querySelector<HTMLElement>('.outfit-styling-layout__drawer-toggle')?.focus({ preventScroll: true })
      } else {
        const trigger = lastSlotTriggerRef.current?.isConnected
          ? lastSlotTriggerRef.current
          : document.querySelector<HTMLElement>('.composer-look-canvas__slot-action')
        trigger?.focus({ preventScroll: true })
      }
    }, isWardrobeExpanded && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? SHEET_FOCUS_DELAY : 0)
    return () => window.clearTimeout(focusTimer)
  }, [isWardrobeExpanded])

  useEffect(() => {
    const mobileViewport = window.matchMedia('(max-width: 767px)')
    const closeWhenDesktop = () => {
      if (!mobileViewport.matches) onWardrobeExpandedChange(false)
    }
    mobileViewport.addEventListener('change', closeWhenDesktop)
    return () => mobileViewport.removeEventListener('change', closeWhenDesktop)
  }, [onWardrobeExpandedChange])

  const selectCanvasSlot = (category: OutfitSelectionCategory) => {
    lastSlotTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const slotCategory = category === 'dress' ? 'top' : category
    const currentSlotItems = selectedItems.filter((item) => getOutfitSlotId(item) === getOutfitSlotId(slotCategory))
    const canAdd = targetOptions.includes(category)
    if (!canAdd && currentSlotItems.length === 0) {
      pushToast('이 종류의 옷을 바꾸려면 먼저 선택한 아이템을 빼주세요.')
      return
    }
    setWardrobeViewRevision((current) => current + 1)
    setColorFilter(null)
    if (window.matchMedia('(max-width: 767px)').matches) {
      onWardrobeExpandedChange(true)
    }
    if (!canAdd && currentSlotItems.length > 1) {
      setReplacementSlotCategory(slotCategory)
      return
    }
    setReplacementSlotCategory(null)
    if (!canAdd) {
      selectReplacementItem(currentSlotItems[0].id, slotCategory)
    } else {
      selectTargetCategory(category)
    }
  }

  const changeWardrobeExpanded = (expanded: boolean) => {
    onWardrobeExpandedChange(expanded)
    if (!expanded) setReplacementSlotCategory(null)
  }

  /** 추천 색을 고르면 현재 종류의 옷장에 색 필터만 남기도록 목록을 새로 연다. */
  const selectRecommendedColor = (color: OutfitColorFilter) => {
    setColorFilter({ ...color, source: 'recommendation' })
    setWardrobeViewRevision((current) => current + 1)
    contentRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }

  const startContent = (
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
  )

  const lastSelectionCategory = lastSelectedItem
    ? getOutfitSelectionCategory(lastSelectedItem)
    : null
  const lastCategoryLabel = lastSelectionCategory
    ? outfitSelectionLabels[lastSelectionCategory]
    : '옷'
  const stepAnimationKey = `${selectedIds.join('-')}-${step}-${targetCategory}`

  return (
      <OutfitStylingLayout
        selectedItems={selectedItems}
        selectableCategories={targetOptions}
        isWardrobeExpanded={isWardrobeExpanded}
        onWardrobeExpandedChange={changeWardrobeExpanded}
        onSlotSelect={selectCanvasSlot}
        onItemRemove={removeItem}
        wardrobeAction={!replacementSlotCategory && step === 'items' && recommendationCategory && recommendationCategory !== 'bag' && selectedIds.length > 0 ? (
          <OutfitStyleSuggestion
            key={`${targetCategory}-${wardrobeViewRevision}`}
            category={recommendationCategory}
            selectedItemIds={selectedIds}
            hasClosetCandidates={hasRecommendationCandidates}
            onAddItem={toggleItem}
            onColorSelect={selectRecommendedColor}
          />
        ) : undefined}
      >
      {replacementSlotCategory ? (
        <OutfitReplacementPicker
          category={replacementSlotCategory}
          items={selectedItems.filter((item) => getOutfitSlotId(item) === getOutfitSlotId(replacementSlotCategory))}
          onChoose={(item) => {
            selectReplacementItem(item.id, replacementSlotCategory)
            setReplacementSlotCategory(null)
          }}
        />
      ) : step === 'start' ? startContent : (
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
                        onClick={() => {
                          setColorFilter(null)
                          setWardrobeViewRevision((current) => current + 1)
                          selectTargetCategory(category)
                        }}
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
                  key={wardrobeViewRevision}
                  category={targetCategory}
                  categoryLabel={canChooseDressFromTop ? '상의·원피스' : undefined}
                  items={targetClosetItems}
                  currentItems={currentTargetSlotItems}
                  replacingItem={replacingItem}
                  colorFilter={colorFilter}
                  onColorFilterChange={setColorFilter}
                  onReplaceItem={(item) => selectReplacementItem(item.id, targetCategory)}
                  onSelect={toggleItem}
                  onOpenCloset={() => navigate('/closet')}
                />
              </div>
            )}
          </div>
        </div>
      </section>
      )}
      </OutfitStylingLayout>
  )
}
