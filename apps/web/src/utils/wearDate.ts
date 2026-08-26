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

export function formatRecentWearLabel(
  wornDate: string,
  today = formatLocalDateOnly(new Date()),
) {
  const wornTimestamp = getDateOnlyTimestamp(wornDate)
  const todayTimestamp = getDateOnlyTimestamp(today)
  if (wornTimestamp === null || todayTimestamp === null) return null

  const daysAgo = Math.round((todayTimestamp - wornTimestamp) / DAY_IN_MS)
  if (daysAgo === 0) return '오늘 착용'
  if (daysAgo === 1) return '어제 착용'
  if (daysAgo >= 2 && daysAgo <= 6) return `${daysAgo}일 전 착용`
  if (daysAgo === 7) return '일주일 전 착용'
  return `최근 착용 · ${formatWearDate(wornDate)}`
}
