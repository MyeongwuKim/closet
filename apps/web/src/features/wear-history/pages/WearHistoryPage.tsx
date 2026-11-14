import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Thermometer } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { WearFeeling } from '@closet/types'
import { InfiniteScrollFooter } from '../../../components/InfiniteScrollFooter'
import { getOutfitComposerBackPath } from '../../lookbook/utils/outfitComposerNavigation'
import { useKoreaPlannerToday } from '../../plan/hooks/useKoreaPlannerToday'
import { useTemperatureWearHistory } from '../api/wearHistoryQueries'
import { WearHistoryCard } from '../components/WearHistoryCard'
import { WearHistoryDetail } from '../components/WearHistoryDetail'
import { formatWearTemperature, readTemperatureFilter, readWearHistoryDate, temperatureRanges, wearFeelingLabels } from '../utils/temperatureHistory'
import type { WearHistoryGroup } from '../types'

/**
 * 플래너 하루 보기·코디북 → 온도별 착용 기록.
 * 기온·체감 조건을 URL에 유지하고 같은 조합을 한 장으로 보여준다. 선택한 카드에서 날짜별 기록과 새 날짜 배정을 연다.
 */
export function WearHistoryPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = useKoreaPlannerToday()
  const listRef = useRef<HTMLDivElement>(null)
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

  /** 필터만 바꾸며 선택 날짜·복귀 경로는 유지한다. 새 조건은 목록 맨 위에서 시작한다. */
  const changeFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
    listRef.current?.scrollTo({ top: 0 })
  }

  return createPortal(
    <section className="fixed inset-0 z-[80] flex h-dvh flex-col bg-canvas text-ink" aria-label="온도별 착용 기록">
      <header className="shrink-0 border-b border-line bg-surface">
        <div className="mx-auto flex min-h-18 max-w-4xl items-center gap-3 px-3 py-2 sm:px-5">
          <button type="button" onClick={() => navigate(backPath)} className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-canvas" aria-label="착용 기록에서 돌아가기"><ChevronLeft size={24} strokeWidth={1.7} /></button>
          <div><h1 className="text-lg font-semibold">온도별 착용 기록</h1><p className="mt-0.5 text-xs text-muted">입었던 코디를 찾아 플래너에 담아보세요.</p></div>
        </div>
      </header>
      <div className="shrink-0 border-b border-line px-4 pt-3 pb-3 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div role="radiogroup" aria-label="착용 기온" className="scrollbar-hidden flex gap-2 overflow-x-auto pb-1">
            {ranges.map(range => <button key={range.value} type="button" role="radio" aria-checked={filter.value === range.value} onClick={() => changeFilter('range', range.value)} className={`min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold ${filter.value === range.value ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-muted hover:border-accent'}`}>{range.label}</button>)}
          </div>
          <div role="radiogroup" aria-label="착용 체감" className="mt-2 flex flex-wrap gap-1.5">
            {[{ value: 'all', label: '모든 체감' }, ...Object.entries(wearFeelingLabels).map(([value, label]) => ({ value, label }))].map(option => <button key={option.value} type="button" role="radio" aria-checked={(feeling ?? 'all') === option.value} onClick={() => changeFilter('feeling', option.value)} className={`min-h-11 rounded-full px-3 text-xs font-medium ${feeling === option.value || (!feeling && option.value === 'all') ? 'bg-sage text-accent' : 'text-muted hover:bg-surface'}`}>{option.label}</button>)}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted"><Thermometer size={15} className="mt-0.5 shrink-0" strokeWidth={1.5} aria-hidden="true" /><span>{filter.value === 'near' ? `선택한 날짜의 예보 ${formatWearTemperature(filter.temperature)}와 가까운 기록이에요.` : '입었다고 확인한 코디만 보여줘요. 기온은 지난 착용일의 하루 평균이에요.'}</span></p>
        </div>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 min-h-5 text-xs text-muted" role="status">{history.isPending ? '착용 기록을 불러오고 있어요.' : `${count}개의 코디`}</p>
          {history.isPending ? <div role="status" aria-label="착용 기록 로딩 중" className="grid animate-pulse grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} aria-hidden="true"><div className="aspect-[4/5] rounded-xl bg-line/40" /><div className="mt-3 h-4 w-2/3 rounded bg-line/40" /><div className="mt-2 h-3 w-4/5 rounded bg-line/30" /></div>)}</div>
            : history.isError && groups.length === 0 ? <div role="alert" className="py-16 text-center"><p className="text-sm">착용 기록을 불러오지 못했어요.</p><button type="button" onClick={() => void history.refetch()} className="mt-4 min-h-11 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-accent">다시 불러오기</button></div>
            : groups.length === 0 ? <div className="mx-auto max-w-sm py-16 text-center"><Thermometer className="mx-auto mb-4 text-accent" size={32} strokeWidth={1.4} aria-hidden="true" /><h2 className="text-base font-semibold">{filter.value === 'all' && !feeling ? '아직 착용 기록이 없어요' : '조건에 맞는 착용 기록이 없어요'}</h2><p className="mt-2 text-sm leading-6 text-muted">{filter.value === 'all' && !feeling ? '플래너에서 입은 코디에 ‘입었어요’를 남겨주세요. 기온은 날짜가 지난 뒤 위치 정보가 있는 기록에 추가돼요.' : '다른 기온이나 체감을 골라보세요. 기온이 없는 기록은 ‘기온 미기록’에서 볼 수 있어요.'}</p></div>
            : <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">{groups.map(group => <WearHistoryCard key={group.id} group={group} onOpen={() => setSelected(group)} />)}</div>}
          {!history.isPending && groups.length > 0 && <InfiniteScrollFooter hasNextPage={Boolean(history.hasNextPage)} isFetching={history.isFetchingNextPage} isError={history.isFetchNextPageError} onLoadMore={() => history.fetchNextPage()} />}
        </div>
      </div>
      {selected && <WearHistoryDetail key={selected.id} group={selected} initialDate={targetDate} onClose={() => setSelected(null)} />}
    </section>, document.body,
  )
}
