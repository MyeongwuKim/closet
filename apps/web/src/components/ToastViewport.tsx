import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useUiStore } from '../stores/useUiStore'

const toastStyles = {
  info: {
    icon: Info,
    className: 'border-line bg-surface text-ink',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-[#b8c99e] bg-[#edf3e5] text-[#38432f]',
  },
  error: {
    icon: XCircle,
    className: 'border-[#edb6aa] bg-[#fff0ec] text-[#8d3525]',
  },
}

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts)
  const dismissToast = useUiStore((state) => state.dismissToast)

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-[200] grid gap-2 md:right-6 md:bottom-6 md:left-auto md:w-[min(360px,calc(100vw-48px))]"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => {
        const style = toastStyles[toast.variant]
        const Icon = style.icon

        return (
          <div
            className={`toast-enter pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-lg ${style.className}`}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            key={toast.id}
          >
            <Icon size={19} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1 text-sm leading-6">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded-full p-1 opacity-60 hover:opacity-100"
              aria-label="알림 닫기"
            >
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
