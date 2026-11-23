import { useState } from 'react'
import type { Season } from '@closet/types'
import { X } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { LookbookPageHeader } from '../components/LookbookPageHeader'
import { LookbookFilters } from '../components/LookbookFilters'
import { LookbookViewSwitch } from '../components/LookbookViewSwitch'
import type { LookbookViewMode } from '../types'
import { CatalogCardSkeletonGrid } from '../../../components/CatalogCardSkeletonGrid'
import { CatalogScrollRegion } from '../../../components/CatalogScrollRegion'
import { CatalogResults } from '../../../components/CatalogResults'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { WardrobeCabinet } from '../../../components/WardrobeCabinet'
import { useWardrobeTransition } from '../../../hooks/useWardrobeTransition'
import { WardrobeEmptyStateIllustration } from '../../../components/WardrobeEmptyStateIllustration'
import { seasonLabels } from '../../../constants/seasons'
import { getOutfitStyleLabel } from '../../../constants/styleOptions'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { useSavedOutfitQuery } from '../api/lookbookQueries'
import { LookbookOutfitCard } from '../components/LookbookOutfitCard'
import { OutfitDetailModal } from '../components/OutfitDetailModal'
import { OutfitFilterControls } from '../components/OutfitFilterControls'
import { useOutfitWearSummaries } from '../hooks/useOutfitWearSummaries'
import { useInfiniteOutfitsQuery, useOutfitFilterOptions } from '../../../lib/catalogQueries'
import { InfiniteScrollFooter } from '../../../components/InfiniteScrollFooter'
import { outfitStyleOptions } from '../../../constants/styleOptions'
import {
  createOutfitSearchTokens,
} from '../utils/outfitFilters'
import { createOutfitComposerPath } from '../utils/outfitComposerNavigation'
import { getOutfitPreviewCompositionKey } from '../utils/outfitPreviewCache'
import { useTemperatureWearHistory } from '../../wear-history/api/wearHistoryQueries'
import { OutfitWearRecords } from '../../wear-history/components/OutfitWearRecords'
import { WearHistoryCard } from '../../wear-history/components/WearHistoryCard'
import { WearHistoryRecords } from '../../wear-history/components/WearHistoryRecords'
import type { WearHistoryGroup } from '../../wear-history/types'
import { temperatureRanges } from '../../wear-history/utils/temperatureHistory'

/** 저장 코디를 조건별로 보여준다. 기존 코디 링크는 목록의 필터나 페이지에 관계없이 해당 상세를 연다. */
export function LookbookPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const items = useClosetStore((state) => state.items)
  const [activeStyle, setActiveStyle] = useState('all')
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const settledSearch = useDebouncedValue(searchQuery)
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null)
  const [selectedWearGroup, setSelectedWearGroup] = useState<WearHistoryGroup | null>(null)
  const linkedOutfitId = searchParams.get('outfit') ?? ''
  const linkedPreviewAssetId = linkedOutfitId && searchParams.get('preview') === 'open'
    ? searchParams.get('previewAssetId')
    : null
  const sortOrder = searchParams.get('sort') === 'oldest' ? 'oldest' : 'latest'
  const rawTemperatureRange = searchParams.get('wearTemperature')
  const temperatureFilter = temperatureRanges.find((range) => range.value !== 'all' && range.value === rawTemperatureRange)
  const temperatureRange = temperatureFilter?.value ?? (rawTemperatureRange === 'worn' ? 'worn' : '')
  const isWearFiltered = temperatureRange !== ''
  // URL에 저장한 보기 옵션. ai가 기본이며 조회 조건이나 저장된 코디 데이터에는 포함하지 않는다.
  const viewMode: LookbookViewMode = searchParams.get('view') === 'items' ? 'items' : 'ai'
  const selectedItemIds = (searchParams.get('items') ?? '')
    .split(',')
    .filter(Boolean)
  const selectedItems = items.filter((item) =>
    selectedItemIds.includes(item.id),
  )
  const outfitsQuery = useInfiniteOutfitsQuery({
    style: activeStyle, season: activeSeason, color: activeColor,
    search: settledSearch, sort: sortOrder, wardrobeItemIds: selectedItemIds,
  })
  const wearHistory = useTemperatureWearHistory({ ...temperatureFilter?.input, limit: 12, outfitFilter: {
    style: activeStyle, season: activeSeason, color: activeColor,
    search: settledSearch, sort: sortOrder, wardrobeItemIds: selectedItemIds,
  } }, isWearFiltered)
  const wearGroups = wearHistory.data?.pages.flatMap((page) => page.items) ?? []
  const outfits = outfitsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const isWaitingForOutfits = outfitsQuery.isPending || outfitsQuery.isPlaceholderData
  const isSearchPending = searchQuery !== settledSearch || outfitsQuery.isPlaceholderData
  const wardrobeTransition = useWardrobeTransition(isWaitingForOutfits || (outfitsQuery.isFetching && outfits.length === 0))
  const filterOptions = useOutfitFilterOptions()
  const totalCount = filterOptions.data?.totalCount ?? outfitsQuery.data?.pages[0]?.totalCount ?? 0
  const activeOutfitId = linkedOutfitId || selectedOutfitId
  const listedOutfit = outfits.find((outfit) => outfit.id === activeOutfitId)
  const linkedOutfitQuery = useSavedOutfitQuery(listedOutfit ? '' : linkedOutfitId)
  const selectedOutfit = listedOutfit ?? linkedOutfitQuery.data
  const wearSummaries = useOutfitWearSummaries(
    [...outfits.map((outfit) => outfit.id), ...(selectedOutfit && !listedOutfit ? [selectedOutfit.id] : [])],
    { includeUnworn: true },
  )
  const visibleStyleOptions = [
    ...outfitStyleOptions,
    ...(filterOptions.data?.styles ?? [])
      .filter((style) => !outfitStyleOptions.some((option) => option.value === style))
      .map((style) => ({ label: style, value: style })),
  ]
  const colorOptions = filterOptions.data?.colors ?? []
  const searchTokens = createOutfitSearchTokens(searchQuery)
  const visibleOutfits = outfits
  const clearCompletedPreviewParams = (params: URLSearchParams) => {
    for (const key of ['preview', 'previewAssetId', 'previewItems', 'previewStyle']) params.delete(key)
  }
  /** 완료 미리보기만 닫고 URL의 저장 코디 상세는 유지한다. */
  const closeCompletedPreview = () => {
    const nextParams = new URLSearchParams(searchParams)
    clearCompletedPreviewParams(nextParams)
    setSearchParams(nextParams, { replace: true })
  }
  const closeOutfit = () => {
    setSelectedOutfitId(null)
    if (!linkedOutfitId) return
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('outfit')
    clearCompletedPreviewParams(nextSearchParams)
    setSearchParams(nextSearchParams, { replace: true })
  }

  const clearItemFilter = () => {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('items')
    setSearchParams(nextSearchParams, { replace: true })
  }

  const toggleSearch = () => {
    if (isSearchOpen) setSearchQuery('')
    setIsSearchOpen(!isSearchOpen)
  }

  const changeSortOrder = (nextOrder: 'latest' | 'oldest') => {
    const nextSearchParams = new URLSearchParams(searchParams)
    if (nextOrder === 'oldest') nextSearchParams.set('sort', 'oldest')
    else nextSearchParams.delete('sort')
    setSearchParams(nextSearchParams, { replace: true })
  }

  const changeTemperatureRange = (range: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (range) nextParams.set('wearTemperature', range)
    else nextParams.delete('wearTemperature')
    setSearchParams(nextParams, { replace: true })
  }

  const resetDrawerFilters = () => {
    setActiveColor(null)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('wearTemperature')
    nextParams.delete('sort')
    setSearchParams(nextParams, { replace: true })
  }

  /** 기존 정렬·아이템 필터를 유지한 채 목록의 이미지 보기 옵션만 URL에 반영한다. */
  const changeViewMode = (nextMode: LookbookViewMode) => {
    const nextSearchParams = new URLSearchParams(searchParams)
    if (nextMode === 'items') nextSearchParams.set('view', 'items')
    else nextSearchParams.delete('view')
    setSearchParams(nextSearchParams, { replace: true })
  }

  const openSelectedItemsComposer = () => {
    navigate(
      createOutfitComposerPath(
        selectedItemIds,
        `${location.pathname}${location.search}${location.hash}`,
      ),
    )
  }

  return (
    <section className="lookbook-page">
      <LookbookPageHeader
        isSearchOpen={isSearchOpen}
        onToggleSearch={toggleSearch}
        onCreate={() => navigate('/lookbook/new')}
        filterControl={<LookbookFilters color={activeColor} colors={colorOptions} isLoading={filterOptions.isPending} sortOrder={sortOrder} onColorChange={setActiveColor} onSortChange={changeSortOrder}
          temperatureRange={temperatureRange} onTemperatureRangeChange={changeTemperatureRange} onReset={resetDrawerFilters}
          viewControl={<LookbookViewSwitch value={viewMode} onChange={changeViewMode} />} />}
      />
      {linkedOutfitId && !selectedOutfit && (
        linkedOutfitQuery.isPending ? (
          <p role="status" className="mt-4 text-sm text-muted">저장한 코디를 불러오는 중이에요.</p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-sm">
            <p role="alert" className="mr-auto">저장한 코디를 열지 못했어요.</p>
            {linkedOutfitQuery.isError && (
              <button type="button" className="min-h-10 px-2 font-semibold text-accent" onClick={() => void linkedOutfitQuery.refetch()}>다시 시도</button>
            )}
            <button type="button" className="min-h-10 px-2 text-muted" onClick={closeOutfit}>닫기</button>
          </div>
        )
      )}

      <OutfitFilterControls
        activeSeason={activeSeason}
        activeStyle={activeStyle}
        isSearchOpen={isSearchOpen}
        searchQuery={searchQuery}
        styleOptions={visibleStyleOptions}
        onSeasonChange={(season) => {
          if (season !== activeSeason || wardrobeTransition.phase !== 'idle') wardrobeTransition.changeSeason(() => setActiveSeason(season))
        }}
        onStyleChange={setActiveStyle}
        onSearchChange={setSearchQuery}
      />

      {selectedItemIds.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3">
          <span className="min-w-0 flex-1 text-sm">
            <strong className="font-black">
              {selectedItems.length > 0
                ? selectedItems.map((item) => item.name).join(', ')
                : `${selectedItemIds.length}개 아이템`}
            </strong>
            <span className="text-muted"> 포함 코디만 보는 중</span>
          </span>
          <button
            type="button"
            onClick={clearItemFilter}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-muted transition hover:text-ink"
            aria-label="아이템 필터 해제"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <CatalogScrollRegion
        label="코디북 목록"
        resetKey={JSON.stringify([activeSeason, activeStyle, activeColor, settledSearch, sortOrder, selectedItemIds, temperatureRange])}
      >
        {isWearFiltered ? <WardrobeCabinet
          label={temperatureFilter?.label ?? '입었던 코디'}
          countLabel={wearHistory.isPending ? '불러오는 중' : `${wearHistory.data?.pages[0]?.totalCount ?? 0}개의 코디`}
        >
          {wearHistory.isPending || searchQuery !== settledSearch ? <CatalogCardSkeletonGrid variant="outfit" />
            : wearHistory.isError && !wearGroups.length ? <div role="alert" className="py-10 text-center text-sm">
              착용 기록을 불러오지 못했어요. <button type="button" onClick={() => void wearHistory.refetch()} className="font-semibold text-accent underline">다시 시도</button>
            </div> : wearGroups.length > 0 ? (
              <div className="lookbook-cover-grid grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                {wearGroups.map((group) => <WearHistoryCard key={group.id} group={group} viewMode={viewMode} onOpen={() => setSelectedWearGroup(group)} />)}
              </div>
            ) : <p className="py-10 text-center text-sm text-muted">조건에 맞는 착용 기록이 없어요.</p>}
          {wearGroups.length > 0 && <InfiniteScrollFooter hasNextPage={wearHistory.hasNextPage}
            isFetching={wearHistory.isFetchingNextPage} isError={wearHistory.isFetchNextPageError} onLoadMore={wearHistory.fetchNextPage} />}
        </WardrobeCabinet> : <WardrobeCabinet
          key={activeSeason ?? 'all'}
          label={activeSeason ? `${seasonLabels[activeSeason]}에 입을 코디` : '모아둔 코디'}
          countLabel={outfitsQuery.isPending ? '불러오는 중' : `${outfitsQuery.data?.pages[0]?.totalCount ?? 0}개의 코디`}
          phase={wardrobeTransition.phase}
          isContentLoading={isSearchPending}
        >
          <CatalogResults
            resultKey={JSON.stringify([activeSeason, activeStyle, activeColor, settledSearch, sortOrder, selectedItemIds, viewMode])}
            isPending={isWaitingForOutfits || searchQuery !== settledSearch}
            animate={wardrobeTransition.phase === 'idle'}
          >
          {outfitsQuery.isPending ? (
            <CatalogCardSkeletonGrid variant="outfit" />
          ) : outfitsQuery.isError && outfits.length === 0 ? (
            <div role="alert" className="mt-6 rounded-3xl border border-line bg-surface p-6 text-center">
              <p>코디북을 불러오지 못했어요.</p>
              <button type="button" className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-bold text-white"
                onClick={() => void outfitsQuery.refetch()}>다시 시도</button>
            </div>
          ) : totalCount === 0 ? (
            <div className="mt-6 rounded-3xl border border-line bg-surface p-6 text-center sm:p-8">
              <WardrobeEmptyStateIllustration
                className="mx-auto size-28"
                variant="lookbook"
              />
              <h2 className="mt-5 text-xl font-semibold">
                {selectedItemIds.length > 0
                  ? '이 옷이 들어간 코디가 아직 없어요'
                  : '아직 저장한 코디가 없어요'}
              </h2>
              <p className="mx-auto mt-2 min-h-14 max-w-md text-sm leading-7 text-muted">
                {selectedItemIds.length > 0
                  ? '선택한 아이템을 미리 넣은 상태로 새 코디를 만들 수 있어요.'
                  : '내 옷장에서 아이템을 골라 코디를 저장해보세요.'}
              </p>
              {selectedItemIds.length > 0 && (
                <button
                  type="button"
                  onClick={openSelectedItemsComposer}
                  className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
                >
                  이 옷으로 코디 만들기
                </button>
              )}
            </div>
          ) : visibleOutfits.length > 0 ? (
            <div className="lookbook-cover-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {visibleOutfits.map((outfit, index) => (
                <LookbookOutfitCard
                  key={outfit.id}
                  outfit={outfit}
                  items={items}
                  viewMode={viewMode}
                  order={index + 1}
                  wearSummary={wearSummaries.get(outfit.id)}
                  onSelect={setSelectedOutfitId}
                />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
              <WardrobeEmptyStateIllustration
                className="mx-auto size-28"
                variant="lookbook"
              />
              <h2 className="mt-5 text-lg font-semibold">
                {searchTokens.length > 0
                  ? '검색 결과가 없어요'
                  : selectedItemIds.length > 0
                  ? '선택한 옷이 들어간 코디가 없어요'
                  : activeSeason
                    ? `${seasonLabels[activeSeason]} 코디가 없어요`
                    : activeColor
                      ? `${activeColor} 색상이 들어간 코디가 없어요`
                    : activeStyle !== 'all'
                      ? `${getOutfitStyleLabel(activeStyle)} 코디가 없어요`
                      : '조건에 맞는 코디가 없어요'}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {searchTokens.length > 0
                  ? '다른 코디 이름이나 옷 이름, 색상으로 다시 검색해보세요.'
                  : selectedItemIds.length > 0
                  ? '선택한 아이템을 그대로 넣어 새 코디를 만들어보세요.'
                  : '코디를 만들고 이 스타일로 저장해보세요.'}
              </p>
              {selectedItemIds.length > 0 && (
                <button
                  type="button"
                  onClick={openSelectedItemsComposer}
                  className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
                >
                  이 옷으로 코디 만들기
                </button>
              )}
            </div>
          )}
          </CatalogResults>
        </WardrobeCabinet>}
        {!isWearFiltered && outfits.length > 0 && (
          <InfiniteScrollFooter
            hasNextPage={outfitsQuery.hasNextPage}
            isFetching={outfitsQuery.isFetching}
            isError={outfitsQuery.isFetchNextPageError}
            onLoadMore={outfitsQuery.fetchNextPage}
          />
        )}
      </CatalogScrollRegion>
      {selectedOutfit && (
        <OutfitDetailModal
          key={selectedOutfit.id}
          outfit={selectedOutfit}
          wearSummary={wearSummaries.get(selectedOutfit.id)}
          items={items}
          completedPreview={linkedPreviewAssetId ? {
            assetId: linkedPreviewAssetId,
            compositionKey: getOutfitPreviewCompositionKey(
              (searchParams.get('previewItems') ?? '').split(',').filter(Boolean),
              searchParams.get('previewStyle') ?? '',
            ),
            onClose: closeCompletedPreview,
          } : undefined}
          readDetails={<OutfitWearRecords itemIds={selectedOutfit.layers.map((layer) => layer.wardrobeItemId).sort()} />}
          onClose={closeOutfit}
          onCreatedVariation={(created) => {
            setSelectedOutfitId(null)
            const nextParams = new URLSearchParams(searchParams)
            clearCompletedPreviewParams(nextParams)
            nextParams.set('outfit', created.id)
            setSearchParams(nextParams, { replace: true })
          }}
        />
      )}
      {selectedWearGroup && !linkedOutfitId && <OutfitDetailModal key={selectedWearGroup.id} readOnly outfit={selectedWearGroup.outfit} items={items}
        onClose={() => setSelectedWearGroup(null)} readDetails={<WearHistoryRecords records={selectedWearGroup.records} />} />}
    </section>
  )
}
