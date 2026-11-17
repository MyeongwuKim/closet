import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'

/** 설정 상세 진입 시 화면에 초점을 두고 Tab·Escape를 내부에서 처리한다. 닫히면 entryTo의 진입 링크로 초점을 돌려준다. */
export function useSettingsDetailFocus(backTo: string, entryTo: string) {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    dialog?.focus({ preventScroll: true })

    return () => {
      window.requestAnimationFrame(() => {
        // StrictMode 재실행에서는 열린 화면의 초점을 유지한다.
        if (dialog?.isConnected) return
        const entryLink = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
          .find((link) => link.getAttribute('href') === entryTo || link.getAttribute('href') === `#${entryTo}`)
        if (entryLink) entryLink.focus({ preventScroll: true })
        else if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
          previousFocus.focus({ preventScroll: true })
        }
      })
    }
  }, [entryTo])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented) return
    if ((event.target as HTMLElement).closest('[role="dialog"]') !== dialogRef.current) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      navigate(backTo)
      return
    }
    if (event.key !== 'Tab') return

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), summary, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => {
      // 접힌 details의 자식도 레이아웃 크기를 가질 수 있어 실제 Tab 대상에서 제외한다.
      const closedDetails = element.closest('details:not([open])')
      return element.tabIndex >= 0 && element.getClientRects().length > 0 &&
        (!closedDetails || closedDetails.querySelector('summary') === element)
    })
    const first = focusableElements[0]
    const last = focusableElements.at(-1)
    if (!focusableElements.some((element) => element === document.activeElement)) {
      event.preventDefault()
      const nextFocus = event.shiftKey ? last : first
      nextFocus?.focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return { dialogRef, handleKeyDown }
}
