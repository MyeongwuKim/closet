import { useId, useRef, useState } from 'react'
import { BarChart3, ChevronLeft, Shirt } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../../../components/PageTitle'
import { useWardrobeStatisticsQuery, type WardrobeStatistics } from '../api/statisticsQueries'
import { StatisticsOverview } from '../components/StatisticsOverview'
import { StatisticsWearPanel } from '../components/StatisticsWearPanel'

const statisticsTabs = [
  { id: 'closet', label: '옷장 구성' },
  { id: 'wear', label: '착용 기록' },
] as const

type StatisticsTab = (typeof statisticsTabs)[number]['id']

/** 두 통계 탭에서 공통으로 보는 옷, 코디, 착용 기록 수를 간단한 카드로 표시한다. */
function StatisticsSummary({ data }: { data: WardrobeStatistics }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[
        ['옷장 아이템', data.totalItems, '개'],
        ['저장한 코디', data.totalOutfits, '개'],
        ['착용 기록', data.wearRecordCount, '회'],
      ].map(([label, count, unit]) => (
        <div key={label} className="rounded-2xl border border-line bg-surface px-3 py-3 sm:px-4">
          <p className="truncate text-[11px] font-bold text-muted sm:text-xs">{label}</p>
          <p className="mt-1 text-xl font-black tabular-nums sm:text-2xl">{count}<span className="ml-1 text-[11px] font-medium text-muted">{unit}</span></p>
        </div>
      ))}
    </div>
  )
}

/** 설정 → 옷장 통계에서 보유 현황과 플래너 착용 기록을 별도 탭으로 표시한다. */
export function WardrobeStatisticsPage() {
  const query = useWardrobeStatisticsQuery()
  const [activeTab, setActiveTab] = useState<StatisticsTab>('closet')
  const tabsId = useId()
  const scrollRegionRef = useRef<HTMLDivElement>(null)
  const data = query.data

  /** 탭을 바꾸면 상세 스크롤을 처음으로 돌려 새 탭의 첫 카드부터 보이게 한다. */
  const selectTab = (tab: StatisticsTab) => {
    setActiveTab(tab)
    scrollRegionRef.current?.scrollTo({ top: 0 })
  }

  return (
    <section className="fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas" aria-label="옷장 통계">
      <header className="shrink-0 border-b border-line bg-canvas/95">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-2 px-3 py-2 sm:px-5">
          <Link to="/settings" aria-label="설정으로 돌아가기" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface">
            <ChevronLeft size={24} />
          </Link>
          <PageTitle title="옷장 통계" description="내 옷장과 기록으로 보는 취향" compact />
        </div>
      </header>
      {query.isPending ? (
        <p role="status" className="py-16 text-center text-muted">통계를 불러오는 중...</p>
      ) : query.isError ? (
        <div role="alert" className="mx-auto mt-6 w-[calc(100%-2.5rem)] max-w-3xl rounded-3xl border border-line bg-surface p-8 text-center">
          <p>통계를 불러오지 못했어요.</p>
          <button type="button" onClick={() => void query.refetch()} className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-bold text-white">다시 시도</button>
        </div>
      ) : data && (
        <>
          <div className="shrink-0 border-b border-line bg-canvas px-5 pt-4 pb-3 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold text-muted"><BarChart3 size={16} /> 전체 기록 · {data.throughDate.replaceAll('-', '.')} 기준</p>
              <StatisticsSummary data={data} />
              <div role="tablist" aria-label="옷장 통계 보기" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
                {statisticsTabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    id={`${tabsId}-${tab.id}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`${tabsId}-${tab.id}-panel`}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    onClick={() => selectTab(tab.id)}
                    onKeyDown={(event) => {
                      const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? statisticsTabs.length - 1
                        : event.key === 'ArrowRight' ? (index + 1) % statisticsTabs.length
                          : event.key === 'ArrowLeft' ? (index + statisticsTabs.length - 1) % statisticsTabs.length : null
                      if (nextIndex === null) return
                      event.preventDefault()
                      selectTab(statisticsTabs[nextIndex].id)
                      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
                    }}
                    className={`min-h-11 rounded-lg px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-accent ${activeTab === tab.id ? 'bg-ink text-white shadow-sm' : 'text-muted hover:text-ink'}`}
                  >{tab.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div ref={scrollRegionRef} tabIndex={0} role="region" aria-label="옷장 통계 상세" className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-accent">
            <div className="mx-auto max-w-3xl px-5 py-5 pb-[calc(var(--app-bottom-space)+2rem)] sm:px-6">
              <div id={`${tabsId}-closet-panel`} role="tabpanel" aria-labelledby={`${tabsId}-closet-tab`} hidden={activeTab !== 'closet'} tabIndex={0} className="focus-visible:outline-2 focus-visible:outline-accent">
                {data.totalItems === 0 && (
                  <div className="mb-5 rounded-3xl border border-line bg-surface p-6 text-center">
                    <Shirt className="mx-auto text-muted" />
                    <p className="mt-3 font-black">아직 옷장에 옷이 없어요</p>
                    <Link to="/closet" className="mt-3 inline-block text-sm font-bold text-accent">옷장에 옷 추가하기</Link>
                  </div>
                )}
                <StatisticsOverview categories={data.categories} colors={data.colors} totalItems={data.totalItems} />
              </div>
              <div id={`${tabsId}-wear-panel`} role="tabpanel" aria-labelledby={`${tabsId}-wear-tab`} hidden={activeTab !== 'wear'} tabIndex={0} className="focus-visible:outline-2 focus-visible:outline-accent">
                <StatisticsWearPanel data={data} />
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
