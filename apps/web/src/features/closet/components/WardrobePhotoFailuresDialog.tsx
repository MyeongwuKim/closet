import { useCallback, useId, useLayoutEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { FailedWardrobePhoto } from '../hooks/useWardrobeImageAnalysis'

interface WardrobePhotoFailuresDialogProps {
  photos: FailedWardrobePhoto[]
  onClose: () => void
  onRetry: (id: string) => void
  onExclude: (id: string) => void
}

/** 옷장에 남아 있는 실패 원본을 표시하고, 사진별 재시도와 제외를 분석 대기열에 위임한다. */
export function WardrobePhotoFailuresDialog({ photos, onClose, onRetry, onExclude }: WardrobePhotoFailuresDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  useLayoutEffect(() => { titleRef.current?.focus() }, [photos.length])

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId}
      onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation() }}
      onCancel={(event) => { event.preventDefault(); onClose() }}
      className="option-picker-enter fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl bg-surface text-ink shadow-2xl open:flex backdrop:bg-ink/40">
      <header className="flex shrink-0 items-center justify-between gap-2 px-5 pt-4">
        <h2 ref={titleRef} id={titleId} tabIndex={-1} className="break-keep text-xl font-semibold tracking-tight focus:outline-none">
          사진을 처리하지 못했어요
        </h2>
        <button type="button" aria-label="사진 실패 안내 닫기" onClick={onClose}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-canvas focus-visible:outline-2 focus-visible:outline-accent">
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <ul className="min-h-0 divide-y divide-line overflow-y-auto overscroll-contain px-5">
        {photos.map(({ id, file, message }) => (
          <li key={id} className="space-y-4 pt-3 pb-5">
            <div className="flex items-center gap-3">
              <FailedPhotoThumbnail file={file} />
              <div className="min-w-0">
                <p className="break-keep text-base leading-snug">{message}</p>
                <p title={file.name} className="mt-1 truncate text-sm text-muted">{file.name}</p>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1.5fr] gap-2">
              <button type="button" aria-label={`${file.name} 제외`} onClick={() => onExclude(id)}
                className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold hover:bg-canvas focus-visible:outline-2 focus-visible:outline-accent">
                제외
              </button>
              <button type="button" aria-label={`${file.name} 다시 시도`} onClick={() => onRetry(id)}
                className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                다시 시도
              </button>
            </div>
          </li>
        ))}
      </ul>
    </dialog>
  )
}

/** 닫거나 제외하면 원본 미리보기에 사용한 임시 URL을 해제한다. */
function FailedPhotoThumbnail({ file }: { file: File }) {
  const attachImage = useCallback((image: HTMLImageElement | null) => {
    if (!image) return
    const url = URL.createObjectURL(file)
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  return <img ref={attachImage} alt="선택한 옷 사진" className="h-16 w-14 shrink-0 rounded-lg bg-canvas object-contain p-1" />
}
