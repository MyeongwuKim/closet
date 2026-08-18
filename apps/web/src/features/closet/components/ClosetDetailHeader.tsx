import { ChevronLeft, Pencil, Trash2 } from 'lucide-react'
import { PageTitle } from '../../../components/PageTitle'

interface ClosetDetailHeaderProps {
  title: string
  description: string
  backLabel?: string
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}

export function ClosetDetailHeader({
  title,
  description,
  backLabel = '내 옷장으로 돌아가기',
  onBack,
  onEdit,
  onDelete,
}: ClosetDetailHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto grid min-h-16 max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:min-h-18 sm:gap-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="flex size-10 items-center justify-center rounded-full hover:bg-surface"
          aria-label={backLabel}
          autoFocus
        >
          <ChevronLeft size={25} strokeWidth={2.2} />
        </button>

        <PageTitle title={title} description={description} compact />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex size-10 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
            aria-label="옷 정보 수정"
            title="옷 정보 수정"
          >
            <Pencil size={18} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex size-10 items-center justify-center rounded-full text-muted transition hover:bg-[#fff0ec] hover:text-accent"
            aria-label="옷장에서 삭제"
            title="옷장에서 삭제"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
