import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WardrobeItem } from '@closet/types'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { trapDialogFocus } from '../../../lib/dialogFocus'
import { useWardrobeRediscovery } from '../hooks/useWardrobeRediscovery'
import { WardrobeRediscoveryCarousel } from '../components/WardrobeRediscoveryCarousel'
import { WardrobeRediscoverySkeleton } from '../components/WardrobeRediscoverySkeleton'
import { RediscoveryNotificationLink } from '../components/RediscoveryNotificationLink'
import { TodayOutfitRecommendationPopover } from '../../plan/components/today-outfit-recommendation/TodayOutfitRecommendationPopover'
import './WardrobeRediscoveryPage.css'

/** 푸시·옷장 버튼에서 여는 전체 화면 목록이다. 착용 기록·당시 기온을 확인하고 기존 AI 추천이나 주간 알림 설정으로 이동한다. */
export function WardrobeRediscoveryPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { query, meQuery, viewerId } = useWardrobeRediscovery()
  const dialog = useRef<HTMLElement>(null)
  const [selection, setSelection] = useState<{ viewerId: string; item: WardrobeItem } | null>(null)
  const baseItem = selection?.viewerId === viewerId ? selection.item : null
  const isError = (query.isError && !query.data) || (meQuery.isError && !meQuery.data)
  const isRetrying = query.isFetching || meQuery.isFetching
  const isPending = !isError && (query.isPending || meQuery.isPending)

  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    const root = document.getElementById('root')
    const wasInert = root?.inert ?? false
    if (root) root.inert = true
    document.body.style.overflow = 'hidden'
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      document.body.style.overflow = overflow
      if (root) root.inert = wasInert
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  // 추천 시트가 열리면 그 안으로 초점을 옮기고, 닫으면 방금 선택한 옷의 추천 버튼으로 돌려준다.
  useEffect(() => {
    if (!baseItem) return
    const previous = document.activeElement as HTMLElement | null
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
    dialogs.item(dialogs.length - 1)?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [baseItem])

  const retry = () => { if (meQuery.isError && !meQuery.data) void meQuery.refetch(); else void query.refetch() }

  return createPortal(
    <>
      <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="rediscovery-title" inert={Boolean(baseItem)}
        className="classification-page-enter fixed inset-0 z-[60] flex h-dvh flex-col overflow-hidden bg-canvas text-ink"
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest('[role="dialog"]') !== dialog.current) return
          if (event.key === 'Escape') { event.stopPropagation(); navigate('/closet'); return }
          trapDialogFocus(event, dialog.current)
        }}>
        <header className="shrink-0 border-b border-line pt-[env(safe-area-inset-top)]">
          <div className="rediscovery-header mx-auto flex min-h-16 max-w-2xl items-center gap-2 px-3 py-2 sm:px-5">
            <button type="button" onClick={() => navigate('/closet')} aria-label="잊고 있던 옷 닫기" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"><ChevronLeft size={23} strokeWidth={1.8} /></button>
            <h1 id="rediscovery-title" className="text-base font-semibold">잊고 있던 옷</h1>
          </div>
        </header>
        <div className="rediscovery-body min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="rediscovery-content mx-auto w-full max-w-2xl pt-6 sm:pt-8">
            <div className="rediscovery-intro px-5 pb-5">
              <h2 className="text-2xl font-semibold leading-9">다시 꺼내 입어볼까요?</h2>
              <p className="mt-2 text-sm leading-6 text-muted">이번 계절에 어울리는 옷 중<br className="sm:hidden" /> 최근 착용 기록이 없는 옷을 모았어요.</p>
            </div>
            {isPending ? <WardrobeRediscoverySkeleton />
              : isError ? <div className="px-5 py-16 text-center"><p role="alert" className="text-sm text-muted">잊고 있던 옷을 불러오지 못했어요.</p><button type="button" onClick={retry} disabled={isRetrying} className="mt-5 min-h-11 rounded-xl border border-line bg-surface px-5 text-sm font-semibold disabled:opacity-50">{isRetrying ? '다시 불러오는 중…' : '다시 시도'}</button></div>
                : query.data?.items.length && viewerId ? <WardrobeRediscoveryCarousel key={`${viewerId}:${query.data.day}:${query.data.items.map((entry) => entry.item.id).join(',')}`} data={query.data} viewerId={viewerId} enabled={!baseItem} initialItemId={params.get('item')}
                  onOpen={(itemId) => navigate(`/closet/${encodeURIComponent(itemId)}?from=${encodeURIComponent(`/closet/rediscovery?item=${encodeURIComponent(itemId)}`)}`)}
                  onRecommend={(item) => setSelection({ viewerId, item })} />
                  : <div className="px-6 py-14 text-center"><RotateCcw size={30} strokeWidth={1.3} className="mx-auto text-accent" aria-hidden="true" /><h2 className="mt-5 text-lg font-semibold">지금 다시 꺼낼 옷이 없어요</h2><p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-muted">등록 후 30일이 지나고 최근 30일간 착용 기록이 없는 이번 계절의 옷을 보여드려요. 보류한 옷은 제외해요.</p><button type="button" onClick={() => navigate('/closet')} className="mt-6 min-h-12 rounded-xl bg-ink px-6 text-sm font-semibold text-white">내 옷장 보기</button></div>}
            {!isPending && (isError || !query.data?.items.length) && <RediscoveryNotificationLink />}
          </div>
        </div>
      </section>
      {baseItem && query.data && <TodayOutfitRecommendationPopover key={baseItem.id} date={query.data.day} baseItem={baseItem} onClose={() => setSelection(null)} />}
    </>, document.body,
  )
}
