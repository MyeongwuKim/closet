import type { QueryClient } from '@tanstack/react-query'
import type { AiCreditKind } from '@closet/types'
import { queryKeys } from '../../../lib/queryKeys'
import { getPreviewCredits, previewCreditKeys } from './previewCreditQueries'
import { usePreviewCreditDialogStore } from '../stores/usePreviewCreditDialogStore'

/** 횟수 확인·광고 대기 중 화면을 닫거나 계정이 바뀌면 이전 계정의 작업을 진행하지 않는다. */
function assertActive(client: QueryClient, ownerId: string, signal?: AbortSignal) {
  if (signal?.aborted || client.getQueryData<{ id: string }>(queryKeys.me)?.id !== ownerId) {
    throw new Error('요청이 취소됐어요. 현재 계정에서 다시 시도해 주세요.')
  }
}

/**
 * 실행 직전 서버 잔액을 다시 읽어 갱신한다. 잔액이 있으면 true, 0회이면 충전 선택 팝업을 닫은 뒤 false를 반환한다.
 * 광고 보상 후에도 false로 종료해 사용자가 원래 버튼을 다시 눌러 작업을 시작하게 한다. 조회 실패·계정 변경에는 예외를 반환한다. 이 함수는 횟수를 직접 차감하지 않는다.
 */
export async function requireAiCredit(client: QueryClient, ownerId: string, kind: AiCreditKind, signal?: AbortSignal) {
  assertActive(client, ownerId, signal)
  const balance = await getPreviewCredits(kind)
  assertActive(client, ownerId, signal)
  client.setQueryData(previewCreditKeys.balance(ownerId, kind), balance)
  if (balance.totalRemaining > 0) return true

  const dialog = usePreviewCreditDialogStore.getState()
  const answer = dialog.ask(ownerId, 'generation', kind)
  const requestId = usePreviewCreditDialogStore.getState().request?.id
  const cancel = () => { if (requestId) dialog.resolve(requestId, false) }
  signal?.addEventListener('abort', cancel, { once: true })
  await answer.finally(() => signal?.removeEventListener('abort', cancel))
  assertActive(client, ownerId, signal)
  return false
}
