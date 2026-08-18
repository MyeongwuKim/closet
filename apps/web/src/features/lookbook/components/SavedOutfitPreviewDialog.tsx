import { RefreshCw, Sparkles, X } from 'lucide-react'

interface SavedOutfitPreviewDialogProps {
  imageUrl: string
  outfitName: string
  isSaved?: boolean
  onClose: () => void
  onRegenerate?: () => void
}

export function SavedOutfitPreviewDialog({
  imageUrl,
  outfitName,
  isSaved = true,
  onClose,
  onRegenerate,
}: SavedOutfitPreviewDialogProps) {
  return (
    <div
      className="classification-page-enter fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-lookbook-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-[1.75rem] bg-surface shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-sage text-accent">
            <Sparkles size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="saved-lookbook-title" className="text-base font-black">
              AI 룩북
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {isSaved
                ? `${outfitName}에 저장된 이미지`
                : '현재 조합으로 만든 미리보기'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
            aria-label="저장된 AI 룩북 닫기"
            autoFocus
          >
            <X size={18} />
          </button>
        </header>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-4">
          <div className="relative aspect-[2/3] overflow-hidden rounded-3xl bg-canvas shadow-[inset_0_0_0_1px_#dedad1]">
            <img
              src={imageUrl}
              alt={`${outfitName} AI 룩북 이미지`}
              className="size-full object-cover"
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">
              {isSaved ? '저장된 AI 예시 이미지' : 'AI 예시 이미지'}
            </span>
          </div>
          <p className="mt-3 px-1 text-center text-[11px] text-muted">
            AI 참고 이미지로 실제 착용 모습과 다를 수 있어요.
          </p>
        </div>

        <footer
          className={`shrink-0 gap-2 border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] ${
            onRegenerate ? 'grid grid-cols-[1.35fr_0.65fr]' : 'block'
          }`}
        >
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold"
            >
              <RefreshCw size={14} /> 현재 프로필로 다시 만들기
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  )
}
