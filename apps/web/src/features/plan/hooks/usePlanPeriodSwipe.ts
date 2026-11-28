import { useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

interface SwipeStart {
  pointerId: number
  x: number
  y: number
}

const SWIPE_DISTANCE = 48
const SCROLL_LOCK_DISTANCE = 12

/** 플래너 본문의 한 손가락 제스처를 이전·다음 기간 이동으로 연결한다. 버튼에서 시작한 제스처는 각 버튼에서 처리한다. */
export function usePlanPeriodSwipe(onMovePeriod: (offset: -1 | 1) => void) {
  const startRef = useRef<SwipeStart | null>(null)
  // 스와이프 직후 브라우저가 보내는 클릭으로 날짜 링크가 열리는 것을 막는다.
  const suppressClickRef = useRef(false)

  const onPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    startRef.current = null
    suppressClickRef.current = false

    const target = event.target
    if (event.pointerType !== 'touch' || !event.isPrimary || !(target instanceof Element)) return
    if (!target.closest('[data-plan-period-body]') || target.closest('button, input, select, textarea, [contenteditable]')) return

    startRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = startRef.current
    if (start?.pointerId !== event.pointerId) return

    const horizontal = Math.abs(event.clientX - start.x)
    const vertical = Math.abs(event.clientY - start.y)
    if (vertical >= SCROLL_LOCK_DISTANCE && vertical >= horizontal) startRef.current = null
  }

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = startRef.current
    if (start?.pointerId !== event.pointerId) return
    startRef.current = null

    const horizontal = event.clientX - start.x
    const vertical = Math.abs(event.clientY - start.y)
    if (Math.abs(horizontal) < SWIPE_DISTANCE || Math.abs(horizontal) <= vertical * 1.4) return

    suppressClickRef.current = true
    onMovePeriod(horizontal < 0 ? 1 : -1)
  }

  const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
    if (startRef.current?.pointerId === event.pointerId) startRef.current = null
  }

  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current || event.detail === 0) return
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return { onPointerDownCapture, onPointerMove, onPointerUp, onPointerCancel, onClickCapture }
}
