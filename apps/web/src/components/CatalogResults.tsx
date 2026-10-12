import { useLayoutEffect, useRef, type ReactNode } from 'react'

interface CatalogResultsProps {
  children: ReactNode
  /** 조회 조건과 이미지 보기 모드. 추가 페이지나 착용 기록 갱신은 이 값에 포함하지 않는다. */
  resultKey: string
  /** 입력 지연·새 조건 조회 중에는 기존 결과를 흐리게 표시하고 조작을 막는다. */
  isPending: boolean
  /** 계절 문 열림·종류 이동처럼 부모 전환이 있을 때는 결과 등장 효과를 겹치지 않는다. */
  animate?: boolean
}

/** 준비된 검색·필터 결과를 짧은 간격으로 들여온다. 조회 중에는 이전 결과를 유지하며, 추가 페이지를 가져오거나 같은 조건이 재조회될 때 기존 카드는 다시 움직이지 않는다. */
export function CatalogResults({ children, resultKey, isPending, animate = true }: CatalogResultsProps) {
  const regionRef = useRef<HTMLDivElement>(null)
  const shownKey = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (isPending || shownKey.current === resultKey) return
    shownKey.current = resultKey
    const region = regionRef.current
    if (!region || !animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const cards = [...region.querySelectorAll<HTMLElement>('[data-catalog-item]')].slice(0, 12)
    const targets = cards.length ? cards : [region]
    const animations = targets.map((target, index) => target.animate([
      { opacity: 0.35, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 300, delay: Math.min(index, 5) * 24, easing: 'cubic-bezier(.22,.75,.3,1)', fill: 'backwards' }))
    return () => animations.forEach((animation) => animation.cancel())
  }, [resultKey, isPending, animate])

  return <div ref={regionRef} className="catalog-results" data-pending={isPending} inert={isPending} aria-busy={isPending}>{children}</div>
}
