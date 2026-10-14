import { useSearchParams } from 'react-router-dom'
import { CatalogCardSkeletonGrid } from '../CatalogCardSkeletonGrid'
import { CollectionHeading } from '../CollectionHeading'
import { PlanPeriodSkeleton } from '../../features/plan/components/PlanPeriodSkeleton'

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
      className={`plan-page mx-auto w-full max-w-3xl ${viewMode === 'today' ? 'plan-today-page' : viewMode === 'month' ? 'plan-month-page pb-8' : 'pb-8'}`}
      aria-busy="true"
    >
      <CollectionHeading title="플래너" actions={<span className="block h-10 w-21 rounded-xl bg-line/40" aria-hidden="true" />} />
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
      {viewMode === 'month' ? (
        <div className="plan-month-content">
          <PlanPeriodSkeleton viewMode="month" />
        </div>
      ) : (
        <PlanPeriodSkeleton viewMode={viewMode} />
      )}
    </section>
  )
}

function CatalogRouteSkeleton({ variant }: { variant: 'wardrobe' | 'outfit' }) {
  const isWardrobe = variant === 'wardrobe'
  const catalog = (
    <div className="catalog-scroll-region" aria-label={isWardrobe ? '옷장 화면 로딩 중' : '코디북 화면 로딩 중'}>
      <div className="wardrobe-cabinet">
        <div className="wardrobe-cabinet-toolbar animate-pulse" aria-hidden="true">
          <span className={`block h-5 w-28 ${block}`} />
          <span className={`block h-4 w-16 ${block}`} />
        </div>
        <div className="wardrobe-cabinet-contents">
          <CatalogCardSkeletonGrid variant={variant} />
        </div>
      </div>
    </div>
  )

  return (
    <section className={isWardrobe ? 'closet-page' : 'lookbook-page'} aria-busy="true">
      <CollectionHeading
        title={isWardrobe ? '내 옷장' : '나의 코디북'}
        actions={<span className="block size-10 rounded-xl bg-line/45" aria-hidden="true" />}
      />
      <div className="season-filter-rail mt-6 flex h-12 animate-pulse gap-1 p-1" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => <span className="flex-1 rounded-xl bg-surface/65" key={index} />)}
      </div>
      {isWardrobe && (
        <div className="mt-3 flex gap-2 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <span className="h-9 w-20 shrink-0 rounded-full bg-line/40" key={index} />)}
        </div>
      )}
      {isWardrobe ? <div className="closet-catalog">{catalog}</div> : catalog}
    </section>
  )
}

/** 옷장 코드 로딩 중 필터와 옷 사진 카드의 배치를 유지한다. */
export function ClosetRouteSkeleton() {
  return <CatalogRouteSkeleton variant="wardrobe" />
}

/** 코디북 코드 로딩 중 필터와 표지 카드의 배치를 유지한다. */
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
        {['옷장 관리', '앱 설정'].map((label) => (
          <div key={label}>
            <span className={`mb-2.5 block h-3 w-17 ${block}`} aria-hidden="true" />
            <div className="overflow-hidden rounded-2xl border border-line bg-surface" aria-hidden="true">
              {[0, 1].map((index) => (
                <div className={`flex min-h-16 items-center gap-4 px-5 ${index === 0 ? 'border-b border-line' : ''}`} key={index}>
                  <span className="size-6 shrink-0 rounded-lg bg-sage" />
                  <span className={`block h-4 w-36 max-w-full flex-1 ${block}`} />
                  <span className="size-4 rounded-full bg-line/40" />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex min-h-16 items-center gap-4 border-t border-line pt-3" aria-hidden="true">
          <span className="size-6 shrink-0 rounded-lg bg-sage" />
          <span className="flex-1"><span className={`block h-4 w-20 ${block}`} /><span className={`mt-2 block h-3 w-28 ${block}`} /></span>
          <span className="size-4 rounded-full bg-line/40" />
        </div>
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
