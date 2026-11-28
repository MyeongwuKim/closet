import { CircleAlert } from 'lucide-react'
import { useUiStore } from '../../../stores/useUiStore'
import { useWardrobeImageAnalysis } from '../hooks/useWardrobeImageAnalysis'
import { WardrobePhotoFailuresDialog } from './WardrobePhotoFailuresDialog'

/** 등록 확인을 마친 뒤 실패 안내를 열고, 닫은 뒤에도 옷장에서 원본을 다시 확인할 수 있게 한다. */
export function WardrobePhotoAnalysisStatus({ canOpenFailureDialog }: { canOpenFailureDialog: boolean }) {
  const analyzingCount = useWardrobeImageAnalysis((state) => state.analyzingCount)
  const failedPhotos = useWardrobeImageAnalysis((state) => state.failedPhotos)
  const isFailureDialogOpen = useWardrobeImageAnalysis((state) => state.isFailureDialogOpen)
  const setFailureDialogOpen = useWardrobeImageAnalysis((state) => state.setFailureDialogOpen)
  const retryPhoto = useWardrobeImageAnalysis((state) => state.retryPhoto)
  const dismissPhoto = useWardrobeImageAnalysis((state) => state.dismissPhoto)
  const hasRegistration = useUiStore((state) => state.classificationQueue.length > 0)

  if (analyzingCount > 0) return <p role="status" className="mt-3 text-sm text-muted">사진 {analyzingCount}장 분석 중</p>
  if (failedPhotos.length === 0 || !canOpenFailureDialog || hasRegistration) return null

  if (isFailureDialogOpen) {
    return <WardrobePhotoFailuresDialog
      photos={failedPhotos}
      onClose={() => setFailureDialogOpen(false)}
      onRetry={retryPhoto}
      onExclude={dismissPhoto}
    />
  }

  return (
    <button type="button" aria-haspopup="dialog" onClick={() => setFailureDialogOpen(true)}
      className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent">
      <CircleAlert size={16} aria-hidden="true" />
      처리하지 못한 사진 {failedPhotos.length}장
    </button>
  )
}
