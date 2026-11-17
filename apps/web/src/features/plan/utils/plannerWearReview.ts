import type { PlanEntry } from '../data/weeklyPlan'

export interface WearReviewState {
  day: string | null
  dismissed: string[]
}

/** 한국 날짜의 최근 7일 중 지난 날짜만 확인한다. UTC 날짜 연산으로 기기의 시간대·월말에 영향을 받지 않는다. */
export function wearReviewRange(today: string) {
  const time = Date.parse(`${today}T00:00:00Z`)
  const day = 86_400_000
  return { from: new Date(time - 7 * day).toISOString().slice(0, 10), to: new Date(time - day).toISOString().slice(0, 10) }
}

/** 같은 날짜라도 코디가 바뀌면 이전 코디를 넘긴 선택으로 새 코디를 숨기지 않는다. */
export function wearReviewEntryKey(entry: Pick<PlanEntry, 'date' | 'outfitId'>) {
  return `${entry.date}:${entry.outfitId ?? ''}`
}

/** 로컬의 하루 확인·넘김 기록을 읽고 오래되거나 손상된 값은 버린다. 실제 착용 상태를 나타내는 데이터는 아니다. */
export function parseWearReviewState(raw: string | null, today: string): WearReviewState {
  const empty = { day: null, dismissed: [] }
  try {
    const value = raw ? JSON.parse(raw) : null
    if (!value || !Array.isArray(value.dismissed)) return empty
    const { from, to } = wearReviewRange(today)
    return {
      day: value.day === today ? today : null,
      dismissed: value.dismissed.filter((key: unknown): key is string => typeof key === 'string' && key.length <= 128
        && key[10] === ':' && key.slice(0, 10) >= from && key.slice(0, 10) <= to).slice(-14),
    }
  } catch { return empty }
}

/** 코디가 남아 있고 실제 착용을 확인하지 않은 최근 일정 중, 사용자가 넘기지 않은 가장 최근 한 건을 고른다. */
export function findWearReviewEntry(entries: PlanEntry[], today: string, dismissed: string[]) {
  const { from, to } = wearReviewRange(today)
  return entries.filter(entry => entry.outfitId && !entry.wornAt && entry.date >= from && entry.date <= to
    && !dismissed.includes(wearReviewEntryKey(entry))).sort((a, b) => b.date.localeCompare(a.date))[0]
}
