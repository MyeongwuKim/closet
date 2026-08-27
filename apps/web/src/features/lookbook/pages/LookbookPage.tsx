import { useState } from 'react'
import type { Season } from '@closet/types'
import { Images, Plus, Search, Sparkles, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageTitle } from '../../../components/PageTitle'
import {
  formatSeasonLabels,
  seasonLabels,
} from '../../../constants/seasons'
import { getOutfitStyleLabel } from '../../../constants/styleOptions'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { OutfitCardVisual } from '../components/OutfitCardVisual'
import { OutfitDetailModal } from '../components/OutfitDetailModal'
import { OutfitFilterControls } from '../components/OutfitFilterControls'
import { OutfitWearStatus } from '../components/OutfitWearStatus'
import { useOutfitWearSummaries } from '../hooks/useOutfitWearSummaries'
import { useInfiniteOutfitsQuery, useOutfitFilterOptions } from '../../../lib/catalogQueries'
import { InfiniteScrollFooter } from '../../../components/InfiniteScrollFooter'
import { outfitStyleOptions } from '../../../constants/styleOptions'
import {
  createOutfitSearchTokens,
} from '../utils/outfitFilters'

export function LookbookPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const items = useClosetStore((state) => state.items)
  const [activeStyle, setActiveStyle] = useState('all')
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [activeColor, setActiveColor] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null)
  const sortOrder = searchParams.get('sort') === 'oldest' ? 'oldest' : 'latest'
  const selectedItemIds = (searchParams.get('items') ?? '')
    .split(',')
    .filter(Boolean)
  const selectedItems = items.filter((item) =>
    selectedItemIds.includes(item.id),
  )
  const outfitsQuery = useInfiniteOutfitsQuery({
    style: activeStyle, season: activeSeason, color: activeColor,
    search: searchQuery, sort: sortOrder, wardrobeItemIds: selectedItemIds,
  })
  const outfits = outfitsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const filterOptions = useOutfitFilterOptions()
  const totalCount = filterOptions.data?.totalCount ?? outfitsQuery.data?.pages[0]?.totalCount ?? 0
  const wearSummaries = useOutfitWearSummaries(outfits.map((outfit) => outfit.id))
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

  return (
    <section>
      <div className="flex items-center justify-between gap-3 sm:items-end">
        <div className="min-w-0 [&_p]:hidden sm:[&_p]:block">
          <PageTitle
            title="코디북"
            description={`내 옷으로 만든 코디를 모아보세요 · ${totalCount}개`}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {totalCount > 0 && (
            <button
              type="button"
              onClick={toggleSearch}
              className={`flex size-10 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 sm:size-11 ${
                isSearchOpen
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-surface text-muted hover:text-ink'
              }`}
              aria-label={isSearchOpen ? '코디 검색 닫기' : '코디 검색'}
              aria-expanded={isSearchOpen}
              title={isSearchOpen ? '검색 닫기' : '코디 검색'}
            >
              <Search size={20} strokeWidth={2.3} />
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/lookbook/new')}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 sm:size-11"
            aria-label="새 코디 만들기"
            title="새 코디"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>
      </div>

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
          onSeasonChange={setActiveSeason}
          onStyleChange={setActiveStyle}
          onColorChange={setActiveColor}
          onSearchChange={setSearchQuery}
          onSortOrderChange={changeSortOrder}
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

      {outfitsQuery.isPending ? (
        <p role="status" className="py-12 text-center text-sm text-muted">코디북을 불러오는 중...</p>
      ) : outfitsQuery.isError && outfits.length === 0 ? (
        <div role="alert" className="mt-6 rounded-3xl border border-line bg-surface p-6 text-center">
          <p>코디북을 불러오지 못했어요.</p>
          <button type="button" className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-bold text-white"
            onClick={() => void outfitsQuery.refetch()}>다시 시도</button>
        </div>
      ) : totalCount === 0 ? (
        <div className="mt-6 rounded-3xl border border-line bg-surface p-6 text-center sm:p-8">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sage">
            <Images size={24} />
          </span>
          <h2 className="mt-5 text-xl font-black">
            {selectedItemIds.length > 0
              ? '이 옷이 들어간 코디가 아직 없어요'
              : '아직 저장한 코디가 없어요'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted">
            {selectedItemIds.length > 0
              ? '선택한 아이템을 미리 넣은 상태로 새 코디를 만들 수 있어요.'
              : '내 옷장에서 아이템을 골라 사람 없는 코디 이미지를 만들어보세요.'}
          </p>
          {selectedItemIds.length > 0 && (
            <button
              type="button"
              onClick={() =>
                navigate(`/lookbook/new?items=${selectedItemIds.join(',')}`)
              }
              className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
            >
              이 옷으로 코디 만들기
            </button>
          )}
        </div>
      ) : visibleOutfits.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleOutfits.map((outfit) => (
            <button
              type="button"
              onClick={() => setSelectedOutfitId(outfit.id)}
              className="overflow-hidden rounded-3xl border border-line bg-surface p-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
              aria-label={`${outfit.name} 코디 상세 보기`}
              key={outfit.id}
            >
              <div className="relative">
                <OutfitCardVisual
                  outfit={outfit}
                  items={items}
                  className="aspect-[4/5] w-full"
                />
                {outfit.previewImageUrl && (
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-bold text-white backdrop-blur">
                    <Sparkles size={10} /> AI 룩
                  </span>
                )}
              </div>
              <div className="px-2 pt-3 pb-2">
                <div className="flex min-w-0 gap-1 overflow-hidden">
                  <span className="inline-flex shrink-0 rounded-full bg-sage px-2 py-1 text-[10px] font-bold">
                    {getOutfitStyleLabel(outfit.style)}
                  </span>
                  {outfit.seasons.length > 0 && (
                    <span className="truncate rounded-full border border-line px-2 py-1 text-[10px] font-bold text-muted">
                      {formatSeasonLabels(outfit.seasons)}
                    </span>
                  )}
                </div>
                <h2 className="truncate text-sm font-black">{outfit.name}</h2>
                <OutfitWearStatus summary={wearSummaries.get(outfit.id)} />
                <p className="mt-1 text-xs text-muted">
                  {outfit.layers.length}개 아이템 ·{' '}
                  {new Intl.DateTimeFormat('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  }).format(new Date(outfit.createdAt))}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
          <h2 className="text-lg font-black">
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
              onClick={() =>
                navigate(`/lookbook/new?items=${selectedItemIds.join(',')}`)
              }
              className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
            >
              이 옷으로 코디 만들기
            </button>
          )}
        </div>
      )}
      {outfits.length > 0 && (
        <InfiniteScrollFooter
          hasNextPage={outfitsQuery.hasNextPage}
          isFetching={outfitsQuery.isFetching}
          isError={outfitsQuery.isFetchNextPageError}
          onLoadMore={outfitsQuery.fetchNextPage}
        />
      )}
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
