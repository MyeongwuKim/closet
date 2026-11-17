import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Thermometer } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { WearFeeling } from '@closet/types'
import { InfiniteScrollFooter } from '../../../components/InfiniteScrollFooter'
import { CatalogScrollRegion } from '../../../components/CatalogScrollRegion'
import { CollectionHeading } from '../../../components/CollectionHeading'
import { WardrobeCabinet } from '../../../components/WardrobeCabinet'
import { getOutfitComposerBackPath } from '../../lookbook/utils/outfitComposerNavigation'
import { useKoreaPlannerToday } from '../../plan/hooks/useKoreaPlannerToday'
import { useTemperatureWearHistory } from '../api/wearHistoryQueries'
import { WearHistoryCard, WearHistoryCardSkeleton } from '../components/WearHistoryCard'
import { WearHistoryDetail } from '../components/WearHistoryDetail'
import { WearHistoryFilters } from '../components/WearHistoryFilters'
import { readTemperatureFilter, readWearHistoryDate, temperatureRanges, wearFeelingLabels } from '../utils/temperatureHistory'
import type { WearHistoryGroup } from '../types'
import './WearHistoryPage.css'

const gridClassName = 'wear-history-grid grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4'

/**
 * 플래너 하루 보기·코디북 → 온도별 착용 기록.
 * 옷장과 같은 제목·목록 틀에서 기온·체감 조건을 URL에 유지하고 목록만 스크롤한다. 선택한 카드에서 날짜별 기록과 새 날짜 배정을 연다.
 */
export function WearHistoryPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = useKoreaPlannerToday()
  const [selected, setSelected] = useState<WearHistoryGroup | null>(null)
  const filter = readTemperatureFilter(params)
  const near = readTemperatureFilter(new URLSearchParams({ range: 'near', temperature: params.get('temperature') ?? '' }))
  const rawFeeling = params.get('feeling')
  const feeling = rawFeeling && Object.hasOwn(wearFeelingLabels, rawFeeling) ? rawFeeling as WearFeeling : null
  const targetDate = readWearHistoryDate(params.get('date'), today)
  const backPath = getOutfitComposerBackPath(params.get('from'))
  const history = useTemperatureWearHistory({ ...filter.input, feeling, limit: 12 })
  const groups = history.data?.pages.flatMap(page => page.items) ?? []
  const count = history.data?.pages[0]?.totalCount ?? 0
  const ranges = near.value === 'near' ? [{ value: 'near', label: '비슷한 기온' }, ...temperatureRanges] : temperatureRanges

  /** 필터만 바꾸며 선택 날짜·복귀 경로는 유지한다. 새 조건의 스크롤 초기화는 공통 목록 영역에 맡긴다. */
  const changeFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return createPortal(
    <section className="wear-history-page" aria-label="온도별 착용 기록">
      <div className="wear-history-shell">
        <div className="wear-history-heading">
          <button type="button" onClick={() => navigate(backPath)} className="wear-history-back" aria-label="착용 기록에서 돌아가기">
            <ChevronLeft size={24} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <CollectionHeading title="착용 기록" />
        </div>
        <WearHistoryFilters ranges={ranges} range={filter.value} temperature={filter.temperature} feeling={feeling}
          onRangeChange={(value) => changeFilter('range', value)} onFeelingChange={(value) => changeFilter('feeling', value)} />
        <CatalogScrollRegion label="착용 기록 목록" resetKey={JSON.stringify([filter.value, filter.temperature, feeling])}>
          <WardrobeCabinet label="입었던 코디" countLabel={history.isPending ? '불러오는 중' : history.isError && groups.length === 0 ? '조회 실패' : `${count}개의 코디`}>
            {history.isPending ? (
              <div role="status" aria-label="착용 기록 로딩 중" className={gridClassName}>
                {Array.from({ length: 8 }, (_, index) => <WearHistoryCardSkeleton key={index} />)}
              </div>
            ) : history.isError && groups.length === 0 ? (
              <div role="alert" className="py-12 text-center">
                <p className="text-sm">착용 기록을 불러오지 못했어요.</p>
                <button type="button" onClick={() => void history.refetch()} className="mt-4 min-h-11 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-accent">다시 불러오기</button>
              </div>
            ) : groups.length === 0 ? (
              <div className="mx-auto max-w-sm py-12 text-center">
                <Thermometer className="mx-auto mb-4 text-accent" size={32} strokeWidth={1.4} aria-hidden="true" />
                <h2 className="text-base font-semibold">{filter.value === 'all' && !feeling ? '아직 착용 기록이 없어요' : '조건에 맞는 착용 기록이 없어요'}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{filter.value === 'all' && !feeling ? '플래너에서 ‘입었어요’를 남기면 여기에 모여요.' : '다른 기온이나 체감으로 찾아보세요.'}</p>
              </div>
            ) : (
              <div className={gridClassName}>{groups.map(group => <WearHistoryCard key={group.id} group={group} onOpen={() => setSelected(group)} />)}</div>
            )}
          </WardrobeCabinet>
          {!history.isPending && groups.length > 0 && (history.hasNextPage || history.isFetchingNextPage || history.isFetchNextPageError) && (
            <InfiniteScrollFooter hasNextPage={Boolean(history.hasNextPage)} isFetching={history.isFetchingNextPage} isError={history.isFetchNextPageError} onLoadMore={() => history.fetchNextPage()} />
          )}
        </CatalogScrollRegion>
      </div>
      {selected && <WearHistoryDetail key={selected.id} group={selected} initialDate={targetDate} onClose={() => setSelected(null)} />}
    </section>, document.body,
  )
}
