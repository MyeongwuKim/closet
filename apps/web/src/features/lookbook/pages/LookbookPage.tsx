import { useState } from 'react'
import type { Season } from '@closet/types'
import { X } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { LookbookPageHeader } from '../components/LookbookPageHeader'
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

/** 코디북 메뉴 → 저장한 코디 목록. 계절·스타일·색상·검색 조건으로 조회하고, URL의 view 옵션으로 같은 코디의 AI 이미지와 옷 사진 표현을 전환한다. */
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
  const sortOrder = searchParams.get('sort') === 'oldest' ? 'oldest' : 'latest'
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
  const outfits = outfitsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const isWaitingForOutfits = outfitsQuery.isPending || outfitsQuery.isPlaceholderData
  const isSearchPending = searchQuery !== settledSearch || outfitsQuery.isPlaceholderData
  const wardrobeTransition = useWardrobeTransition(isWaitingForOutfits || (outfitsQuery.isFetching && outfits.length === 0))
  const filterOptions = useOutfitFilterOptions()
  const totalCount = filterOptions.data?.totalCount ?? outfitsQuery.data?.pages[0]?.totalCount ?? 0
  const wearSummaries = useOutfitWearSummaries(
    outfits.map((outfit) => outfit.id),
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
  const selectedOutfit = outfits.find(
    (outfit) => outfit.id === selectedOutfitId,
  )

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
        outfitCount={totalCount}
        isSearchOpen={isSearchOpen}
        onToggleSearch={toggleSearch}
        onCreate={() => navigate('/lookbook/new')}
      />

      {totalCount > 0 && (
        <OutfitFilterControls
          activeSeason={activeSeason}
          activeStyle={activeStyle}
          activeColor={activeColor}
          colorOptions={colorOptions}
          isSearchOpen={isSearchOpen}
          searchQuery={searchQuery}
          sortOrder={sortOrder}
          styleOptions={visibleStyleOptions}
          onSeasonChange={(season) => {
            if (season !== activeSeason || wardrobeTransition.phase !== 'idle') wardrobeTransition.changeSeason(() => setActiveSeason(season))
          }}
          onStyleChange={setActiveStyle}
          onColorChange={setActiveColor}
          onSearchChange={setSearchQuery}
          onSortOrderChange={changeSortOrder}
          viewControl={<LookbookViewSwitch value={viewMode} onChange={changeViewMode} />}
        />
      )}

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
        resetKey={JSON.stringify([activeSeason, activeStyle, activeColor, settledSearch, sortOrder, selectedItemIds])}
      >
        <WardrobeCabinet
          key={activeSeason ?? 'all'}
          label={activeSeason ? `${seasonLabels[activeSeason]}에 입을 코디` : '모아둔 코디'}
          countLabel={`${outfitsQuery.data?.pages[0]?.totalCount ?? 0}개의 코디`}
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
              <h2 className="mt-5 text-xl font-black">
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
              <h2 className="mt-5 text-lg font-black">
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
                  ? '다른 코디명이나 옷 이름, 색상으로 다시 검색해보세요.'
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
        </WardrobeCabinet>
        {outfits.length > 0 && (
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
          outfit={selectedOutfit}
          items={items}
          onClose={() => setSelectedOutfitId(null)}
        />
      )}
    </section>
  )
}
