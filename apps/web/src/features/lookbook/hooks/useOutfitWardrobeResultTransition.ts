import { useEffect, useState } from 'react'

/**
 * 옷장 검색어·계절·색상 조건이 바뀌면 짧게 스켈레톤을 보여준 뒤 현재 조건의 결과를 표시한다.
 * 연속 입력에서는 앞선 타이머를 취소하며, 동작 줄이기 설정에서는 결과를 즉시 보여준다.
 */
export function useOutfitWardrobeResultTransition(
  filterKey: string,
  hasItems: boolean,
  showInitialSkeleton: boolean,
) {
  const [settledFilterKey, setSettledFilterKey] = useState(() =>
    showInitialSkeleton ? '' : filterKey,
  )
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const isPending = hasItems && !reduceMotion && settledFilterKey !== filterKey

  useEffect(() => {
    if (settledFilterKey === filterKey) return
    const timer = window.setTimeout(
      () => setSettledFilterKey(filterKey),
      reduceMotion ? 0 : 220,
    )
    return () => window.clearTimeout(timer)
  }, [filterKey, reduceMotion, settledFilterKey])

  return isPending
}
