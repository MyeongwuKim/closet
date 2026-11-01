import { useEffect, useRef, useState } from 'react'
import type { AiCreditKind } from '@closet/types'
import { useQueryClient } from '@tanstack/react-query'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useUiStore } from '../../../stores/useUiStore'
import { usePreviewCreditsQuery } from '../api/previewCreditQueries'
import { requireAiCredit } from '../api/requireAiCredit'

/**
 * 만들기·추천 버튼에서 잔액 0회를 광고 동작으로 표시하고, 클릭 시 최신 잔액과 광고 지급을 확인한다.
 * requiresCredit이 false인 기존 결과 보기는 조회·광고 없이 실행한다. 잔액은 React Query에서 읽고 직접 복사하지 않는다.
 */
export function useAiCreditAction(kind: AiCreditKind, requiresCredit = true) {
  const credits = usePreviewCreditsQuery(requiresCredit, kind)
  const me = useMeQuery()
  const client = useQueryClient()
  const pushToast = useUiStore((state) => state.pushToast)
  // 현재 버튼의 확인 요청. 화면 종료 시 광고 안내를 닫고 늦게 끝난 확인이 작업을 시작하지 않게 한다.
  const activeRequest = useRef<AbortController | null>(null)
  const [isPending, setIsPending] = useState(false)
  useEffect(() => () => { activeRequest.current?.abort() }, [])

  /** 잔액이 있는 클릭만 동작을 실행한다. 0회이면 충전 선택 팝업만 열고, 광고 지급 후에도 원래 화면에 머문다. 중복 클릭·화면 종료 뒤 실행을 막는다. */
  const execute = async (action: () => void | Promise<void>) => {
    if (activeRequest.current) return
    if (!requiresCredit) { await action(); return }
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
    requiresAd: requiresCredit && credits.data?.totalRemaining === 0,
    usesWallet: Boolean(credits.data?.capacity),
    isChecking: requiresCredit && credits.isPending,
    isPending,
    execute,
  }
}
