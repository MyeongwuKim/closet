import { useId, useState } from 'react'
import type { WardrobeItem } from '@closet/types'
import { ChevronDown, RotateCcw } from 'lucide-react'
import { TodayOutfitRecommendationPopover } from '../../plan/components/today-outfit-recommendation/TodayOutfitRecommendationPopover'
import { formatDateOnly } from '../../plan/data/weeklyPlan'
import { useWardrobeRediscovery } from '../hooks/useWardrobeRediscovery'
import { WardrobeRediscoveryCard } from './WardrobeRediscoveryCard'

interface Props {
  visible: boolean
  onOpenItem: (itemId: string) => void
}

/** 옷장 목록 앞의 버튼을 누르면 잊고 있던 옷을 펼쳐 조회한다. 선택한 옷은 기존 계절·색감·사용권 확인 흐름의 추천 시트로 연결한다. */
export function WardrobeRediscoverySection({ visible, onOpenItem }: Props) {
  /** 처음에는 접어 두며 버튼으로 펼친 동안만 하이라이트 조회와 실제 노출 확인을 허용한다. */
  const [isExpanded, setIsExpanded] = useState(false)
  const contentsId = useId()
  const { query, enabled, viewerId } = useWardrobeRediscovery(visible, isExpanded)
  /** 추천 버튼으로 선택한 기준 옷. 시트를 닫으면 비우며 노출 확인도 시트 뒤에서는 멈춘다. */
  const [selection, setSelection] = useState<{ viewerId: string; item: WardrobeItem } | null>(null)
  const baseItem = selection?.viewerId === viewerId ? selection.item : null
  if (!enabled) return null
  return (
    <>
      <section aria-label="잊고 있던 옷" className="mb-4">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentsId}
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-bold text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        >
          <RotateCcw size={14} aria-hidden="true" />
          잊고 있던 옷 확인하기
          <ChevronDown size={15} aria-hidden="true" className={`transition-transform duration-300 motion-reduce:transition-none ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        <div
          id={contentsId}
          aria-hidden={!isExpanded}
          inert={!isExpanded}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="mt-3 rounded-[1.5rem] bg-sage/35 p-3 sm:p-4">
              <p className="mb-3 px-1 text-[11px] leading-5 text-muted">이 옷, 다시 꺼내볼까요? 한동안 찾지 않았던 옷을 만나보세요.</p>
              {query.isPending ? (
                <p role="status" className="px-1 py-5 text-xs text-muted">옷장 속에서 다시 입을 옷을 찾고 있어요.</p>
              ) : query.isError ? (
                <div className="flex items-center justify-between gap-2 px-1 py-3 text-xs text-muted">
                  <p>잊고 있던 옷을 불러오지 못했어요.</p>
                  <button type="button" onClick={() => void query.refetch()} className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2 font-bold" disabled={query.isFetching}>다시 시도</button>
                </div>
              ) : query.data?.items.length && viewerId ? (
                <div className="grid auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-1" role="region" aria-label="잊고 있던 옷 목록" tabIndex={0}>
                  {query.data.items.map((entry) => <WardrobeRediscoveryCard
                    key={entry.item.id} entry={entry} day={query.data.day} viewerId={viewerId} enabled={isExpanded && !baseItem}
                    onOpen={() => onOpenItem(entry.item.id)} onRecommend={() => setSelection({ viewerId, item: entry.item })}
                  />)}
                </div>
              ) : (
                <p className="px-1 py-3 text-xs leading-6 text-muted">아직 다시 꺼내볼 옷이 없어요. 등록한 지 30일이 지나고 최근 착용 기록이 없는 옷을 여기에 모아둘게요.</p>
              )}
            </div>
          </div>
        </div>
      </section>
      {baseItem && <TodayOutfitRecommendationPopover key={baseItem.id} date={formatDateOnly(new Date())} baseItem={baseItem} onClose={() => setSelection(null)} />}
    </>
  )
}
