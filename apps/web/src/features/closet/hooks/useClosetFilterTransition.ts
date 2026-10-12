import { useEffect, useRef, useState } from 'react'

const FILTER_EXIT_DURATION = 170
const FILTER_ENTER_DURATION = 280

type FilterTransitionPhase = 'idle' | 'leaving' | 'waiting' | 'entering'
interface FilterTransition {
  phase: FilterTransitionPhase
  /** 다시 보여줄 목록의 URL 조건. 이전 조건의 조회 결과로 들어오기 효과를 시작하지 않는다. */
  targetKey: string | null
  revision: number
}

/**
 * 종류 필터의 기존 목록을 먼저 내보내고, 선택한 조건의 실제 조회 결과가 준비되면 새 목록을 들여온다.
 * filterKey는 현재 URL의 카테고리·세부 종류를 구분하며, isPending에는 이전 목록을 임시 표시하는 조회 상태도 포함한다.
 * 조회와 URL 변경은 페이지에 맡기고 전환 순서·예약 작업만 관리한다.
 */
export function useClosetFilterTransition(filterKey: string, isPending: boolean) {
  const [transition, setTransition] = useState<FilterTransition>({ phase: 'idle', targetKey: null, revision: 0 })
  // 나가기 완료 또는 들어오기 완료를 예약한 타이머. 연속 선택·화면 이탈 시 취소한다.
  const timer = useRef<number | undefined>(undefined)
  // 마지막 선택의 예약 작업만 실행하도록 요청 순서를 구분한다.
  const revision = useRef(0)

  /** nextFilterKey에 해당하는 조건을 나가기 완료 후 적용한다. 연속 선택은 마지막 요청만 유지하며, 동작 줄이기 설정에서는 즉시 적용한다. */
  function changeFilter(nextFilterKey: string, applyFilter: () => void) {
    window.clearTimeout(timer.current)
    const currentRevision = ++revision.current

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyFilter()
      setTransition({ phase: 'idle', targetKey: null, revision: currentRevision })
      return
    }

    if (transition.phase === 'waiting') {
      applyFilter()
      setTransition({ phase: 'waiting', targetKey: nextFilterKey, revision: currentRevision })
      return
    }

    setTransition({ phase: 'leaving', targetKey: nextFilterKey, revision: currentRevision })
    timer.current = window.setTimeout(() => {
      if (revision.current !== currentRevision) return
      applyFilter()
      setTransition({ phase: 'waiting', targetKey: nextFilterKey, revision: currentRevision })
    }, FILTER_EXIT_DURATION)
  }

  // URL이 요청한 조건으로 바뀌고 실제 결과 또는 오류가 도착한 뒤에만 들어오기 효과를 시작한다.
  useEffect(() => {
    if (transition.phase !== 'waiting' || filterKey !== transition.targetKey || isPending) return
    const currentRevision = transition.revision
    const frame = window.requestAnimationFrame(() => {
      if (revision.current !== currentRevision) return
      setTransition({ ...transition, phase: 'entering' })
      timer.current = window.setTimeout(() => {
        if (revision.current !== currentRevision) return
        setTransition({ phase: 'idle', targetKey: null, revision: currentRevision })
      }, FILTER_ENTER_DURATION)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [filterKey, isPending, transition])

  useEffect(() => () => {
    window.clearTimeout(timer.current)
    revision.current += 1
  }, [])

  return {
    phase: transition.phase,
    contentClassName: {
      idle: '',
      leaving: 'closet-filter-leave',
      waiting: 'closet-filter-waiting',
      entering: 'closet-filter-enter',
    }[transition.phase],
    changeFilter,
  }
}
