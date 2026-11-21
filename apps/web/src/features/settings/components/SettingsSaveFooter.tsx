import { Save } from 'lucide-react'

interface SettingsSaveFooterProps {
  label: string
  isPending: boolean
  disabled?: boolean
}

/** 설정 폼의 저장 버튼을 화면 하단에 고정하고 안전 영역 여백을 확보한다. */
export function SettingsSaveFooter({ label, isPending, disabled = false }: SettingsSaveFooterProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)] backdrop-blur sm:px-6 sm:pt-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-2xl">
        <button
          type="submit"
          disabled={disabled || isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          <Save size={17} aria-hidden="true" />
          {isPending ? '저장 중…' : label}
        </button>
      </div>
    </div>
  )
}
