import type { Season } from '@closet/types'
import { useLocation, useSearchParams } from 'react-router-dom'
import { CatalogCardSkeletonGrid } from '../CatalogCardSkeletonGrid'
import { CatalogScrollRegion } from '../CatalogScrollRegion'
import { CatalogSearchField } from '../CatalogSearchField'
import { CollectionHeading } from '../CollectionHeading'
import { SeasonFilter } from '../SeasonFilter'
import { WardrobeCabinet } from '../WardrobeCabinet'
import { seasonLabels } from '../../constants/seasons'
import { outfitStyleOptions } from '../../constants/styleOptions'
import { OutfitFilterControls } from '../../features/lookbook/components/OutfitFilterControls'
import { ClosetFilterSelection } from '../../features/closet/components/ClosetFilterSelection'
import { closetCategoryLabels } from '../../features/closet/constants'
import { readWardrobeFilterSelection } from '../../features/closet/utils/wardrobeFilters'
import { PlanPeriodSkeleton } from '../../features/plan/components/PlanPeriodSkeleton'
import { WearHistoryLink } from '../../features/wear-history/components/WearHistoryLink'

const block = 'rounded-full bg-line/50'

/** 플래너 코드가 내려오는 동안 선택한 하루·주간·월간 보기의 상단 조작과 기간 영역을 표시한다. */
export function PlanRouteSkeleton() {
  const [searchParams] = useSearchParams()
  const requestedView = searchParams.get('view')
  const viewMode = requestedView === 'week' || requestedView === 'month'
    ? requestedView
    : 'today'

  return (
    <section
      className={`plan-page mx-auto w-full max-w-3xl ${viewMode === 'today' ? 'plan-today-page' : 'plan-overview-page'}`}
      aria-busy="true"
    >
      <CollectionHeading title="플래너"
        titleAccessory={viewMode === 'today' && <span className="block h-11 w-24 animate-pulse rounded-full bg-line/40" aria-hidden="true" />}
        actions={<span className="block h-10 w-21 rounded-xl bg-line/40" aria-hidden="true" />} />
      <div className="plan-view-tabs mt-3 flex animate-pulse sm:mt-6" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => <span className="h-9 flex-1 rounded-xl bg-surface/65" key={index} />)}
      </div>
      <div className="plan-period-header mt-4 flex items-center justify-between gap-3 pb-1 sm:mt-6" aria-hidden="true">
        <span className="min-w-0 animate-pulse">
          <span className={`block h-3 w-30 ${block}`} />
          <span className={`mt-1.5 block h-7 ${viewMode === 'week' ? 'w-42' : 'w-24'} ${block}`} />
          {viewMode !== 'month' && <span className={`mt-1 block h-2.5 w-16 ${block}`} />}
        </span>
        <span className="flex gap-1.5"><span className="size-11 rounded-full bg-line/40" /><span className="size-11 rounded-full bg-line/40" /></span>
      </div>
      <PlanPeriodSkeleton viewMode={viewMode} />
    </section>
  )
}

/** 코드 로딩 중에도 실제 계절·필터 행과 목록 컨테이너를 사용한다. URL 조건이 차지하는 검색·결과 안내 공간도 미리 둔다. */
function CatalogRouteSkeleton({ variant }: { variant: 'wardrobe' | 'outfit' }) {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const isWardrobe = variant === 'wardrobe'
  const requestedSeason = searchParams.get('season')
  const activeSeason = isWardrobe && requestedSeason && requestedSeason in seasonLabels ? requestedSeason as Season : null
  const searchQuery = isWardrobe ? searchParams.get('q') ?? '' : ''
  const filterSelection = readWardrobeFilterSelection(searchParams)
  const requestedCategory = searchParams.get('category')
  const hasWardrobeFilters = Boolean((requestedCategory && requestedCategory in closetCategoryLabels) || activeSeason || filterSelection.length || searchQuery.trim())
  const ignoreChange = () => undefined
  const catalog = (
    <CatalogScrollRegion label={isWardrobe ? '옷장 화면 로딩 중' : '코디북 화면 로딩 중'} resetKey="loading">
      {!isWardrobe && <WearHistoryLink from={`/lookbook${location.search}`} />}
      {isWardrobe && location.pathname === '/closet' && !hasWardrobeFilters && (
        <div className="mb-4" aria-hidden="true"><span className="block h-11 w-52 max-w-full animate-pulse rounded-full bg-line/40" /></div>
      )}
      <WardrobeCabinet
        label={isWardrobe ? (activeSeason ? `${seasonLabels[activeSeason]}에 입는 옷` : '전체 옷장') : '모아둔 코디'}
        countLabel="불러오는 중"
      >
        {isWardrobe && (searchQuery.trim() || filterSelection.some((item) => item.kind === 'tag')) && (
          <p className="mt-4 px-1 text-xs font-bold text-muted">검색 결과를 불러오는 중</p>
        )}
        <CatalogCardSkeletonGrid variant={variant} />
      </WardrobeCabinet>
    </CatalogScrollRegion>
  )

  return (
    <section className={isWardrobe ? 'closet-page' : 'lookbook-page'} aria-busy="true">
      <CollectionHeading
        title={isWardrobe ? '내 옷장' : '내 코디북'}
        actions={<>{Array.from({ length: 3 }, (_, index) => <span key={index} className="block size-11 rounded-xl bg-line/45" aria-hidden="true" />)}</>}
      />
      {isWardrobe ? (
        <>
          <div className="contents" inert><CatalogSearchField isOpen={Boolean(searchQuery.trim())} value={searchQuery} onChange={ignoreChange} label="옷장 검색 준비 중" placeholder="이름, 브랜드, 종류, 색상 검색" /></div>
          <div className="contents" inert><SeasonFilter className="mt-6" value={activeSeason} onChange={ignoreChange} /></div>
          <div className="closet-catalog">
            <div className="closet-filter-row mt-2 flex min-h-10 items-center gap-2" aria-hidden="true">
              <div className="flex min-w-0 flex-1 gap-2 overflow-hidden pb-1">
                {Array.from({ length: 4 }, (_, index) => <span className="h-9 w-16 shrink-0 animate-pulse rounded-full bg-line/40" key={index} />)}
              </div>
            </div>
            <div className="contents" inert><ClosetFilterSelection selection={filterSelection} colors={[]} onToggle={ignoreChange} label="적용한 옷장 필터 준비 중" /></div>
            {catalog}
          </div>
        </>
      ) : (
        <>
          <div className="contents" inert>
            <OutfitFilterControls
              activeSeason={null} activeStyle="all" isSearchOpen={false} searchQuery=""
              styleOptions={outfitStyleOptions}
              onSeasonChange={ignoreChange} onStyleChange={ignoreChange} onSearchChange={ignoreChange} onSortOrderChange={ignoreChange}
            />
          </div>
          {searchParams.get('items') && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3" aria-hidden="true">
              <span className="h-4 flex-1 animate-pulse rounded-full bg-line/40" /><span className="size-8 shrink-0 rounded-full bg-line/30" />
            </div>
          )}
          {catalog}
        </>
      )}
    </section>
  )
}

/** 옷장 코드 로딩 중에도 URL의 검색·계절과 카테고리 행·접힌 하이라이트 공간을 확보해 사진 카드가 내려가지 않게 한다. */
export function ClosetRouteSkeleton() {
  return <CatalogRouteSkeleton variant="wardrobe" />
}

/** 코디북의 실제 필터·보기 전환 배치를 재사용하고, 그 아래 표지 위치에 코드 로딩 카드를 표시한다. */
export function LookbookRouteSkeleton() {
  return <CatalogRouteSkeleton variant="outfit" />
}

/** 설정 코드 로딩 중 스타일 프로필 카드와 옷장 관리·앱 설정 메뉴 그룹을 표시한다. */
export function SettingsRouteSkeleton() {
  return (
    <section className="settings-page" aria-busy="true">
      <CollectionHeading title="설정" />
      <div className="mt-[22px] grid w-full max-w-[680px] gap-7 animate-pulse" role="status" aria-label="설정 화면을 불러오는 중">
        <span className="sr-only">설정 화면을 불러오는 중</span>
        <div className="flex min-h-[116px] items-center gap-4 rounded-2xl border border-t-[5px] border-line border-t-wood bg-surface p-5" aria-hidden="true">
          <span className="size-[46px] shrink-0 rounded-full bg-sage" />
          <span className="flex-1"><span className={`block h-5 w-28 ${block}`} /><span className={`mt-2 block h-3 w-40 max-w-full ${block}`} /></span>
          <span className="size-5 rounded-full bg-line/40" />
        </div>
        {[{ label: '옷장 관리', count: 2 }, { label: '앱 설정', count: 4 }].map(({ label, count }) => (
          <div key={label}>
            <span className={`mb-2.5 block h-3 w-17 ${block}`} aria-hidden="true" />
            <div className="overflow-hidden rounded-2xl border border-line bg-surface" aria-hidden="true">
              {Array.from({ length: count }, (_, index) => (
                <div className={`flex min-h-16 items-center gap-4 px-5 ${index > 0 ? 'border-t border-line' : ''}`} key={index}>
                  <span className="size-6 shrink-0 rounded-lg bg-sage" />
                  <span className={`block h-4 w-36 max-w-full flex-1 ${block}`} />
                  <span className="size-4 rounded-full bg-line/40" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** 스타일 프로필 상세 경로를 직접 열 때 전체 화면 입력 폼과 같은 구조를 표시한다. */
export function StyleProfileRouteSkeleton() {
  return (
    <section
      className="fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="status"
      aria-label="스타일 프로필을 불러오는 중"
    >
      <span className="sr-only">스타일 프로필을 불러오는 중</span>
      <header className="shrink-0 border-b border-line px-5 py-3" aria-hidden="true">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <span className="size-10 rounded-full bg-line/40" />
          <span className={`block h-6 w-35 ${block}`} />
        </div>
      </header>
      <div className="mx-auto w-full max-w-2xl p-5 sm:p-6" aria-hidden="true">
        <div className="animate-pulse rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <span className={`block h-5 w-28 ${block}`} />
          <span className={`mt-3 block h-3 w-55 max-w-full ${block}`} />
          <div className="mt-6 grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }, (_, index) => <span className="h-14 rounded-xl bg-line/30" key={index} />)}
          </div>
        </div>
      </div>
    </section>
  )
}
