import { useEffect, useRef, useState } from 'react'
import type { AiCreditKind } from '@closet/types'
import { useQueryClient } from '@tanstack/react-query'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useUiStore } from '../../../stores/useUiStore'
import { usePreviewCreditsQuery } from '../api/previewCreditQueries'
import { requireAiCredit } from '../api/requireAiCredit'

/**
 * AI 버튼에 표시할 잔액을 읽고, 사용권이 필요한 버튼은 0회일 때 광고 동작으로 표시한다.
 * 기존 결과 보기와 사용권이 남은 iOS 룩북 접수는 클릭한 동작을 바로 실행한다. iOS의 최종 잔액은 서버 접수가 확인한다.
 * 다른 사용권 버튼은 클릭 시 최신 잔액과 광고 지급을 확인한다.
 * 잔액은 React Query에서 읽고 직접 복사하지 않는다.
 */
export function useAiCreditAction(kind: AiCreditKind, requiresCredit = true) {
  const credits = usePreviewCreditsQuery(true, kind)
  const me = useMeQuery()
  const client = useQueryClient()
  const pushToast = useUiStore((state) => state.pushToast)
  // 현재 버튼의 확인 요청. 화면 종료 시 광고 안내를 닫고 늦게 끝난 확인이 작업을 시작하지 않게 한다.
  const activeRequest = useRef<AbortController | null>(null)
  const [isPending, setIsPending] = useState(false)
  useEffect(() => () => { activeRequest.current?.abort() }, [])

  /** 사용권이 0회면 충전 선택을 열고, 광고 지급 뒤 새 클릭을 기다린다. 비동기 잔액 확인 중에는 중복 실행을 막는다. */
  const execute = async (action: () => void | Promise<void>) => {
    const canSubmitPreviewImmediately = kind === 'preview' && window.ClosetNative?.requestPreviewStart &&
      (credits.data?.totalRemaining ?? 0) > 0
    if (!requiresCredit || canSubmitPreviewImmediately) { await action(); return }
    if (activeRequest.current) return
    if (!me.data) return
    const request = new AbortController()
    activeRequest.current = request
    setIsPending(true)
    try {
      const ready = await requireAiCredit(client, me.data.id, kind, request.signal)
      if (ready && !request.signal.aborted) await action()
    } catch (error) {
      if (!request.signal.aborted) pushToast(error instanceof Error ? error.message : '이용 횟수를 확인하지 못했어요.', 'error')
    } finally {
      if (activeRequest.current === request) activeRequest.current = null
      if (!request.signal.aborted) setIsPending(false)
    }
  }

  return {
    remainingCredits: credits.data?.totalRemaining,
    capacity: credits.data?.capacity,
    requiresAd: requiresCredit && credits.data?.totalRemaining === 0,
    usesWallet: Boolean(credits.data?.capacity),
    isChecking: requiresCredit && credits.isPending,
    isPending,
    execute,
  }
}
