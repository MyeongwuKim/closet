import { useMemo } from 'react'
import { useOutfitWearHistoryQuery, type OutfitWearRecord } from '../../plan/api/plannerQueries'
import { createOutfitWearSummary } from '../utils/outfitWearSummary'
import type { OutfitWearSummary } from '../utils/outfitWearSummary'
export type { OutfitWearSummary } from '../utils/outfitWearSummary'

interface OutfitWearSummaryOptions {
  includeUnworn?: boolean
}

/** 한국 날짜 기준으로 오늘까지 착용을 확인한 플래너 기록의 횟수·기온을 요약한다. 확인하지 않은 오늘·미래 배정은 예정으로 반환한다. */
export function useOutfitWearSummaries(
  outfitIds: string[],
  { includeUnworn = false }: OutfitWearSummaryOptions = {},
) {
  const persistedOutfitIds = [...new Set(outfitIds)]
    .filter((id) => /^[a-f\d]{24}$/i.test(id))
    .sort()
  // 조회 상태도 구독해 응답 내용이 같아도 주기 조회·앱 복귀 뒤 날짜를 다시 계산한다.
  const { data, isSuccess, isFetching } = useOutfitWearHistoryQuery(persistedOutfitIds)
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())

  const summaries = useMemo(() => {
    const recordsByOutfitId = new Map<string, OutfitWearRecord[]>()

    for (const record of data ?? []) {
      const records = recordsByOutfitId.get(record.outfitId) ?? []
      records.push(record)
      recordsByOutfitId.set(record.outfitId, records)
    }

    const summaries = new Map<string, OutfitWearSummary>()
    for (const [outfitId, records] of recordsByOutfitId) {
      const summary = createOutfitWearSummary(records, today)
      if (summary) summaries.set(outfitId, summary)
    }

    return summaries
  }, [data, today])

  if (
    !includeUnworn ||
    !isSuccess ||
    isFetching
  ) {
    return summaries
  }

  const summariesWithUnworn = new Map(summaries)
  for (const outfitId of persistedOutfitIds) {
    if (!summariesWithUnworn.has(outfitId)) {
      summariesWithUnworn.set(outfitId, {
        label: '착용 0회',
        title: '아직 착용 기록이 없어요.',
      })
    }
  }

  return summariesWithUnworn
}
