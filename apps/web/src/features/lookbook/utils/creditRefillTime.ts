/** 충전 대기 시간을 분·초로 표시한다. null이면 충전 시각을 아직 확인하지 못한 상태다. */
export function formatCreditRefillTime(seconds: number | null) {
  if (seconds === null) return '충전'
  const remaining = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(remaining / 60)}분 ${remaining % 60}초`
}
