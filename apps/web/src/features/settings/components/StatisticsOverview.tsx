import { useState } from 'react'
import type { StatisticsBucket } from '../api/statisticsQueries'
import { StatisticsRanking } from './StatisticsRanking'

interface DistributionProps {
  title: string
  description: string
  entries: StatisticsBucket[]
  total: number
  unit: string
  empty: string
  kind: 'category' | 'color'
}

function Distribution({ title, description, entries, total, unit, empty, kind }: DistributionProps) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-base font-black">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      <StatisticsRanking entries={entries} total={total} unit={unit} empty={empty} kind={kind} />
    </section>
  )
}

/** 옷장에 저장된 종류와 색상 분포를 보여주며, 색상은 처음에 상위 다섯 개만 표시한다. */
export function StatisticsOverview({ categories, colors, totalItems }: {
  categories: StatisticsBucket[]
  colors: StatisticsBucket[]
  totalItems: number
}) {
  const [showAllColors, setShowAllColors] = useState(false)
  const visibleColors = showAllColors ? colors : colors.slice(0, 5)

  return (
    <div className="space-y-5">
      <Distribution kind="category" title="어떤 종류가 가장 많을까요?" description="보관 중인 옷의 대표 카테고리 기준이에요." entries={categories} total={totalItems} unit="개" empty="옷을 추가하면 종류별 비중을 볼 수 있어요." />
      <div>
        <Distribution kind="color" title="내 옷장의 색상" description="옷에 저장된 대표 색상으로 나눴어요." entries={visibleColors} total={totalItems} unit="개" empty="등록된 색상 정보가 없어요." />
        {colors.length > 5 && (
          <button
            type="button"
            aria-expanded={showAllColors}
            onClick={() => setShowAllColors((value) => !value)}
            className="mt-3 min-h-11 w-full rounded-2xl border border-line bg-surface px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-sage focus-visible:outline-2 focus-visible:outline-accent"
          >
            {showAllColors ? '색상 접기' : `모든 색상 보기 (${colors.length}개)`}
          </button>
        )}
      </div>
    </div>
  )
}
