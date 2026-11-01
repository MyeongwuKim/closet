import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOutfitPreviewJobQuery } from '../api/previewJobQueries'

/** 작업 번호가 포함된 경로로 진입하면 같은 서버 작업만 조회하고 완료·실패 경로로 이동한다. 새 생성 요청은 보내지 않는다. */
export function useRestorePreviewJob(jobId: string | null) {
  const job = useOutfitPreviewJobQuery(jobId)
  const navigate = useNavigate()
  useEffect(() => {
    if (job.data && !['queued', 'processing'].includes(job.data.status)) navigate(job.data.path, { replace: true })
  }, [job.data, navigate])
  return job
}
