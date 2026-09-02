import { useEffect, useState } from 'react'
import type { WardrobeItem } from '@closet/types'
import { AlertCircle, BookPlus, RefreshCw, Sparkles, X } from 'lucide-react'
import { ClosetItemVisual } from '../../closet/components/ClosetItemVisual'
import {
  type OutfitPreviewState,
  useOutfitComposer,
} from '../contexts/OutfitComposerContext'

const loadingMessages = [
  '선택한 옷의 색과 소재를 살펴보고 있어요',
  '옷의 길이와 실루엣을 맞추고 있어요',
  '한 벌의 룩으로 자연스럽게 조합하고 있어요',
  '룩북 조명과 구도를 다듬고 있어요',
]

interface OutfitPreviewDialogViewProps {
  selectedItems: WardrobeItem[]
  preview: OutfitPreviewState
  generatePreview: () => void
  closePreview: () => void
  onPrimary: () => void
  primaryLabel?: string
  primaryAction?: 'save' | 'close'
  isPrimaryPending?: boolean
}

export function OutfitPreviewDialogView({
  selectedItems,
  preview,
  generatePreview,
  closePreview,
  onPrimary,
  primaryLabel = '코디북에 추가',
  primaryAction = 'save',
  isPrimaryPending = false,
}: OutfitPreviewDialogViewProps) {
  const [loadingStage, setLoadingStage] = useState(0)

  useEffect(() => {
    if (!preview.isOpen || preview.status !== 'loading') return
    const timer = window.setInterval(() => {
      setLoadingStage((current) => (current + 1) % loadingMessages.length)
    }, 2400)
    return () => window.clearInterval(timer)
  }, [preview.isOpen, preview.status])

  if (!preview.isOpen) return null

  const isLoading = preview.status === 'loading'
  const isSuccess =
    preview.status === 'success' && Boolean(preview.imageUrl)

  return (
    <div
      className="classification-page-enter fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="outfit-preview-title"
      aria-busy={isLoading}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePreview()
      }}
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-[1.75rem] bg-surface shadow-2xl sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-sage text-accent">
            <Sparkles size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="outfit-preview-title" className="text-base font-black">
              {isLoading
                ? 'AI가 룩북을 만들고 있어요'
                : isSuccess
                  ? 'AI 룩 미리보기'
                  : '미리보기를 만들지 못했어요'}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              선택한 옷 {selectedItems.length}개로 만든 예시 이미지
            </p>
          </div>
          <button
            type="button"
            onClick={closePreview}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
            aria-label="AI 룩 미리보기 닫기"
          >
            <X size={18} />
          </button>
        </header>

        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex min-h-[31rem] flex-col items-center justify-center overflow-hidden rounded-3xl bg-canvas px-5 py-8 text-center shadow-[inset_0_0_0_1px_#dedad1]">
              <div className="relative flex size-40 items-center justify-center">
                <span className="absolute inset-2 animate-spin rounded-full border border-dashed border-accent/45 [animation-duration:9s]" />
                <span className="absolute inset-7 animate-pulse rounded-full bg-sage" />
                <span className="relative flex size-16 items-center justify-center rounded-3xl bg-surface text-accent shadow-lg">
                  <Sparkles className="animate-pulse" size={28} />
                </span>
              </div>

              <div className="mt-5 flex max-w-full justify-center gap-2">
                {selectedItems.slice(0, 5).map((item, index) => (
                  <span
                    className={`flex size-12 items-center justify-center overflow-hidden rounded-xl border bg-surface p-1 transition duration-500 ${
                      index === loadingStage % Math.min(selectedItems.length, 5)
                        ? 'scale-110 border-accent shadow-md'
                        : 'border-line opacity-55'
                    }`}
                    key={item.id}
                  >
                    <ClosetItemVisual item={item} compact />
                  </span>
                ))}
              </div>

              <strong className="mt-8 text-base font-black">
                {loadingMessages[loadingStage]}
              </strong>
              <p className="mt-2 max-w-64 text-xs leading-5 text-muted">
                옷 사진과 입력한 실루엣 수치를 참고하고 있어요. 생성에는
                시간이 조금 걸릴 수 있어요.
              </p>

              <div className="mt-6 flex gap-1.5" aria-hidden="true">
                {loadingMessages.map((message, index) => (
                  <span
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      index === loadingStage
                        ? 'w-6 bg-accent'
                        : 'w-1.5 bg-line'
                    }`}
                    key={message}
                  />
                ))}
              </div>
            </div>
          ) : isSuccess ? (
            <div>
              <div className="relative aspect-[2/3] overflow-hidden rounded-3xl bg-canvas shadow-[inset_0_0_0_1px_#dedad1]">
                <img
                  src={preview.imageUrl!}
                  alt="선택한 옷으로 생성한 AI 룩 미리보기"
                  className="size-full object-cover"
                />
                <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">
                  AI 예시 이미지
                </span>
              </div>
              <p className="mt-3 px-1 text-center text-[11px] leading-5 text-muted">
                입력한 옷과 신체 수치를 참고한 예시이며 실제 착용 핏과 디테일은
                다를 수 있어요.
              </p>
            </div>
          ) : (
            <div className="flex min-h-96 flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-canvas px-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                <AlertCircle size={24} />
              </span>
              <strong className="mt-5 text-base font-black">
                이미지를 완성하지 못했어요
              </strong>
              <p className="mt-2 text-xs leading-5 text-muted">
                {preview.errorMessage ??
                  '잠시 후 다시 만들기를 눌러주세요.'}
              </p>
            </div>
          )}
        </div>

        {!isLoading && (
          <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={generatePreview}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold"
            >
              <RefreshCw size={14} /> 다시 만들기
            </button>
            <button
              type="button"
              onClick={isSuccess ? onPrimary : closePreview}
              disabled={isSuccess && isPrimaryPending}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white"
            >
              {isSuccess ? (
                <>
                  {primaryAction === 'close' ? (
                    <X size={15} />
                  ) : (
                    <BookPlus size={15} />
                  )}
                  {primaryAction === 'save' && isPrimaryPending
                    ? '저장 중...'
                    : primaryLabel}
                </>
              ) : (
                '닫기'
              )}
            </button>
          </footer>
        )}
      </div>
    </div>
  )
}

interface OutfitPreviewDialogProps {
  isReadOnly?: boolean
}

export function OutfitPreviewDialog({
  isReadOnly = false,
}: OutfitPreviewDialogProps) {
  const {
    selectedItems,
    preview,
    generatePreview,
    addPreviewToLookbook,
    closePreview,
  } = useOutfitComposer()

  return (
    <OutfitPreviewDialogView
      selectedItems={selectedItems}
      preview={preview}
      generatePreview={generatePreview}
      closePreview={closePreview}
      onPrimary={isReadOnly ? closePreview : addPreviewToLookbook}
      primaryLabel={isReadOnly ? '닫기' : undefined}
      primaryAction={isReadOnly ? 'close' : 'save'}
    />
  )
}
