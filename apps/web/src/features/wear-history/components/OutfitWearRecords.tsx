import { useTemperatureWearHistory } from '../api/wearHistoryQueries'
import { WearHistoryRecords } from './WearHistoryRecords'

/** 저장된 코디와 옷 구성이 정확히 같은 날짜별 착용 기록을 조회한다. */
export function OutfitWearRecords({ itemIds }: { itemIds: string[] }) {
  const history = useTemperatureWearHistory({ compositionItemIds: itemIds, limit: 1 }, itemIds.length > 0)
  const records = history.data?.pages[0]?.items[0]?.records
  if (history.isError) return <p role="status" className="mx-auto mt-6 max-w-xl text-sm text-muted">
    착용 기록을 불러오지 못했어요. <button type="button" onClick={() => void history.refetch()} className="font-semibold text-accent underline">다시 시도</button>
  </p>
  return records?.length ? <WearHistoryRecords records={records} /> : null
}
