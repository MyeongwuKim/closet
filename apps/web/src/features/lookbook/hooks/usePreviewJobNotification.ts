import { useEffect, useState } from 'react'
import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMeQuery } from '../../settings/api/profileQueries'
import { previewJobKeys, useAcknowledgePreviewJob, useOutfitPreviewJobsQuery } from '../api/previewJobQueries'

/**
 * 앱이 열린 상태에서 미확인 생성 완료·실패를 팝업으로 알린다. 진행 작업은 레이아웃에 표시하지 않는다.
 * 나중에 보기는 현재 실행 중에만 숨기고, 보러 가기는 서버에 확인 처리한 뒤 저장된 결과 경로로 이동한다.
 * 이번 실행에서 이미 표시한 이미지도 계정별로 기억해, 늦게 조회된 완료 알림이 저장·닫기 뒤 다시 뜨지 않게 한다.
 * 네이티브 백그라운드·브라우저 숨김 상태에서는 팝업과 조회를 멈춘다.
 */
export function usePreviewJobNotification() {
  const me = useMeQuery()
  const client = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [documentVisible, setDocumentVisible] = useState(() => document.visibilityState === 'visible')
  const [nativeActive, setNativeActive] = useState(true)
  const isForeground = documentVisible && nativeActive
  const jobs = useOutfitPreviewJobsQuery(isForeground)
  const { mutate: acknowledge } = useAcknowledgePreviewJob()
  const isGenerating = useIsMutating({ mutationKey: ['outfit-preview-generation'] }) > 0
  // 계정과 작업 번호의 조합. 다른 계정으로 전환해도 이전 계정의 팝업을 표시하지 않는다.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  /** 작업 목록 응답보다 미리보기가 먼저 열리고 닫혀도 유지하는 계정·이미지 번호의 조합. */
  const [viewedAssets, setViewedAssets] = useState<Set<string>>(() => new Set())
  const [visibleKey, setVisibleKey] = useState<string | null>(null)
  const ownerId = me.data?.id ?? ''
  const job = jobs.data?.find((item) => !['queued', 'processing'].includes(item.status) && !dismissed.has(`${ownerId}:${item.id}`))
  const jobKey = job ? `${ownerId}:${job.id}` : null
  const wasViewed = Boolean(job?.imageAssetId && viewedAssets.has(`${ownerId}:${job.imageAssetId}`))

  useEffect(() => {
    if (!ownerId || !isForeground) return
    const rememberVisibleAssets = () => {
      const assetKeys = [...document.querySelectorAll<HTMLElement>('[data-ai-preview-asset-id]')]
        .map((element) => element.dataset.aiPreviewAssetId)
        .filter((assetId): assetId is string => Boolean(assetId))
        .map((assetId) => `${ownerId}:${assetId}`)
      if (assetKeys.length === 0) return
      setViewedAssets((current) => {
        const next = new Set([...current, ...assetKeys])
        return next.size === current.size ? current : next
      })
    }
    const observer = new MutationObserver(rememberVisibleAssets)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ai-preview-asset-id'] })
    // 직접 결과 경로로 진입해 관찰 시작 전에 열린 미리보기도 첫 DOM 확인에 포함한다.
    const initialScan = window.setTimeout(rememberVisibleAssets, 0)
    return () => {
      observer.disconnect()
      window.clearTimeout(initialScan)
    }
  }, [isForeground, ownerId])

  useEffect(() => {
    const onVisibility = () => setDocumentVisible(document.visibilityState === 'visible')
    const onNativeState = (event: Event) => {
      const detail = (event as CustomEvent<{ isActive: boolean }>).detail
      if (typeof detail?.isActive === 'boolean') setNativeActive(detail.isActive)
    }
    const onReturn = () => {
      setNativeActive(true)
      void client.invalidateQueries({ queryKey: previewJobKeys.all })
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('closet:native-app-state', onNativeState)
    window.addEventListener('closet:native-app-active', onReturn)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('closet:native-app-state', onNativeState)
      window.removeEventListener('closet:native-app-active', onReturn)
    }
  }, [client])

  useEffect(() => {
    if (!job || !jobKey || !isForeground || isGenerating) return
    // 직접 생성한 이미지가 같은 프레임에서 열릴 수 있어 잠시 기다린 뒤 화면의 자산 번호를 확인한다.
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(location.search)
      const openingFromNotification = job.imageAssetId && location.pathname === '/lookbook/new' && params.get('previewAssetId') === job.imageAssetId && params.get('preview') === 'open'
      const alreadyOpen = wasViewed || openingFromNotification || (job.imageAssetId && [...document.querySelectorAll<HTMLElement>('[data-ai-preview-asset-id]')]
        .some((element) => element.dataset.aiPreviewAssetId === job.imageAssetId))
      if (alreadyOpen) {
        setDismissed((current) => new Set(current).add(jobKey))
        acknowledge(job.id)
      } else setVisibleKey(jobKey)
    }, wasViewed ? 0 : 500)
    return () => window.clearTimeout(timer)
  }, [acknowledge, isForeground, isGenerating, job, jobKey, location.pathname, location.search, wasViewed])

  /** 현재 실행 중에는 같은 작업을 다시 알리지 않는다. 서버의 미확인 기록은 다음 실행에서 확인할 수 있게 유지한다. */
  const dismiss = () => {
    if (jobKey) setDismissed((current) => new Set(current).add(jobKey))
    setVisibleKey(null)
  }

  /** 결과 경로를 열기 전에 서버의 미확인 작업 목록에서 숨긴다. 생성 요청이나 이미지 삭제는 수행하지 않는다. */
  const openResult = () => {
    if (!job) return
    dismiss()
    acknowledge(job.id)
    navigate(job.path)
  }

  return { job: isForeground && !isGenerating && !wasViewed && visibleKey === jobKey ? job : undefined, dismiss, openResult }
}
