import { useEffect, useRef, useState } from 'react'

export type WardrobeTransitionPhase = 'idle' | 'closing' | 'waiting' | 'opening'

/**
 * 계절 선택 시 문을 먼저 닫고 조건을 적용한다. 새 목록의 로딩이 끝나면 문을 연다.
 * 서버 데이터는 호출한 페이지에서 관리하며, 연속 선택과 화면 이탈 시 예약된 전환을 취소한다.
 */
export function useWardrobeTransition(isPending: boolean) {
  const [phase, setPhase] = useState<WardrobeTransitionPhase>('idle')
  // 문 닫힘 뒤 필터 적용 또는 문 열림 완료를 예약한 타이머를 보관한다.
  const timer = useRef<number | undefined>(undefined)
  // 계절을 다시 선택했을 때 이전 프레임의 문 열림 처리를 무시한다.
  const revision = useRef(0)

  /** 문 닫힘 후 applyFilter를 실행한다. 동작 줄이기 설정에서는 조건을 즉시 적용한다. */
  function changeSeason(applyFilter: () => void) {
    window.clearTimeout(timer.current)
    revision.current += 1
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyFilter()
      setPhase('idle')
      return
    }
    setPhase('closing')
    timer.current = window.setTimeout(() => {
      applyFilter()
      setPhase('waiting')
    }, 220)
  }

  useEffect(() => {
    if (phase !== 'waiting' || isPending) return
    const currentRevision = revision.current
    const frame = window.requestAnimationFrame(() => {
      if (revision.current !== currentRevision) return
      setPhase('opening')
      timer.current = window.setTimeout(() => setPhase('idle'), 260)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isPending, phase])

  useEffect(() => () => {
    window.clearTimeout(timer.current)
    revision.current += 1
  }, [])

  return { phase, changeSeason }
}
