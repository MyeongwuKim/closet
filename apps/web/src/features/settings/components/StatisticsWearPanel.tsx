import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { WardrobeStatistics } from '../api/statisticsQueries'
import { StatisticsRanking } from './StatisticsRanking'
import { WearStatistics } from './WearStatistics'

/** 플래너의 지난 착용 기록을 바탕으로 순위, 스타일, 미착용 수와 기록 진입점을 묶어 보여준다. */
export function StatisticsWearPanel({ data }: { data: WardrobeStatistics }) {
  return (
    <div className="space-y-5">
      <WearStatistics data={data} />
      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-base font-black">자주 입은 스타일</h2>
        <p className="mt-1 text-xs leading-5 text-muted">저장한 코디 수가 아닌 플래너 착용 기록 기준이에요.</p>
        <StatisticsRanking kind="style" entries={data.wornStyles} total={data.wearRecordCount} unit="회" empty="스타일을 집계할 착용 기록이 아직 없어요." />
      </section>
      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-base font-black">아직 입지 않은 옷과 코디</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-canvas px-4 py-3">
            <p className="text-xs text-muted">옷</p>
            <p className="mt-1 text-xl font-black tabular-nums">{data.unwornCount}<span className="ml-1 text-xs font-medium text-muted">/ {data.totalItems}개</span></p>
          </div>
          <div className="rounded-2xl bg-canvas px-4 py-3">
            <p className="text-xs text-muted">코디</p>
            <p className="mt-1 text-xl font-black tabular-nums">{data.unwornOutfitCount}<span className="ml-1 text-xs font-medium text-muted">/ {data.totalOutfits}개</span></p>
          </div>
        </div>
      </section>
      <p className="px-1 text-xs leading-6 text-muted">착용 통계는 플래너에 등록된 오늘까지의 코디로 계산하며, 미래 일정은 제외해요. 코디의 현재 스타일 정보가 반영됩니다.</p>
      <Link to="/plan" className="flex items-center justify-between rounded-2xl bg-sage px-5 py-4 text-sm font-bold">플래너에서 착용 기록 남기기<ChevronRight size={18} /></Link>
    </div>
  )
}
