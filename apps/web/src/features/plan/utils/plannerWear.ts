/** 기기 시간대와 관계없이 실제 착용을 확인할 수 있는 한국의 오늘 날짜를 구한다. */
export function getKoreaPlannerToday(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now)
}

/** 한국의 오늘 날짜 문자열에 하루를 더해 기기 시간대와 관계없이 내일을 구한다. */
export function getKoreaPlannerTomorrow(today = getKoreaPlannerToday()) {
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

/** 저장한 코디가 있는 오늘·지난 날짜에만 착용 확인을 허용한다. 미래 일정과 저장 전 편집은 착용 기록을 만들지 않는다. */
export function canConfirmPlannerWear(entry: { date: string; outfitId?: string }, today = getKoreaPlannerToday()) {
  return Boolean(entry.outfitId) && entry.date <= today
}
