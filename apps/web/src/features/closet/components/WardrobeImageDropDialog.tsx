import { useId } from 'react'
import { ImagePlus, Images, Shirt, Upload, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useWardrobeImageDialog } from '../hooks/useWardrobeImageDialog'
import { useWardrobeImageDrop } from '../hooks/useWardrobeImageDrop'
import './WardrobeImageDropDialog.css'

interface WardrobeImageDropDialogProps {
  onChooseFiles: () => void
  onImagesSelected: (files: File[]) => void
  onCancel: () => void
}

/** 웹 옷장 → + 버튼. 여러 사진을 끌어다 놓거나 복사한 이미지를 붙여넣고, 클릭·키보드로 파일을 선택하는 창이다. 실제 파일 선택과 분석은 부모의 사진 선택 Hook에 연결하며 앱의 촬영·앨범 창에서는 사용하지 않는다. */
export function WardrobeImageDropDialog({
  onChooseFiles,
  onImagesSelected,
  onCancel,
}: WardrobeImageDropDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useWardrobeImageDialog(onCancel)
  const { isDragging, dropZoneHandlers, handlePaste } = useWardrobeImageDrop(onImagesSelected)

  return createPortal(
    <div
      className="option-picker-backdrop wardrobe-drop-backdrop fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 px-5 py-8 backdrop-blur-[3px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'none'
      }}
      onDrop={(event) => event.preventDefault()}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onPaste={handlePaste}
        className="option-picker-enter wardrobe-drop-dialog w-full max-w-lg overflow-y-auto rounded-[28px] border border-line bg-surface shadow-2xl"
      >
        <header className="flex items-center gap-3 px-6 pt-6">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage text-accent">
            <ImagePlus size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold tracking-[-.04em]">옷 사진 추가</h2>
            <p id={descriptionId} className="mt-1 text-xs leading-5 text-muted">옷 한 벌씩 찍은 사진을 넣어주세요.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-muted transition-colors hover:text-ink"
            aria-label="옷 사진 추가창 닫기"
          >
            <X size={18} />
          </button>
        </header>

        <div className="px-6 pt-5 pb-6">
          <button
            type="button"
            onClick={onChooseFiles}
            {...dropZoneHandlers}
            data-dragging={isDragging}
            className="wardrobe-drop-zone flex w-full flex-col items-center justify-center rounded-[22px] border border-dashed border-line px-4 py-9 text-center focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4"
            aria-label="옷 사진 선택, 끌어다 놓기 또는 붙여넣기"
            autoFocus
          >
            <span className="wardrobe-drop-photos" aria-hidden="true">
              <span className="wardrobe-drop-photo wardrobe-drop-photo-back"><Images size={29} strokeWidth={1.3} /></span>
              <span className="wardrobe-drop-photo wardrobe-drop-photo-front"><Shirt size={38} strokeWidth={1.2} /></span>
              <span className="wardrobe-drop-upload"><Upload size={15} /></span>
            </span>
            <strong className="mt-5 text-base font-semibold tracking-[-.035em]">
              {isDragging ? '여기에 놓으면 사진이 추가돼요' : '사진을 끌어오거나 붙여넣으세요'}
            </strong>
            <span className="mt-2 text-xs text-muted">여러 장을 한 번에 추가할 수 있어요.</span>
            <span className="mt-5 rounded-full bg-accent px-5 py-2.5 text-xs font-medium text-white">사진 선택</span>
            <span className="mt-3 text-xs text-muted">복사한 이미지는 <kbd className="font-sans font-medium text-ink">⌘V</kbd> / <kbd className="font-sans font-medium text-ink">Ctrl+V</kbd></span>
            <span className="mt-4 text-[10px] text-muted">JPEG · PNG · WEBP / 장당 최대 10MB</span>
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-muted">사진을 넣으면 AI가 종류와 색상을 살펴봐요.</p>
        </div>
      </section>
    </div>,
    document.body,
  )
}
