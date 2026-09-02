/**
 * 용도:
 * 최근에 입은 코디나 옷을 다시 추가하려 할 때 한 번 더 확인한다.
 *
 * 구조:
 * 최근 착용 안내와 취소·계속 진행 버튼으로 구성되어 있다.
 */
import { useEffect, useRef } from 'react'
import { History, X } from 'lucide-react'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { useUiStore } from '../../../stores/useUiStore'
import { getRecentWearReminderCopy } from '../utils/recentWearReminder'

export function RecentWearReminderDialog() {
  const reminder = useUiStore((state) => state.recentWearConfirmation)
  const resolveConfirmation = useUiStore(
    (state) => state.resolveRecentWearConfirmation,
  )
  const wardrobeItems = useClosetStore((state) => state.items)
  const dialogRef = useRef<HTMLElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!reminder) return

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        resolveConfirmation(false)
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)
      if (!firstElement || !lastElement) return

      if (event.shiftKey) {
        if (
          document.activeElement === firstElement ||
          !dialogRef.current.contains(document.activeElement)
        ) {
          event.preventDefault()
          lastElement.focus()
        }
        return
      }
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      if (useUiStore.getState().recentWearConfirmation === reminder) {
        resolveConfirmation(false)
      }
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [reminder, resolveConfirmation])

  if (!reminder) return null

  const copy = getRecentWearReminderCopy(reminder, wardrobeItems)

  return (
    <div
      className="option-picker-backdrop fixed inset-0 z-[140] flex items-center justify-center bg-ink/40 px-5 py-8 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) resolveConfirmation(false)
      }}
    >
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="recent-wear-reminder-title"
        aria-describedby="recent-wear-reminder-description"
        className="option-picker-enter w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage text-ink">
              <History size={21} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id="recent-wear-reminder-title"
                className="text-xl font-black"
              >
                {copy.title}
              </h2>
              <p
                id="recent-wear-reminder-description"
                className="mt-2 text-sm leading-6 text-muted"
              >
                {copy.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => resolveConfirmation(false)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted hover:text-ink"
              aria-label="최근 착용 안내 닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-line bg-canvas/60 p-4">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={() => resolveConfirmation(false)}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold"
          >
            {reminder.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => resolveConfirmation(true)}
            className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white"
          >
            {reminder.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
