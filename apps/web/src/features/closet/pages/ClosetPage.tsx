import { useEffect, useMemo, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import type {
  ClothingCategory,
  Season,
  WardrobeItem,
} from '@closet/types'
import { hasMinimumOutfitItems } from '@closet/types/outfit-items'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CatalogSearchField } from '../../../components/CatalogSearchField'
import { CatalogCardSkeletonGrid } from '../../../components/CatalogCardSkeletonGrid'
import { CatalogScrollRegion } from '../../../components/CatalogScrollRegion'
import { CatalogResults } from '../../../components/CatalogResults'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
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
import { ClosetFilters } from '../components/ClosetFilters'
import { ClosetFilterSelection } from '../components/ClosetFilterSelection'
import { ClosetItemCard } from '../components/ClosetItemCard'
import { ClosetMultiSelectBar } from '../components/ClosetMultiSelectBar'
import { ClosetPageHeader } from '../components/ClosetPageHeader'
import { WardrobeRediscoverySection } from '../components/WardrobeRediscoverySection'
import { WardrobeImageDropDialog } from '../components/WardrobeImageDropDialog'
import { WardrobePhotoAnalysisStatus } from '../components/WardrobePhotoAnalysisStatus'
import {
  WardrobeImageSourceDialog,
  WardrobePhotoReviewDialog,
} from '../components/WardrobeImagePickerDialogs'
import { useWardrobeImageAnalysis } from '../hooks/useWardrobeImageAnalysis'
import { useWardrobeImagePicker } from '../hooks/useWardrobeImagePicker'
import { useClosetFilterTransition } from '../hooks/useClosetFilterTransition'
import { getWardrobeBrandKey } from '../utils/wardrobeBrands'
import { readWardrobeFilterSelection, toggleWardrobeFilterSelection, writeWardrobeFilterSelection, type WardrobeFilterSelection } from '../utils/wardrobeFilters'
import { createOutfitComposerPath } from '../../lookbook/utils/outfitComposerNavigation'

/** 옷장 메뉴 → 옷 목록. 계절·카테고리는 상단에 유지하고 제목 옆 필터에서 색상·브랜드·태그를 복수 선택한다. 선택 칩은 URL 순서대로 가로로 쌓으며 목록 조회·사진 추가·코디 선택을 연결한다. */
export function ClosetPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const items = useClosetStore((state) => state.items)
  const pushToast = useUiStore((state) => state.pushToast)
  const analyzeImages = useWardrobeImageAnalysis((state) => state.analyzeImages)
  const analyzingCount = useWardrobeImageAnalysis((state) => state.analyzingCount)
  const openWardrobePhotoPicker = (location.state as { openWardrobePhotoPicker?: boolean } | null)?.openWardrobePhotoPicker === true
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
    initiallyOpen: openWardrobePhotoPicker,
    onImagesSelected: analyzeImages,
    onError: (message) => pushToast(message, 'error'),
  })
  // 첫 사진 진입 요청은 한 번만 사용해 브라우저 새로고침이나 뒤로 가기에서 다시 열지 않는다.
  useEffect(() => {
    if (openWardrobePhotoPicker) {
      void navigate(`${location.pathname}${location.search}${location.hash}`, {
        replace: true,
        state: null,
        preventScrollReset: true,
      })
    }
  }, [location.hash, location.pathname, location.search, navigate, openWardrobePhotoPicker])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // 목록 필터와 무관한 Store의 삭제·초기화에만 선택을 맞춰, 보관 삭제한 옷이 슬롯을 차지하지 않게 한다.
  useEffect(() => useClosetStore.subscribe((state) => {
    const remainingIds = new Set(state.items.map((item) => item.id))
    setSelectedIds((currentIds) => {
      const nextIds = currentIds.filter((id) => remainingIds.has(id))
      return nextIds.length === currentIds.length ? currentIds : nextIds
    })
  }), [])
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
  const { filterSelection, selectedColors, selectedBrands, selectedTags, includeUnbranded } = useMemo(() => {
    const selection = readWardrobeFilterSelection(searchParams)
    return {
      filterSelection: selection,
      selectedColors: selection.filter((item) => item.kind === 'color').map((item) => item.value),
      selectedBrands: selection.filter((item) => item.kind === 'brand').map((item) => item.value),
      selectedTags: selection.filter((item) => item.kind === 'tag').map((item) => item.value),
      includeUnbranded: selection.some((item) => item.kind === 'unbranded'),
    }
  }, [searchParams])
  const activeSubcategory = activeCategory
    ? searchParams.get('subcategory')
    : null
  const searchQuery = searchParams.get('q') ?? ''
  const settledSearch = useDebouncedValue(searchQuery)
  const sortOrder = searchParams.get('sort') === 'oldest' ? 'oldest' : 'latest'

  const filterOptions = useWardrobeFilterOptions(activeCategory, activeSubcategory)
  const wardrobeItemsQuery = useInfiniteWardrobeQuery({
    category: activeCategory, subcategory: activeSubcategory,
    season: activeSeason, colors: selectedColors, tags: selectedTags, brandNames: selectedBrands, includeUnbranded,
    search: settledSearch, sort: sortOrder,
  })
  const filteredItems = wardrobeItemsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const matchCount = wardrobeItemsQuery.data?.pages[0]?.totalCount ?? 0
  const hasActiveFilters = Boolean(activeCategory || activeSeason || filterSelection.length || searchQuery.trim())
  const isEmptyWardrobe = wardrobeItemsQuery.isSuccess && !wardrobeItemsQuery.isPlaceholderData &&
    (hasActiveFilters
      ? filterOptions.isSuccess && !filterOptions.isPlaceholderData && filterOptions.data.totalCount === 0
      : matchCount === 0)
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

  /** 세부 조건 하나를 토글한다. 새 선택은 URL과 칩 목록의 오른쪽 끝에 추가한다. */
  const toggleDetailFilter = (item: WardrobeFilterSelection) => {
    setSearchParams((params) => toggleWardrobeFilterSelection(params, item), { replace: true })
  }

  /** 삭제한 브랜드만 선택에서 빼고 미지정 옷을 포함한다. 함께 고른 다른 브랜드·색상·태그는 유지한다. */
  const handleSelectedBrandDeleted = (brand: string) => {
    setSearchParams((params) => {
      const selection = readWardrobeFilterSelection(params).filter((item) => item.kind !== 'brand' || getWardrobeBrandKey(item.value) !== getWardrobeBrandKey(brand))
      if (!selection.some((item) => item.kind === 'unbranded')) selection.push({ kind: 'unbranded', value: '1' })
      return writeWardrobeFilterSelection(params, selection)
    }, { replace: true })
  }

  /** 상단의 계절·카테고리와 검색어는 유지하고 서랍에서 고르는 세부 조건만 지운다. */
  const resetDetailFilters = () => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams)
      for (const key of ['color', 'brand', 'unbranded', 'tag', 'sort']) nextParams.delete(key)
      return nextParams
    }, { replace: true })
  }

  // 현재 카테고리의 응답을 받은 뒤 색상을 검증한다. 조회 중 유지한 이전 옵션으로 선택 색상을 지우지 않는다.
  useEffect(() => {
    if (!selectedColors.length || !filterOptions.data || filterOptions.isPlaceholderData) return
    const validColors = new Set(filterOptions.data.colors.map((color) => color.name))
    if (selectedColors.every((color) => validColors.has(color))) return

    setSearchParams(
      (currentParams) => {
        return writeWardrobeFilterSelection(currentParams, readWardrobeFilterSelection(currentParams).filter((item) => item.kind !== 'color' || validColors.has(item.value)))
      },
      { replace: true },
    )
  }, [selectedColors, filterOptions.data, filterOptions.isPlaceholderData, setSearchParams])

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
      pushToast('분류가 완료된 옷만 코디로 선택할 수 있어요.', 'error')
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

  const selectedItems = items.filter((item) => selectedIds.includes(item.id))
  const canCreateOutfit = hasMinimumOutfitItems(selectedItems)

  const sendToLookbook = () => {
    if (!canCreateOutfit) return
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
        analyzingCount={analyzingCount}
        isSearchOpen={isSearchOpen}
        onToggleSearch={toggleSearch}
        onAddItem={openPicker}
        filterControl={<ClosetFilters
          selection={filterSelection}
          colors={availableColors}
          tags={availableTags}
          isLoading={filterOptions.isPending}
          sortOrder={sortOrder}
          onToggle={toggleDetailFilter}
          onBrandDeleted={handleSelectedBrandDeleted}
          onSortChange={(order) => updateFilterParam('sort', order === 'oldest' ? 'oldest' : null)}
          onReset={resetDetailFilters}
        />}
      />
      <WardrobePhotoAnalysisStatus />
      <CatalogSearchField
        isOpen={isSearchOpen}
        value={searchQuery}
        onChange={(query) => updateFilterParam('q', query)}
        label="옷장 검색어"
        placeholder="이름, 브랜드, 종류, 색상 검색"
      />
      <SeasonFilter
        className="mt-6"
        value={activeSeason}
        onChange={(season) => {
          if (season !== activeSeason || wardrobeTransition.phase !== 'idle') wardrobeTransition.changeSeason(() => updateFilterParam('season', season))
        }}
      />
      <div
        className="closet-catalog"
      >
        <div className="closet-filter-row mt-2 flex min-h-10 items-center gap-2">
          <ClosetCategoryFilter
            className="min-w-0 flex-1"
            category={activeCategory}
            subcategory={activeSubcategory}
            availableCategories={availableCategories}
            availableSubcategories={availableSubcategories}
            isLoading={filterOptions.isPending}
            onCategoryChange={(category) => changeFilter(category, null)}
            onSubcategoryChange={(subcategory) =>
              changeFilter(activeCategory, subcategory)
            }
          />
        </div>
        <ClosetFilterSelection selection={filterSelection} colors={availableColors} onToggle={toggleDetailFilter} label="적용한 옷장 필터" />

        <CatalogScrollRegion label="옷장 목록" resetKey={searchParams.toString()}>
          {!isEmptyWardrobe && <WardrobeRediscoverySection
            visible={!hasActiveFilters && selectedIds.length === 0}
            onOpenItem={handleItemClick}
          />}
          <WardrobeCabinet
            key={activeSeason ?? 'all'}
            label={activeSeason ? `${seasonLabels[activeSeason]}에 입는 옷` : '전체 옷장'}
            countLabel={wardrobeItemsQuery.isPending ? '불러오는 중' : `${matchCount}개의 옷`}
            phase={wardrobeTransition.phase}
            contentClassName={filterTransition.contentClassName}
            isContentLoading={filterTransition.phase === 'waiting' || isSearchPending}
          >
            <CatalogResults
              resultKey={JSON.stringify([activeCategory, activeSubcategory, activeSeason, filterSelection, settledSearch, sortOrder])}
              isPending={isWaitingForItems || searchQuery !== settledSearch}
              animate={wardrobeTransition.phase === 'idle' && filterTransition.phase === 'idle'}
            >
            {(searchQuery.trim() || selectedTags.length > 0) && (wardrobeItemsQuery.isPending || filteredItems.length > 0) && (
              <p className="mt-4 px-1 text-xs font-bold text-muted">
                {wardrobeItemsQuery.isPending ? '검색 결과를 불러오는 중' : `검색 결과 ${matchCount}개`}
              </p>
            )}
            {wardrobeItemsQuery.isPending ? (
              <CatalogCardSkeletonGrid variant="wardrobe" />
            ) : filteredItems.length === 0 && wardrobeItemsQuery.isError ? (
              <div role="alert" className="mt-6 rounded-3xl border border-line bg-surface p-6 text-center">
                <h2 className="text-lg font-semibold">옷장을 불러오지 못했어요</h2>
                <p className="mt-2 text-sm text-muted">
                  서버 연결을 확인한 뒤 다시 시도해주세요. 저장된 옷이 없다는 뜻은 아니에요.
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  disabled={wardrobeItemsQuery.isFetching}
                  onClick={() => void wardrobeItemsQuery.refetch()}
                >
                  {wardrobeItemsQuery.isFetching ? '다시 불러오는 중…' : '다시 시도'}
                </button>
              </div>
            ) : filteredItems.length > 0 ? (
              <>
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
                  isEmptyWardrobe
                    ? 'mt-6 rounded-3xl border border-line bg-surface p-6 text-center sm:p-8'
                    : 'mt-6 rounded-3xl border border-dashed border-line bg-surface px-6 py-12 text-center'
                }
              >
                <WardrobeEmptyStateIllustration className="mx-auto size-28" />
                <h2
                  className={`mt-5 font-black ${
                    isEmptyWardrobe ? 'text-xl' : 'text-lg'
                  }`}
                >
                  {isEmptyWardrobe
                    ? '옷장이 비어 있어요'
                    : searchQuery.trim()
                      ? '검색 결과가 없어요'
                      : selectedTags.length > 0
                        ? selectedTags.length === 1 ? `#${selectedTags[0]} 태그의 옷이 없어요` : '선택한 태그의 옷이 없어요'
                    : selectedBrands.length > 0 || includeUnbranded
                      ? !selectedBrands.length && includeUnbranded ? '조건에 맞는 브랜드 미지정 옷이 없어요' : '선택한 브랜드와 조건에 맞는 옷이 없어요'
                    : selectedColors.length > 0
                      ? selectedColors.length === 1 ? `${selectedColors[0]} 색상 옷이 없어요` : '선택한 색상 옷이 없어요'
                    : activeSeason
                      ? `옷장이 ${seasonLabels[activeSeason]}옷을 기다리고 있어요`
                      : '이 카테고리에 저장된 옷이 없어요'}
                </h2>
                <p
                  className={
                    isEmptyWardrobe
                      ? 'mx-auto mt-2 max-w-md text-sm leading-7 text-muted'
                      : 'mt-2 text-sm text-muted'
                  }
                >
                  {isEmptyWardrobe
                    ? '내 옷장에 옷 사진을 추가해보세요.'
                    : searchQuery.trim() || selectedTags.length > 0
                      ? '검색어를 바꾸거나 선택한 태그를 해제해보세요.'
                    : selectedBrands.length > 0 || includeUnbranded
                      ? '선택한 브랜드를 해제하거나 다른 조건을 골라주세요.'
                    : selectedColors.length > 0
                      ? '다른 색상이나 카테고리를 선택해보세요.'
                    : activeSeason
                      ? '다른 계절을 선택하거나 옷의 계절 정보를 수정해보세요.'
                      : '다른 카테고리를 확인하거나 새 옷을 추가해보세요.'}
                </p>
                {isEmptyWardrobe && (
                  <button
                    type="button"
                    onClick={(event) => openPicker(event.currentTarget)}
                    disabled={analyzingCount > 0}
                    className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-surface focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50"
                  >
                    <ImagePlus size={16} aria-hidden="true" />첫 옷 사진 추가
                  </button>
                )}
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
          selectedItems={selectedItems}
          isReady={canCreateOutfit}
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
