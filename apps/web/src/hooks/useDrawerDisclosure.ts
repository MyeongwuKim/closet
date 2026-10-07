import { useEffect, useRef, useState } from 'react'

/** 서랍을 닫는 움직임이 끝날 때까지 내용을 유지한다. 다시 열거나 화면을 떠나면 기존 닫힘 예약을 취소한다. */
export function useDrawerDisclosure() {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  /** 닫힘 예약을 취소하고 서랍의 내용과 열림 상태를 함께 표시한다. */
  function open() {
    window.clearTimeout(closeTimer.current)
    setIsVisible(true)
    setIsOpen(true)
  }

  /** 동작 줄이기 설정이면 바로 숨기고, 그 외에는 200ms 닫힘 애니메이션 뒤 숨긴다. */
  function close() {
    window.clearTimeout(closeTimer.current)
    setIsOpen(false)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setIsVisible(false)
    else closeTimer.current = window.setTimeout(() => setIsVisible(false), 200)
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])
  return { isOpen, isVisible, open, close }
}
