import { useCreditRefillCountdown } from '../hooks/useCreditRefillCountdown'
import { formatCreditRefillTime } from '../utils/creditRefillTime'
import type { AiCreditKind } from '@closet/types'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useNativeRewardSupport, usePreviewCreditsQuery } from '../api/previewCreditQueries'
import { usePreviewCreditDialogStore } from '../stores/usePreviewCreditDialogStore'

/** 공용 잔액과 다음 충전 시각을 보여주고, 충전 가능한 앱에서는 광고 안내를 바로 연다. */
export function PreviewCreditSummary({ kind = 'preview' }: { kind?: AiCreditKind }) {
  const me = useMeQuery()
  const credits = usePreviewCreditsQuery(true, kind)
  const usesWallet = Boolean(credits.data?.capacity)
  const creditLabel = 'AI 사용권'
  const remaining = useCreditRefillCountdown(credits.data?.nextRefillAt, credits.data?.serverNow, credits.dataUpdatedAt)
  const ask = usePreviewCreditDialogStore((state) => state.ask)
  const canTopUp = Boolean(credits.data && credits.data.totalRemaining > 0 && credits.data.rewardMode !== 'disabled' &&
    (credits.data.pendingRewardSessionId || (credits.data.adRewardsRemaining !== 0 &&
      (!credits.data.capacity || credits.data.totalRemaining < credits.data.capacity))))
  const rewardSupport = useNativeRewardSupport(canTopUp)
  return <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted">
    <span aria-live="polite">{credits.data ? usesWallet ? `AI 사용권 ${credits.data.totalRemaining}/${credits.data.capacity}` : `오늘 무료 ${credits.data.freeRemaining}회 · 광고 ${creditLabel} ${credits.data.rewardRemaining}회` : credits.isError ? `${creditLabel} 정보를 불러오지 못했어요` : `${creditLabel} 확인 중…`}</span>
    {usesWallet && remaining !== null && <span aria-live="off">· 다음 충전 {formatCreditRefillTime(remaining)} 후</span>}
    <button type="button" disabled={!me.data} onClick={() => { if (me.data) void ask(me.data.id, 'info', kind) }} className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 font-bold text-accent underline underline-offset-2">{creditLabel} 안내</button>
    {me.data && canTopUp && rewardSupport.data && (
      <button type="button" onClick={() => void ask(me.data.id, 'info', kind)} className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 font-bold text-accent">광고 보고 충전</button>
    )}
  </div>
}
