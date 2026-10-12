import { useEffect, useState } from 'react'
import type {
  ClothingCategory,
  Season,
  WardrobeItem,
} from '@closet/types'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ColorFilter } from '../../../components/ColorFilter'
import { CatalogCardSkeletonGrid } from '../../../components/CatalogCardSkeletonGrid'
import { CatalogScrollRegion } from '../../../components/CatalogScrollRegion'
import { CatalogResults } from '../../../components/CatalogResults'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { DateSortButton } from '../../../components/DateSortButton'
import { SeasonFilter } from '../../../components/SeasonFilter'
import { WardrobeCabinet } from '../../../components/WardrobeCabinet'
import { useWardrobeTransition } from '../../../hooks/useWardrobeTransition'
import { WardrobeEmptyStateIllustration } from '../../../components/WardrobeEmptyStateIllustration'
import { seasonLabels } from '../../../constants/seasons'
import { useUiStore } from '../../../stores/useUiStore'
import { closetCategoryLabels } from '../constants'
import { useClosetStore } from '../stores/useClosetStore'
import { useInfiniteWardrobeQuery, useWardrobeFilterOptions } from '../../../lib/catalogQueries'
import { InfiniteScrollFooter } from '../../../components/InfiniteScrollFooter'
import { ClosetCategoryFilter } from '../components/ClosetCategoryFilter'
import { ClosetBrandFilter } from '../components/ClosetBrandFilter'
import { ClosetItemCard } from '../components/ClosetItemCard'
import { ClosetMultiSelectBar } from '../components/ClosetMultiSelectBar'
import { ClosetPageHeader } from '../components/ClosetPageHeader'
import { ClosetSearchFilter } from '../components/ClosetSearchFilter'
import { WardrobeImageDropDialog } from '../components/WardrobeImageDropDialog'
import {
  WardrobeImageSourceDialog,
  WardrobePhotoReviewDialog,
} from '../components/WardrobeImagePickerDialogs'
import { useWardrobeImageAnalysis } from '../hooks/useWardrobeImageAnalysis'
import { useWardrobeImagePicker } from '../hooks/useWardrobeImagePicker'
import { useClosetFilterTransition } from '../hooks/useClosetFilterTransition'
import { normalizeWardrobeBrand } from '../utils/wardrobeBrands'
import { createOutfitComposerPath } from '../../lookbook/utils/outfitComposerNavigation'

/** 옷장 메뉴 → 옷 목록. 상단 필터는 유지하고 목록만 스크롤하며, 종류 전환에서는 새 조건의 조회가 끝난 뒤 목록을 들여온다. 옷 선택·상세 열기와 사진 추가를 연결한다. */
export function ClosetPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const items = useClosetStore((state) => state.items)
  const pushToast = useUiStore((state) => state.pushToast)
  const { analyzeImages, analyzingCount } = useWardrobeImageAnalysis()
  const {
    isNativeApp,
    addButtonRef,
    albumInputRef,
    cameraInputRef,
    capturedPhoto,
    pickerStep,
    openPicker,
    closePicker,
    chooseAlbum,
    acceptImages,
    startCameraCapture,
    handleAlbumChange,
    handleCameraChange,
    retakePhoto,
    useCapturedPhoto,
  } = useWardrobeImagePicker({
    onImagesSelected: analyzeImages,
    onError: (message) => pushToast(message, 'error'),
  })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSearchOpen, setIsSearchOpen] = useState(() =>
    Boolean(searchParams.get('q')?.trim()),
  )
  const categoryParam = searchParams.get('category')
  const activeCategory =
    categoryParam && categoryParam in closetCategoryLabels
      ? (categoryParam as ClothingCategory)
      : null
  const seasonParam = searchParams.get('season')
  const activeSeason =
    seasonParam && seasonParam in seasonLabels ? (seasonParam as Season) : null
  const activeColor = searchParams.get('color')
  const activeBrand = normalizeWardrobeBrand(searchParams.get('brand') ?? '') || null
  const unbrandedOnly = searchParams.get('unbranded') === '1'
  const activeSubcategory = activeCategory
    ? searchParams.get('subcategory')
    : null
  const searchQuery = searchParams.get('q') ?? ''
  const settledSearch = useDebouncedValue(searchQuery)
  const activeTag = searchParams.get('tag')
  const sortOrder = searchParams.get('sort') === 'oldest' ? 'oldest' : 'latest'

  const filterOptions = useWardrobeFilterOptions(activeCategory, activeSubcategory)
  const selectedColor = activeColor
  const selectedTag = activeTag
  const wardrobeItemsQuery = useInfiniteWardrobeQuery({
    category: activeCategory, subcategory: activeSubcategory,
    season: activeSeason, color: selectedColor, tag: selectedTag, brandName: activeBrand, unbrandedOnly,
    search: settledSearch, sort: sortOrder,
  })
  const filteredItems = wardrobeItemsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const totalCount = filterOptions.data?.totalCount ?? wardrobeItemsQuery.data?.pages[0]?.totalCount ?? 0
  const matchCount = wardrobeItemsQuery.data?.pages[0]?.totalCount ?? 0
  const isWaitingForItems = wardrobeItemsQuery.isPending || wardrobeItemsQuery.isPlaceholderData
  const isSearchPending = searchQuery !== settledSearch || wardrobeItemsQuery.isPlaceholderData
  const wardrobeTransition = useWardrobeTransition(isWaitingForItems || (wardrobeItemsQuery.isFetching && filteredItems.length === 0))
  const filterTransition = useClosetFilterTransition(
    JSON.stringify([activeCategory, activeSubcategory]),
    isWaitingForItems || filterOptions.isPlaceholderData,
  )
  const availableCategories = (Object.keys(closetCategoryLabels) as ClothingCategory[])
    .filter((category) => filterOptions.data?.categories.includes(category))
  const availableColors = filterOptions.data?.colors ?? []
  const availableTags = filterOptions.data?.tags ?? []
  const availableSubcategories = filterOptions.data?.subcategories ?? []

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

  const toggleSearch = () => {
    if (isSearchOpen) updateFilterParam('q', null)
    setIsSearchOpen((currentValue) => !currentValue)
  }

  /** 브랜드 선택과 미지정 조건을 서로 겹치지 않게 저장하고 다른 종류·계절·색 조건은 유지한다. */
  const updateBrandFilter = (brand: string | null, missing = false) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      if (brand && !missing) nextParams.set('brand', brand)
      else nextParams.delete('brand')
      if (missing) nextParams.set('unbranded', '1')
      else nextParams.delete('unbranded')
      return nextParams
    }, { replace: true })
  }

  // 현재 카테고리의 응답을 받은 뒤 색상을 검증한다. 조회 중 유지한 이전 옵션으로 선택 색상을 지우지 않는다.
  useEffect(() => {
    if (!activeColor || !filterOptions.data || filterOptions.isPlaceholderData || filterOptions.data.colors.some((color) => color.name === activeColor)) return

    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.delete('color')
        return nextParams
      },
      { replace: true },
    )
  }, [activeColor, filterOptions.data, filterOptions.isPlaceholderData, setSearchParams])

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
      nextSubcategory === activeSubcategory &&
      filterTransition.phase === 'idle'
    ) {
      return
    }

    filterTransition.changeFilter(
      JSON.stringify([nextCategory, nextSubcategory]),
      () => applyCategoryFilter(nextCategory, nextSubcategory),
    )
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
    navigate(
      createOutfitComposerPath(
        selectedIds,
        `${location.pathname}${location.search}${location.hash}`,
      ),
    )
  }

  const viewInLookbook = () => {
    if (selectedIds.length === 0) return
    navigate(`/lookbook?items=${selectedIds.join(',')}`)
  }

  return (
    <section className={`closet-page ${selectedIds.length > 0 ? 'has-selection' : ''}`}>
      <input
        ref={albumInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        tabIndex={-1}
        className="sr-only"
        onChange={handleAlbumChange}
        aria-label={isNativeApp ? '앨범에서 옷 이미지 선택' : '옷 사진 파일 선택'}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        tabIndex={-1}
        aria-hidden={!isNativeApp}
        className="sr-only"
        onChange={handleCameraChange}
        aria-label="카메라로 옷 사진 촬영"
      />

      <ClosetPageHeader
        addButtonRef={addButtonRef}
        itemCount={totalCount}
        analyzingCount={analyzingCount}
        isSearchOpen={isSearchOpen}
        onToggleSearch={toggleSearch}
        onAddItem={openPicker}
      />
      {totalCount > 0 && (
        <ClosetSearchFilter
          query={searchQuery}
          tags={availableTags}
          activeTag={selectedTag}
          isSearchOpen={isSearchOpen}
          onQueryChange={(query) => updateFilterParam('q', query)}
          onTagChange={(tag) => updateFilterParam('tag', tag)}
        />
      )}
      {totalCount > 0 && (
        <SeasonFilter
          className="mt-6"
          value={activeSeason}
          onChange={(season) => {
            if (season !== activeSeason || wardrobeTransition.phase !== 'idle') wardrobeTransition.changeSeason(() => updateFilterParam('season', season))
          }}
        />
      )}
      <div
        className="closet-catalog"
      >
        {totalCount > 0 && (
          <div className="mt-2">
            <div className="flex min-h-9 items-center gap-2">
              <DateSortButton
                value={sortOrder}
                onChange={(nextOrder) =>
                  updateFilterParam(
                    'sort',
                    nextOrder === 'oldest' ? 'oldest' : null,
                  )
                }
              />
              {availableColors.length > 1 && (
                <ColorFilter
                  value={selectedColor}
                  options={availableColors}
                  onChange={(color) => updateFilterParam('color', color)}
                />
              )}
              <ClosetBrandFilter
                value={activeBrand}
                unbrandedOnly={unbrandedOnly}
                onChange={updateBrandFilter}
              />
            </div>
            <ClosetCategoryFilter
              className="mt-1"
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

        <CatalogScrollRegion label="옷장 목록" resetKey={searchParams.toString()}>
          <WardrobeCabinet
            key={activeSeason ?? 'all'}
            label={activeSeason ? `${seasonLabels[activeSeason]}에 입는 옷` : '전체 옷장'}
            countLabel={`${matchCount}개의 옷`}
            phase={wardrobeTransition.phase}
            contentClassName={filterTransition.contentClassName}
            isContentLoading={filterTransition.phase === 'waiting' || isSearchPending}
          >
            <CatalogResults
              resultKey={JSON.stringify([activeCategory, activeSubcategory, activeSeason, selectedColor, selectedTag, activeBrand, unbrandedOnly, settledSearch, sortOrder])}
              isPending={isWaitingForItems || searchQuery !== settledSearch}
              animate={wardrobeTransition.phase === 'idle' && filterTransition.phase === 'idle'}
            >
            {wardrobeItemsQuery.isPending ? (
              <CatalogCardSkeletonGrid variant="wardrobe" />
            ) : filteredItems.length === 0 && wardrobeItemsQuery.isError ? (
              <div role="alert" className="mt-6 rounded-3xl border border-line bg-surface p-6 text-center">
                <h2 className="text-lg font-black">옷장을 불러오지 못했어요</h2>
                <p className="mt-2 text-sm text-muted">
                  서버 연결을 확인한 뒤 다시 시도해주세요. 저장된 옷이 없다는 뜻은 아니에요.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  disabled={wardrobeItemsQuery.isFetching}
                  onClick={() => void wardrobeItemsQuery.refetch()}
                >
                  {wardrobeItemsQuery.isFetching ? '다시 불러오는 중...' : '다시 시도'}
                </button>
              </div>
            ) : filteredItems.length > 0 ? (
              <>
                {(searchQuery.trim() || selectedTag) && (
                  <p className="mt-4 px-1 text-xs font-bold text-muted">
                    검색 결과 {matchCount}개
                  </p>
                )}
                <div
                  className="wardrobe-item-grid grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4"
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
                  totalCount === 0
                    ? 'mt-6 rounded-3xl border border-line bg-surface p-6 text-center sm:p-8'
                    : 'mt-6 rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center'
                }
              >
                <WardrobeEmptyStateIllustration className="mx-auto size-28" />
                <h2
                  className={`mt-5 font-black ${
                    totalCount === 0 ? 'text-xl' : 'text-lg'
                  }`}
                >
                  {totalCount === 0
                    ? '옷장이 비어 있어요'
                    : searchQuery.trim()
                      ? '검색 결과가 없어요'
                      : selectedTag
                        ? `#${selectedTag} 태그의 옷이 없어요`
                    : activeBrand || unbrandedOnly
                      ? unbrandedOnly ? '조건에 맞는 브랜드 미지정 옷이 없어요' : '선택한 브랜드와 조건에 맞는 옷이 없어요'
                    : selectedColor
                      ? `${selectedColor} 색상 옷이 없어요`
                    : activeSeason
                      ? `옷장이 ${seasonLabels[activeSeason]}옷을 기다리고 있어요`
                      : '이 카테고리에 저장된 옷이 없어요'}
                </h2>
                <p
                  className={
                    totalCount === 0
                      ? 'mx-auto mt-2 min-h-14 max-w-md text-sm leading-7 text-muted'
                      : 'mt-2 text-sm text-muted'
                  }
                >
                  {totalCount === 0
                    ? '내 옷장에 옷 사진을 추가해보세요.'
                    : searchQuery.trim() || selectedTag
                      ? '검색어를 바꾸거나 선택한 태그를 해제해보세요.'
                    : activeBrand || unbrandedOnly
                      ? '브랜드를 전체로 바꾸거나 다른 필터를 선택해보세요.'
                    : selectedColor
                      ? '다른 색상이나 카테고리를 선택해보세요.'
                    : activeSeason
                      ? '다른 계절을 선택하거나 옷의 계절 정보를 수정해보세요.'
                      : '다른 카테고리를 확인하거나 새 옷을 추가해보세요.'}
                </p>
              </div>
            )}
            </CatalogResults>
          </WardrobeCabinet>
          {filteredItems.length > 0 && (
            <InfiniteScrollFooter
              hasNextPage={wardrobeItemsQuery.hasNextPage}
              isFetching={wardrobeItemsQuery.isFetching}
              isError={wardrobeItemsQuery.isFetchNextPageError}
              onLoadMore={wardrobeItemsQuery.fetchNextPage}
            />
          )}
        </CatalogScrollRegion>
      </div>

      {selectedIds.length > 0 && (
        <ClosetMultiSelectBar
          selectedItems={items.filter((item) => selectedIds.includes(item.id))}
          onClear={() => setSelectedIds([])}
          onViewInLookbook={viewInLookbook}
          onSendToLookbook={sendToLookbook}
        />
      )}

      {!isNativeApp && pickerStep === 'source' && (
        <WardrobeImageDropDialog
          onChooseFiles={chooseAlbum}
          onImagesSelected={acceptImages}
          onCancel={closePicker}
        />
      )}
      {isNativeApp && (pickerStep === 'source' || pickerStep === 'capturing') && (
        <WardrobeImageSourceDialog
          isCapturing={pickerStep === 'capturing'}
          onCapture={startCameraCapture}
          onChooseAlbum={chooseAlbum}
          onCancel={closePicker}
        />
      )}
      {pickerStep === 'review' && capturedPhoto && (
        <WardrobePhotoReviewDialog
          previewUrl={capturedPhoto.previewUrl}
          onRetake={retakePhoto}
          onUse={useCapturedPhoto}
          onCancel={closePicker}
        />
      )}
      <Outlet />
    </section>
  )
}
