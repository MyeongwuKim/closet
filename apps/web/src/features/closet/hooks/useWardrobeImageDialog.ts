import { useEffect, useRef } from 'react'

/** 사진 추가·촬영 확인창 안에서 Tab 초점을 순환시키고 배경 스크롤을 막는다. dismissible이면 Escape로 닫으며 닫힘 후 초점 복원은 사진 선택 Hook에서 담당한다. */
export function useWardrobeImageDialog(
  onClose: () => void,
  options: { dismissible?: boolean } = {},
) {
  const { dismissible = true } = options
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0)

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)!
      const activeElement = document.activeElement
      const focusIsOutside = !dialogRef.current.contains(activeElement)

      if (event.shiftKey && (activeElement === firstElement || focusIsOutside)) {
        event.preventDefault()
        lastElement.focus()
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || focusIsOutside)
      ) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    const focusTimer = window.requestAnimationFrame(() => {
      if (!dialogRef.current?.contains(document.activeElement)) {
        dialogRef.current
          ?.querySelector<HTMLElement>('button:not([disabled])')
          ?.focus()
      }
    })
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [dismissible, onClose])

  return dialogRef
}
