import { useLayoutEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import './AccountDeletionDialog.css'

/** 탈퇴의 마지막 확인만 별도 초점 영역으로 연다. 취소에 먼저 초점을 두고 처리 중 이탈·중복 확인을 막는다. */
export function AccountDeletionDialog({ pending, onCancel, onConfirm }: { pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (!restoreFocusRef.current && document.activeElement instanceof HTMLElement) restoreFocusRef.current = document.activeElement
    const container = containerRef.current!
    const dialog = container.querySelector<HTMLElement>('[role="alertdialog"]')!
    dialog.tabIndex = -1
    const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    ;(buttons()[0] ?? dialog).focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (!pending) onCancel()
      } else if (event.key === 'Tab') {
        const targets = buttons()
        const index = targets.indexOf(document.activeElement as HTMLButtonElement)
        if (index === -1 || event.shiftKey && index === 0 || !event.shiftKey && index === targets.length - 1) {
          event.preventDefault()
          event.stopImmediatePropagation()
          ;(event.shiftKey ? targets.at(-1) ?? dialog : targets[0] ?? dialog).focus()
        }
      }
    }
    document.addEventListener('keydown', keydown, true)
    return () => {
      document.removeEventListener('keydown', keydown, true)
      requestAnimationFrame(() => {
        if (!container.isConnected && restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus()
      })
    }
  }, [pending, onCancel])
  return <div ref={containerRef} className="account-deletion-backdrop" onMouseDown={event => {
    if (event.target === event.currentTarget && !pending) onCancel()
  }}>
    <section role="alertdialog" aria-modal="true" aria-labelledby="account-deletion-title" aria-describedby="account-deletion-description" tabIndex={-1} className="account-deletion-dialog">
      <header className="account-deletion-header">
        <AlertTriangle size={24} className="shrink-0 text-danger" aria-hidden="true" />
        <h2 id="account-deletion-title">회원탈퇴할까요?</h2>
        <button type="button" disabled={pending} onClick={onCancel} className="account-deletion-close" aria-label="확인창 닫기"><X size={20} /></button>
      </header>
      <div className="account-deletion-body"><p id="account-deletion-description">옷장, 코디와 착용 기록이 모두 삭제돼요. 탈퇴 후에는 복구할 수 없어요.</p></div>
      <footer className="account-deletion-actions">
        <button type="button" disabled={pending} onClick={onCancel}>취소</button>
        <button type="button" disabled={pending} onClick={onConfirm}>{pending ? '탈퇴 처리 중…' : '탈퇴하기'}</button>
      </footer>
    </section>
  </div>
}
