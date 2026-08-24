import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type {
  ClothingCategory,
  Season,
  WardrobeItem,
} from '@closet/types'
import { useIsMutating } from '@tanstack/react-query'
import { Shirt } from 'lucide-react'
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { ColorFilter } from '../../../components/ColorFilter'
import { SeasonFilter } from '../../../components/SeasonFilter'
import { seasonLabels } from '../../../constants/seasons'
import { useUiStore } from '../../../stores/useUiStore'
import {
  ClothingAnalysisError,
  clothingAnalysisMutationKey,
  useClassifyClothingMutation,
} from '../api/classifyClothing'
import {
  MAX_CLOTHING_IMAGE_SIZE,
  SUPPORTED_CLOTHING_IMAGE_TYPES,
  closetCategoryLabels,
} from '../constants'
import { useClosetStore } from '../stores/useClosetStore'
import { ClosetCategoryFilter } from '../components/ClosetCategoryFilter'
import { ClosetItemCard } from '../components/ClosetItemCard'
import { ClosetMultiSelectBar } from '../components/ClosetMultiSelectBar'
import { ClosetPageHeader } from '../components/ClosetPageHeader'
import { ClosetSearchFilter } from '../components/ClosetSearchFilter'
import {
  getWardrobeColorOptions,
  wardrobeItemMatchesColor,
} from '../utils/color'
import {
  getWardrobeItemCategories,
  wardrobeItemHasCategory,
} from '../utils/wardrobeCategories'
import {
  getRankedWardrobeTags,
  wardrobeItemHasTag,
  wardrobeItemMatchesSearch,
} from '../utils/wardrobeTags'

function createImageObjectUrl(base64: string, mimeType: string) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}

const FILTER_EXIT_DURATION = 170
const FILTER_ENTER_DURATION = 280

type FilterTransitionPhase = 'idle' | 'leaving' | 'entering'

export function ClosetPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const items = useClosetStore((state) => state.items)
  const enqueueClassification = useUiStore(
    (state) => state.enqueueClassification,
  )
  const pushToast = useUiStore((state) => state.pushToast)
  const classifyClothing = useClassifyClothingMutation()
  const analyzingCount = useIsMutating({
    mutationKey: clothingAnalysisMutationKey,
  })
  const [filterTransitionPhase, setFilterTransitionPhase] =
    useState<FilterTransitionPhase>('idle')
  const filterTransitionTimersRef = useRef<number[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const categoryParam = searchParams.get('category')
  const activeCategory =
    categoryParam && categoryParam in closetCategoryLabels
      ? (categoryParam as ClothingCategory)
      : null
  const seasonParam = searchParams.get('season')
  const activeSeason =
    seasonParam && seasonParam in seasonLabels ? (seasonParam as Season) : null
  const activeColor = searchParams.get('color')
  const activeSubcategory = activeCategory
    ? searchParams.get('subcategory')
    : null
  const searchQuery = searchParams.get('q') ?? ''
  const activeTag = searchParams.get('tag')

  const availableCategorySet = new Set(
    items.flatMap(getWardrobeItemCategories),
  )
  const availableCategories = (
    Object.keys(closetCategoryLabels) as ClothingCategory[]
  ).filter((category) => availableCategorySet.has(category))
  const availableColors = getWardrobeColorOptions(items)
  const availableTags = getRankedWardrobeTags(
    items.flatMap((item) => item.tags),
  )
  const selectedTag =
    activeTag && availableTags.includes(activeTag) ? activeTag : null
  const availableSubcategories = Array.from(
    new Set(
      items.flatMap((item) =>
        activeCategory &&
        wardrobeItemHasCategory(item, activeCategory) &&
        item.subcategory?.trim()
          ? [item.subcategory.trim()]
          : [],
      ),
    ),
  )
  const filteredItems = items.filter((item) => {
    if (!wardrobeItemMatchesSearch(item, searchQuery)) return false
    if (selectedTag && !wardrobeItemHasTag(item, selectedTag)) return false
    if (activeSeason && !item.seasons.includes(activeSeason)) return false
    if (activeColor && !wardrobeItemMatchesColor(item, activeColor)) {
      return false
    }
    if (activeCategory === null) return true
    if (!wardrobeItemHasCategory(item, activeCategory)) return false
    return activeSubcategory === null || item.subcategory === activeSubcategory
  })

  useEffect(
    () => () => {
      filterTransitionTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      )
    },
    [],
  )

  const updateFilterParam = (key: string, value: string | null) => {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        if (value) nextParams.set(key, value)
        else nextParams.delete(key)
        return nextParams
      },
      { replace: true },
    )
  }

  const applyCategoryFilter = (
    nextCategory: ClothingCategory | null,
    nextSubcategory: string | null,
  ) => {
    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        if (nextCategory) nextParams.set('category', nextCategory)
        else nextParams.delete('category')
        if (nextCategory && nextSubcategory) {
          nextParams.set('subcategory', nextSubcategory)
        } else {
          nextParams.delete('subcategory')
        }
        return nextParams
      },
      { replace: true },
    )
  }

  const changeFilter = (
    nextCategory: ClothingCategory | null,
    nextSubcategory: string | null,
  ) => {
    if (
      nextCategory === activeCategory &&
      nextSubcategory === activeSubcategory
    ) {
      return
    }

    filterTransitionTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    )
    filterTransitionTimersRef.current = []

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyCategoryFilter(nextCategory, nextSubcategory)
      setFilterTransitionPhase('idle')
      return
    }

    setFilterTransitionPhase('leaving')

    const swapTimer = window.setTimeout(() => {
      applyCategoryFilter(nextCategory, nextSubcategory)
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

  const openFilePicker = () => fileInputRef.current?.click()

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (files.length === 0) return

    const validFiles = files.filter(
      (file) =>
        SUPPORTED_CLOTHING_IMAGE_TYPES.some((type) => type === file.type) &&
        file.size <= MAX_CLOTHING_IMAGE_SIZE,
    )

    if (validFiles.length === 0) {
      pushToast('10MB 이하의 JPEG, PNG, WEBP만 추가할 수 있습니다.', 'error')
      return
    }

    const createdAt = Date.now()
    const pendingUploads = validFiles.map((file, index) => ({
      id: `upload-${createdAt}-${index}`,
      name: '새 옷',
      imageUrl: URL.createObjectURL(file),
    }))

    pushToast('AI가 옷 사진을 살펴보고 있어요 👀', 'info')

    if (validFiles.length !== files.length) {
      pushToast('일부 파일은 형식 또는 10MB 제한 때문에 제외했습니다.', 'error')
    }

    validFiles.forEach((file, index) => {
      const item = pendingUploads[index]

      void classifyClothing.mutateAsync(file)
        .then((classification) => {
          const cutoutImageUrl =
            classification.cutoutImageBase64 && classification.cutoutMimeType
              ? createImageObjectUrl(
                  classification.cutoutImageBase64,
                  classification.cutoutMimeType,
                )
              : null

          if (!cutoutImageUrl) {
            pushToast(
              `${item.name}의 배경을 제거하지 못해 원본으로 표시합니다.`,
              'error',
            )
          }

          enqueueClassification({
            itemId: item.id,
            imageUrl: cutoutImageUrl ?? item.imageUrl,
            originalImageUrl: cutoutImageUrl ? item.imageUrl : undefined,
            originalFilename: file.name,
            itemName:
              classification.suggestedName.trim() ||
              [classification.colorName, classification.subcategoryLabel]
                .map((value) => value.trim())
                .filter(Boolean)
                .join(' ') ||
              '새 옷',
            category: classification.category,
            subcategory: classification.subcategoryLabel,
            colorName: classification.colorName,
            colorDetailName: classification.colorDetailName,
            colorHex: classification.colorHex,
            colorRgb: classification.colorRgb,
            colorMode: classification.colorMode,
            fashionAttributes: classification.fashionAttributes ?? null,
            confidence: classification.confidence,
            model: classification.model,
            candidates: classification.candidates,
            analysisFailed: false,
          })
        })
        .catch((error: unknown) => {
          const rejectedImageCodes = new Set([
            'PERSON_DETECTED',
            'FASHION_ITEM_NOT_DETECTED',
            'MULTIPLE_FASHION_ITEMS_DETECTED',
            'UNCLEAR_FASHION_IMAGE',
          ])

          if (
            error instanceof ClothingAnalysisError &&
            error.code &&
            rejectedImageCodes.has(error.code)
          ) {
            URL.revokeObjectURL(item.imageUrl)
            pushToast(error.message, 'error')
            return
          }

          const message =
            error instanceof Error
              ? error.message
              : 'AI 이미지 분석에 실패했습니다.'

          pushToast(message, 'error')
          enqueueClassification({
            itemId: item.id,
            imageUrl: item.imageUrl!,
            originalFilename: file.name,
            itemName: item.name,
            category: null,
            subcategory: '',
            colorName: '',
            colorDetailName: '',
            colorHex: '#d9d5cc',
            colorRgb: [217, 213, 204],
            colorMode: null,
            fashionAttributes: null,
            confidence: null,
            model: null,
            candidates: [],
            analysisFailed: true,
          })
        })
    })
  }

  const handleItemClick = (itemId: string) => {
    const query = searchParams.toString()
    navigate(`/closet/${itemId}${query ? `?${query}` : ''}`)
  }

  const toggleItemSelection = (item: WardrobeItem) => {
    if (selectedIds.includes(item.id)) {
      setSelectedIds((currentIds) =>
        currentIds.filter((itemId) => itemId !== item.id),
      )
      return
    }

    if (!item.category) {
      pushToast('분류가 완료된 옷만 코디로 선택할 수 있습니다.', 'error')
      return
    }

    const getSelectionSlot = (candidate: WardrobeItem) => {
      if (candidate.category === 'dress') return 'top'
      if (candidate.category === 'other') return 'accessory'
      return candidate.category
    }
    const sameSlotItems = items.filter(
      (candidate) =>
        selectedIds.includes(candidate.id) &&
        getSelectionSlot(candidate) === getSelectionSlot(item),
    )
    const slotLimit = item.category === 'midlayer' ? 2 : 1

    if (sameSlotItems.length >= slotLimit) {
      pushToast(
        item.category === 'midlayer'
          ? '중간 아우터는 두 개까지 선택할 수 있어요.'
          : `${closetCategoryLabels[item.category]}는 한 개만 선택할 수 있어요.`,
        'error',
      )
      return
    }

    setSelectedIds((currentIds) => [...currentIds, item.id])
  }

  const sendToLookbook = () => {
    if (selectedIds.length < 2) return
    navigate(`/lookbook/new?items=${selectedIds.join(',')}`)
  }

  const viewInLookbook = () => {
    if (selectedIds.length === 0) return
    navigate(`/lookbook?items=${selectedIds.join(',')}`)
  }

  return (
    <section>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={handleFileChange}
        aria-label="옷 이미지 선택"
      />

      <ClosetPageHeader
        itemCount={items.length}
        analyzingCount={analyzingCount}
        onAddItem={openFilePicker}
      />
      {items.length > 0 && (
        <ClosetSearchFilter
          query={searchQuery}
          tags={availableTags}
          activeTag={selectedTag}
          onQueryChange={(query) => updateFilterParam('q', query)}
          onTagChange={(tag) => updateFilterParam('tag', tag)}
        />
      )}
      {items.length > 0 && (
        <SeasonFilter
          className="mt-4"
          value={activeSeason}
          onChange={(season) => updateFilterParam('season', season)}
        />
      )}
      <div
        className={filterTransitionClass}
        aria-busy={filterTransitionPhase !== 'idle'}
      >
        {items.length > 0 && (
          <div className="mt-3 flex min-w-0 items-start gap-2">
            {availableColors.length > 1 && (
              <ColorFilter
                value={activeColor}
                options={availableColors}
                onChange={(color) => updateFilterParam('color', color)}
              />
            )}
            <ClosetCategoryFilter
              className="min-w-0 flex-1"
              category={activeCategory}
              subcategory={activeSubcategory}
              availableCategories={availableCategories}
              availableSubcategories={availableSubcategories}
              onCategoryChange={(category) => changeFilter(category, null)}
              onSubcategoryChange={(subcategory) =>
                changeFilter(activeCategory, subcategory)
              }
            />
          </div>
        )}

        {filteredItems.length > 0 ? (
          <>
            {(searchQuery.trim() || selectedTag) && (
              <p className="mt-4 px-1 text-xs font-bold text-muted">
                검색 결과 {filteredItems.length}개
              </p>
            )}
            <div
              className={`${searchQuery.trim() || selectedTag ? 'mt-3' : 'mt-5'} grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4`}
            >
              {filteredItems.map((item) => (
                <ClosetItemCard
                  item={item}
                  isSelected={selectedIds.includes(item.id)}
                  onOpen={() => handleItemClick(item.id)}
                  onToggleSelection={() => toggleItemSelection(item)}
                  key={item.id}
                />
              ))}
            </div>
          </>
        ) : (
          <div
            className={
              items.length === 0
                ? 'mt-6 rounded-3xl border border-line bg-surface p-6 text-center sm:p-8'
                : 'mt-6 rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center'
            }
          >
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sage">
              <Shirt size={24} />
            </span>
            <h2
              className={`mt-5 font-black ${
                items.length === 0 ? 'text-xl' : 'text-lg'
              }`}
            >
              {items.length === 0
                ? '옷장이 비어 있어요'
                : searchQuery.trim()
                  ? '검색 결과가 없어요'
                  : selectedTag
                    ? `#${selectedTag} 태그의 옷이 없어요`
                : activeColor
                  ? `${activeColor} 색상 옷이 없어요`
                : activeSeason
                  ? `${seasonLabels[activeSeason]}에 입을 옷이 없어요`
                  : '이 카테고리에 저장된 옷이 없어요'}
            </h2>
            <p
              className={
                items.length === 0
                  ? 'mx-auto mt-2 max-w-md text-sm leading-7 text-muted'
                  : 'mt-2 text-sm text-muted'
              }
            >
              {items.length === 0
                ? '내 옷장에 옷 사진을 추가해보세요.'
                : searchQuery.trim() || selectedTag
                  ? '검색어를 바꾸거나 선택한 태그를 해제해보세요.'
                : activeColor
                  ? '다른 색상이나 카테고리를 선택해보세요.'
                : activeSeason
                  ? '다른 계절을 선택하거나 옷의 계절 정보를 수정해보세요.'
                  : '다른 카테고리를 확인하거나 새 옷을 추가해보세요.'}
            </p>
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <ClosetMultiSelectBar
          selectedItems={items.filter((item) => selectedIds.includes(item.id))}
          onClear={() => setSelectedIds([])}
          onViewInLookbook={viewInLookbook}
          onSendToLookbook={sendToLookbook}
        />
      )}

      <Outlet />
    </section>
  )
}
