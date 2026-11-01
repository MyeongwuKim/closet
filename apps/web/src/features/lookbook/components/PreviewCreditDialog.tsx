import { useCreditRefillCountdown } from '../hooks/useCreditRefillCountdown'
import { formatCreditRefillTime } from '../utils/creditRefillTime'
import type { AiCreditKind } from '@closet/types'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, Sparkles, X } from 'lucide-react'
import { useMeQuery } from '../../settings/api/profileQueries'
import { useEarnPreviewCreditMutation, useNativeRewardSupport, usePreviewCreditsQuery } from '../api/previewCreditQueries'
import { usePreviewCreditDialogStore } from '../stores/usePreviewCreditDialogStore'

/** 앱의 이미지 생성·코디 추천 진입점에서 공통으로 사용하는 충전 선택 화면이다. 대기 시간과 광고 즉시 지급 중 선택하고 보상 후에는 원래 버튼으로 돌아간다. 계정이 바뀌거나 화면이 해제되면 대기 생성을 취소한다. */
export function PreviewCreditDialog() {
  const request = usePreviewCreditDialogStore((state) => state.request)
  const resolve = usePreviewCreditDialogStore((state) => state.resolve)
  const me = useMeQuery()
  useEffect(() => {
    if (request && me.data?.id !== request.ownerId) resolve(request.id, false)
    return () => { if (request) resolve(request.id, false) }
  }, [request, me.data?.id, resolve])
  return request ? <PreviewCreditDialogContent key={request.id} request={request} /> : null
}

function PreviewCreditDialogContent({ request }: { request: { id: string; ownerId: string; purpose: 'generation' | 'info'; kind: AiCreditKind } }) {
  const resolve = usePreviewCreditDialogStore((state) => state.resolve)
  const isInfo = request.purpose === 'info'
  const credits = usePreviewCreditsQuery(true, request.kind)
  const usesWallet = Boolean(credits.data?.capacity)
  const creditLabel = 'AI 사용권'
  const waitSeconds = useCreditRefillCountdown(usesWallet ? credits.data?.nextRefillAt : credits.data?.resetsAt, credits.data?.serverNow, credits.dataUpdatedAt)
  const support = useNativeRewardSupport(true)
  const reward = useEarnPreviewCreditMutation(request.kind)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const close = () => resolve(request.id, false)
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); resolve(request.id, false) }
      if (event.key !== 'Tab') return
      const elements = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
      const first = elements[0]; const last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => { window.removeEventListener('keydown', onKeyDown, true); previousFocus?.focus() }
  }, [request.id, resolve])
  const available = (credits.data?.totalRemaining ?? 0) > 0
  const canEarn = support.data && credits.data?.rewardMode !== 'disabled' && (credits.data?.adRewardsRemaining === null || (credits.data?.adRewardsRemaining ?? 0) > 0 || credits.data?.pendingRewardSessionId)
  useEffect(() => {
    if (!isInfo && available && !reward.isPending) resolve(request.id, true)
  }, [available, isInfo, request.id, resolve, reward.isPending])
  const handleReward = async () => {
    try { await reward.mutateAsync(); resolve(request.id, true) } catch { /* 실패 안내는 mutation.error로 표시하고 같은 보상을 다시 확인한다. */ }
  }
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/45 px-5 py-8 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="preview-credit-title" className="max-h-[calc(100dvh-4rem)] w-full max-w-sm overflow-y-auto rounded-3xl bg-surface p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-sage text-accent"><Sparkles size={22} /></span>
          <button ref={closeRef} type="button" onClick={close} aria-label={`${creditLabel} 안내 닫기`} className="rounded-full p-2 text-muted hover:bg-canvas"><X size={20} /></button>
        </div>
        <h2 id="preview-credit-title" className="mt-4 text-lg font-black">{isInfo ? `${creditLabel} 안내` : `${creditLabel}이 부족해요`}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{usesWallet
          ? (isInfo ? 'AI 사용권은 최대 5개까지 보유할 수 있고, 1시간마다 1개씩 충전돼요. 광고를 보면 1개를 바로 받을 수 있어요.' : '충전을 기다리거나 광고를 보고 사용권 1개를 바로 받을 수 있어요.')
          : (isInfo ? '코디 추천과 룩북 생성에 공통으로 사용하는 이용권이에요. 광고를 보면 사용권 1개를 받을 수 있어요.' : '충전을 기다리거나 광고를 보고 사용권 1개를 받을 수 있어요.')}</p>
        {isInfo && credits.data && <div className="mt-4 rounded-2xl bg-canvas px-4 py-3 text-sm">{usesWallet
          ? <p>AI 사용권 <strong>{credits.data.totalRemaining}/{credits.data.capacity}</strong></p>
          : <p>무료 <strong>{credits.data.freeRemaining}회</strong> · 광고 {creditLabel} <strong>{credits.data.rewardRemaining}회</strong></p>}</div>}
        {!support.isPending && !support.data && !available && <p className="mt-3 text-xs leading-5 text-muted">광고 보상은 광고 기능이 포함된 iOS 앱에서 이용할 수 있어요.</p>}
        {credits.data?.rewardMode === 'disabled' && !available && <p className="mt-3 text-xs text-muted">광고 보상을 준비 중이에요. 충전 후 다시 이용해 주세요.</p>}
        {credits.data?.adRewardsRemaining === 0 && !available && <p className="mt-3 text-xs text-muted">오늘의 광고 보상을 모두 받았어요. 충전 후 다시 이용해 주세요.</p>}
        {(reward.error || credits.error) && <p role="alert" className="mt-3 text-xs leading-5 text-danger">{(reward.error ?? credits.error)?.message}</p>}
        {isInfo && available ? <button type="button" onClick={close} className="mt-5 min-h-12 w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white">확인</button> : <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={close} className="min-h-14 rounded-xl border border-line bg-canvas px-2 py-3 text-sm font-bold">
            <span className="block">{waitSeconds === 0 ? '충전 확인 중…' : formatCreditRefillTime(waitSeconds)}</span>
            <span className="block">기다리기</span>
          </button>
          <button type="button" disabled={!canEarn || reward.isPending || credits.isPending} onClick={() => void handleReward()} className="flex min-h-14 items-center justify-center gap-1.5 rounded-xl bg-accent px-2 py-3 text-sm font-bold text-white disabled:opacity-50">
            {reward.isPending ? <><LoaderCircle size={16} className="shrink-0 animate-spin" />보상 확인 중…</> : credits.data?.pendingRewardSessionId ? '보상 확인하기' : <span><span className="block">광고 보고</span><span className="block">즉시 받기</span></span>}
          </button>
        </div>}

      </div>
    </div>, document.body,
  )
}
