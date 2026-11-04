import { useEffect, useRef } from 'react'
import { markWardrobeRediscoverySeen } from '../api/wardrobeRediscoveryQueries'

/**
 * 카드 절반 이상이 보이고 앱이 전면일 때만 노출을 기록한다. 숨겨진 가로 카드·다른 경로·배경 앱은 제외한다.
 * 일시 실패는 다음 노출에서 재시도하며, 계정·날짜가 바뀌거나 닫히면 진행 요청과 관찰을 정리한다.
 */
export function useRediscoveryImpression(viewerId: string, day: string, itemId: string, enabled: boolean) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return
    const controller = new AbortController()
    let isIntersecting = false
    let pending = false
    let recorded = false
    const record = async () => {
      if (!isIntersecting || document.visibilityState !== 'visible' || pending || recorded) return
      pending = true
      try {
        await markWardrobeRediscoverySeen(day, [itemId], controller.signal)
        recorded = true
      } catch {
        // 보조 이력 저장 실패가 옷장 탐색이나 코디 추천을 막지 않게 한다.
      } finally {
        pending = false
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      isIntersecting = entry.isIntersecting && entry.intersectionRatio >= 0.5
      void record()
    }, { threshold: 0.5 })
    observer.observe(element)
    const handleVisibility = () => { void record() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      controller.abort()
      observer.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [viewerId, day, itemId, enabled])
  return ref
}
