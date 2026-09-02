import { useEffect, useId, useRef } from 'react'
import {
  Camera,
  Images,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  X,
} from 'lucide-react'
import { createPortal } from 'react-dom'

interface WardrobeImageSourceDialogProps {
  isCapturing: boolean
  onCapture: () => void
  onChooseAlbum: () => void
  onCancel: () => void
}

interface WardrobePhotoReviewDialogProps {
  previewUrl: string
  onRetake: () => void
  onUse: () => void
  onCancel: () => void
}

function useCentralDialog(
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

export function WardrobeImageSourceDialog({
  isCapturing,
  onCapture,
  onChooseAlbum,
  onCancel,
}: WardrobeImageSourceDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useCentralDialog(onCancel, {
    dismissible: !isCapturing,
  })

  return createPortal(
    <div
      className="option-picker-backdrop fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 px-5 py-8 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isCapturing) onCancel()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isCapturing}
        tabIndex={-1}
        className="option-picker-enter w-full max-w-sm overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sage">
            <ImagePlus size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl font-black">
              옷 사진 추가
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-muted">
              사진을 추가할 방법을 선택해주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isCapturing}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted transition hover:text-ink disabled:opacity-40"
            aria-label="옷 사진 추가창 닫기"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-2 p-4">
          <button
            type="button"
            onClick={onCapture}
            disabled={isCapturing}
            className="flex min-h-17 items-center gap-3 rounded-2xl border border-line bg-canvas px-4 py-3 text-left transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60"
            autoFocus
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-white">
              {isCapturing ? (
                <LoaderCircle className="animate-spin" size={20} />
              ) : (
                <Camera size={20} aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black">
                {isCapturing ? '카메라 여는 중...' : '사진 촬영'}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">
                옷 한 벌이 잘 보이게 촬영해보세요.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={onChooseAlbum}
            disabled={isCapturing}
            className="flex min-h-17 items-center gap-3 rounded-2xl border border-line bg-canvas px-4 py-3 text-left transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-40"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage">
              <Images size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black">앨범에서 선택</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted">
                여러 장을 한 번에 추가할 수 있어요.
              </span>
            </span>
          </button>
        </div>

        <div className="border-t border-line bg-canvas/60 p-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCapturing}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm font-bold transition hover:border-ink disabled:opacity-40"
          >
            취소
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}

export function WardrobePhotoReviewDialog({
  previewUrl,
  onRetake,
  onUse,
  onCancel,
}: WardrobePhotoReviewDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useCentralDialog(onCancel)

  return createPortal(
    <div
      className="option-picker-backdrop fixed inset-0 z-[130] flex items-center justify-center bg-ink/50 px-5 py-8 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="option-picker-enter flex max-h-[calc(100dvh-4rem)] w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl font-black">
              이 사진을 사용할까요?
            </h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-muted">
              옷이 선명하게 보이는지 확인해주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted transition hover:text-ink"
            aria-label="촬영한 사진 확인창 닫기"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 bg-canvas p-4">
          <div className="flex h-full min-h-64 max-h-[55dvh] items-center justify-center overflow-hidden rounded-2xl border border-line bg-white">
            <img
              src={previewUrl}
              alt="촬영한 옷 사진 미리보기"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-line bg-surface p-4">
          <button
            type="button"
            onClick={onRetake}
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-3 text-sm font-bold transition hover:border-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
          >
            <RotateCcw size={17} aria-hidden="true" />
            다시 촬영
          </button>
          <button
            type="button"
            onClick={onUse}
            className="rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white transition hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            autoFocus
          >
            이 사진 사용
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
