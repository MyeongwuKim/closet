import { useCreditRefillCountdown } from '../hooks/useCreditRefillCountdown'
import { formatCreditRefillTime } from '../utils/creditRefillTime'
import type { AiCreditKind } from '@closet/types'
import { useMeQuery } from '../../settings/api/profileQueries'
import { usePreviewCreditsQuery } from '../api/previewCreditQueries'
import { usePreviewCreditDialogStore } from '../stores/usePreviewCreditDialogStore'

/** 이미지 생성·코디 추천이 함께 사용하는 잔액·다음 충전 시간과 사용권 안내 버튼을 보여준다. 이 컴포넌트는 생성 요청을 보내지 않는다. */
export function PreviewCreditSummary({ kind = 'preview' }: { kind?: AiCreditKind }) {
  const me = useMeQuery()
  const credits = usePreviewCreditsQuery(true, kind)
  const usesWallet = Boolean(credits.data?.capacity)
  const creditLabel = 'AI 사용권'
  const remaining = useCreditRefillCountdown(credits.data?.nextRefillAt, credits.data?.serverNow, credits.dataUpdatedAt)
  const ask = usePreviewCreditDialogStore((state) => state.ask)
  return <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-muted">
    <span aria-live="polite">{credits.data ? usesWallet ? `AI 사용권 ${credits.data.totalRemaining}/${credits.data.capacity}` : `오늘 무료 ${credits.data.freeRemaining}회 · 광고 ${creditLabel} ${credits.data.rewardRemaining}회` : credits.isError ? `${creditLabel} 정보를 불러오지 못했어요` : `${creditLabel} 확인 중…`}</span>
    {usesWallet && remaining !== null && <span aria-live="off">· 다음 충전 {formatCreditRefillTime(remaining)} 후</span>}
    <button type="button" disabled={!me.data} onClick={() => { if (me.data) void ask(me.data.id, 'info', kind) }} className="font-bold text-accent underline underline-offset-2">{creditLabel} 안내</button>
  </div>
}
