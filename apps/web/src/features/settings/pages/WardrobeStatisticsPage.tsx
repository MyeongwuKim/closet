import { BarChart3, ChevronLeft, ChevronRight, Shirt } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageTitle } from '../../../components/PageTitle'
import { useWardrobeStatisticsQuery, type StatisticsBucket } from '../api/statisticsQueries'
import { StatisticsRanking } from '../components/StatisticsRanking'
import { WearStatistics } from '../components/WearStatistics'

function Distribution({ title, description, entries, total, unit, empty, kind }: {
  title: string; description: string; entries: StatisticsBucket[]; total: number; unit: string; empty: string;
  kind: 'category' | 'color' | 'style';
}) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-base font-black">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      <StatisticsRanking entries={entries} total={total} unit={unit} empty={empty} kind={kind} />
    </section>
  )
}

export function WardrobeStatisticsPage() {
  const query = useWardrobeStatisticsQuery()
  const data = query.data
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
      <div tabIndex={0} role="region" aria-label="옷장 통계 상세" className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-accent">
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-6 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6">
          {query.isPending ? <p role="status" className="py-16 text-center text-muted">통계를 불러오는 중...</p> : query.isError ? (
            <div role="alert" className="rounded-3xl border border-line bg-surface p-8 text-center">
              <p>통계를 불러오지 못했어요.</p>
              <button type="button" onClick={() => void query.refetch()} className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-bold text-white">다시 시도</button>
            </div>
          ) : data && (
            <>
              <div className="flex items-center gap-2 text-xs font-bold text-muted"><BarChart3 size={16} /> 전체 기록 · {data.throughDate.replaceAll('-', '.')} 기준</div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {[['옷장 아이템', data.totalItems, '개'], ['저장한 코디', data.totalOutfits, '개'], ['코디 착용 기록', data.wearRecordCount, '회']].map(([label, count, unit]) => (
                  <div key={label} className="rounded-2xl border border-line bg-surface px-3 py-4 sm:p-5">
                    <p className="text-[11px] font-bold text-muted sm:text-xs">{label}</p>
                    <p className="mt-2 text-2xl font-black sm:text-3xl">{count}<span className="ml-1 text-xs font-medium text-muted">{unit}</span></p>
                  </div>
                ))}
              </div>
              {data.totalItems === 0 && (
                <div className="rounded-3xl border border-line bg-surface p-6 text-center">
                  <Shirt className="mx-auto text-muted" />
                  <p className="mt-3 font-black">아직 옷장에 옷이 없어요</p>
                  <Link to="/closet" className="mt-3 inline-block text-sm font-bold text-accent">옷장에 옷 추가하기</Link>
                </div>
              )}
              <Distribution kind="category" title="어떤 종류가 가장 많을까요?" description="보관 중인 옷의 대표 카테고리 기준이에요." entries={data.categories} total={data.totalItems} unit="개" empty="옷을 추가하면 종류별 비중을 볼 수 있어요." />
              <Distribution kind="color" title="내 옷장의 색상" description="옷에 저장된 대표 색상으로 나눴어요." entries={data.colors} total={data.totalItems} unit="개" empty="등록된 색상 정보가 없어요." />
              <WearStatistics data={data} />
              <Distribution kind="style" title="자주 입은 스타일" description="저장한 코디 수가 아닌 플래너 착용 기록 기준이에요." entries={data.wornStyles} total={data.wearRecordCount} unit="회" empty="스타일을 집계할 착용 기록이 아직 없어요." />
              <p className="px-1 text-xs leading-6 text-muted">착용 통계는 플래너에 등록된 오늘까지의 코디로 계산하며, 미래 일정은 제외해요. 코디의 현재 스타일 정보가 반영됩니다.</p>
              <Link to="/plan" className="flex items-center justify-between rounded-2xl bg-sage px-5 py-4 text-sm font-bold">플래너에서 착용 기록 남기기<ChevronRight size={18} /></Link>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
