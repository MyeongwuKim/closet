const DAY_IN_MS = 24 * 60 * 60 * 1000

function getDateOnlyTimestamp(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const parsed = new Date(timestamp)

  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? timestamp
    : null
}

export function formatLocalDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatWearDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return `${Number(match[2])}월 ${Number(match[3])}일`
}

function getDaysSinceWear(wornDate: string, today: string) {
  const wornTimestamp = getDateOnlyTimestamp(wornDate)
  const todayTimestamp = getDateOnlyTimestamp(today)
  if (wornTimestamp === null || todayTimestamp === null) return null
  return (todayTimestamp - wornTimestamp) / DAY_IN_MS
}

/** 오늘부터 설정 일수 전까지의 실제 착용 날짜만 최근으로 본다. 날짜가 없거나 잘못된 값은 숨기지 않는다. */
export function isRecentlyWorn(wornDate: string | undefined, intervalDays: number, today: string) {
  const daysAgo = wornDate ? getDaysSinceWear(wornDate, today) : null
  return daysAgo !== null && daysAgo >= 0 && daysAgo <= intervalDays
}

export function formatRecentWearLabel(
  wornDate: string,
  today = formatLocalDateOnly(new Date()),
) {
  const daysAgo = getDaysSinceWear(wornDate, today)
  if (daysAgo === null) return null
  if (daysAgo === 0) return '오늘 착용'
  if (daysAgo === 1) return '어제 착용'
  if (daysAgo >= 2 && daysAgo <= 6) return `${daysAgo}일 전 착용`
  if (daysAgo === 7) return '일주일 전 착용'
  return `최근 착용 · ${formatWearDate(wornDate)}`
}
