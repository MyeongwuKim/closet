import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel: string
  isPending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  isPending = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
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
        className="option-picker-enter w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff0ec] text-accent">
              <AlertTriangle size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="confirm-dialog-title" className="text-xl font-black">
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
            onClick={onCancel}
            disabled={isPending}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {isPending ? '삭제하는 중...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
