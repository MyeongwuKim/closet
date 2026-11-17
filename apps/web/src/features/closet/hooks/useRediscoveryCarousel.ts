import { useLayoutEffect, useRef, useState } from 'react'

/** 수동 스와이프·이전/다음·키보드 이동을 같은 카드 위치로 맞춘다. 화면 크기가 바뀌어도 보고 있던 카드를 유지하며 자동 재생은 하지 않는다. */
export function useRediscoveryCarousel(initialIndex: number) {
  const rail = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const indexRef = useRef(initialIndex)

  useLayoutEffect(() => {
    const element = rail.current
    if (!element) return
    const align = () => {
      const cards = element.querySelectorAll<HTMLElement>('[data-rediscovery-card]')
      if (cards[indexRef.current] && cards[0]) element.scrollLeft = cards[indexRef.current].offsetLeft - cards[0].offsetLeft
    }
    align()
    const observer = new ResizeObserver(align)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /** 스크롤한 실제 위치로 현재 번호를 바꾼다. 숨겨진 카드의 버튼과 노출 확인도 이 번호를 따른다. */
  const onScroll = () => {
    const element = rail.current
    if (!element) return
    const cards = [...element.querySelectorAll<HTMLElement>('[data-rediscovery-card]')]
    if (!cards.length) return
    const firstOffset = cards[0].offsetLeft
    const next = cards.reduce((nearest, card, index) =>
      Math.abs(card.offsetLeft - firstOffset - element.scrollLeft) < Math.abs(cards[nearest].offsetLeft - firstOffset - element.scrollLeft) ? index : nearest, 0)
    indexRef.current = next
    setActiveIndex(next)
  }

  /** 사용자가 명시한 방향으로만 움직이고 모션 감소 설정에서는 즉시 이동한다. */
  const moveTo = (index: number) => {
    const element = rail.current
    const cards = element?.querySelectorAll<HTMLElement>('[data-rediscovery-card]')
    if (!element || !cards?.[index] || !cards[0]) return
    element.scrollTo({ left: cards[index].offsetLeft - cards[0].offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return { rail, activeIndex, onScroll, moveTo }
}
