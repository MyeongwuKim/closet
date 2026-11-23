import { AlertTriangle, BookPlus, X } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  alternativeAction?: { label: string; onSelect: () => void }
  tone?: 'danger' | 'accent'
  pendingLabel?: string
  isPending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** 삭제 등의 확인 요청을 표시한다. 처리 중에는 취소와 확인을 비활성화하며 실제 변경은 onConfirm에 맡긴다. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = '취소',
  alternativeAction,
  tone = 'danger',
  pendingLabel = '삭제하는 중…',
  isPending = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const isAccent = tone === 'accent'
  const Icon = isAccent ? BookPlus : AlertTriangle
  return (
    <div
      className="option-picker-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-ink/40 px-5 py-8 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onCancel()
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && alternativeAction && !isPending) {
            event.stopPropagation()
            onCancel()
          }
        }}
        className="option-picker-enter w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${isAccent ? 'bg-sage text-accent' : 'bg-danger-soft text-danger'}`}>
              <Icon size={21} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="confirm-dialog-title" className="text-xl font-semibold tracking-[-.03em]">
                {title}
              </h2>
              <p
                id="confirm-dialog-description"
                className="mt-2 text-sm leading-6 text-muted"
              >
                {description}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted hover:text-ink disabled:opacity-40"
              aria-label="확인창 닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-line bg-canvas/60 p-4">
          <button
            type="button"
            onClick={alternativeAction?.onSelect ?? onCancel}
            disabled={isPending}
            autoFocus={isAccent && !alternativeAction}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold disabled:opacity-40"
          >
            {alternativeAction?.label ?? cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            autoFocus={Boolean(alternativeAction)}
            className={`rounded-xl px-4 py-3 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60 ${isAccent ? 'bg-accent' : 'bg-danger'}`}
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
