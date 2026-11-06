import { useWardrobeImageAnalysis } from '../hooks/useWardrobeImageAnalysis'

/** 옷장에서 남은 분석 수를 표시하고, 일시 실패한 사진을 각각 다시 시도하거나 제외한다. */
export function WardrobePhotoAnalysisStatus() {
  const analyzingCount = useWardrobeImageAnalysis((state) => state.analyzingCount)
  const failedPhotos = useWardrobeImageAnalysis((state) => state.failedPhotos)
  const retryPhoto = useWardrobeImageAnalysis((state) => state.retryPhoto)
  const dismissPhoto = useWardrobeImageAnalysis((state) => state.dismissPhoto)

  if (analyzingCount === 0 && failedPhotos.length === 0) return null

  return (
    <section aria-label="사진 분석 상태" className="my-3 rounded-2xl border border-line bg-surface px-3 py-2 text-xs">
      <p role="status" className="font-semibold text-ink">
        {analyzingCount > 0 ? `사진 ${analyzingCount}장 분석 중` : '사진 분석을 마쳤어요'}
        {failedPhotos.length > 0 && ` · 다시 시도할 사진 ${failedPhotos.length}장`}
      </p>
      {failedPhotos.length > 0 && (
        <ul className="mt-1 max-h-36 divide-y divide-line overflow-y-auto">
          {failedPhotos.map(({ id, file, message }) => (
            <li key={id} className="flex items-center gap-2 py-1">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{file.name}</p>
                <p className="mt-1 text-muted">{message}</p>
              </div>
              <button
                type="button"
                aria-label={`${file.name} 다시 시도`}
                className="min-h-11 shrink-0 rounded-full border border-line px-2.5 font-bold text-accent"
                onClick={() => retryPhoto(id)}
              >
                다시 시도
              </button>
              <button
                type="button"
                aria-label={`${file.name} 제외`}
                className="min-h-11 shrink-0 px-1.5 font-medium text-muted"
                onClick={() => dismissPhoto(id)}
              >
                제외
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
