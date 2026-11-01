import { useEffect, useState } from 'react'

/** 서버의 충전 시각까지 남은 초를 표시한다. 서버 응답 시각과 캐시 갱신 시점을 함께 사용해 기기 시계 차이를 줄인다. 실제 지급은 서버가 결정한다. */
export function useCreditRefillCountdown(nextRefillAt: string | null | undefined, serverNow: string | null | undefined, dataUpdatedAt: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!nextRefillAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [nextRefillAt])
  if (!nextRefillAt) return null
  const target = Date.parse(nextRefillAt)
  const serverTime = serverNow ? Date.parse(serverNow) : NaN
  const estimatedNow = Number.isFinite(serverTime) ? serverTime + Math.max(0, now - dataUpdatedAt) : now
  return Math.max(0, Math.ceil((target - estimatedNow) / 1000))
}
