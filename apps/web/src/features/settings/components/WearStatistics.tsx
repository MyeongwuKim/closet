import { useId, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useOutfitQuery } from '../../../lib/catalogQueries'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { OutfitDetailModal } from '../../lookbook/components/OutfitDetailModal'
import type { WardrobeStatistics } from '../api/statisticsQueries'
import { StatisticsRanking } from './StatisticsRanking'

const wearTabs = [
  { id: 'item', label: '옷' },
  { id: 'outfit', label: '코디' },
] as const

function StatisticsOutfitDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useOutfitQuery(id)
  const catalogItems = useClosetStore((state) => state.items)

  if (query.isError || !query.data) {
    return (
      <section className="fixed inset-0 z-[90] flex h-dvh flex-col bg-canvas" role="dialog" aria-modal="true" aria-label="코디 상세">
        <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-line px-3">
          <button type="button" onClick={onClose} autoFocus aria-label="통계로 돌아가기" className="flex size-10 items-center justify-center rounded-full hover:bg-surface"><ChevronLeft size={24} /></button>
          <h2 className="font-black">코디 상세</h2>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          {query.isError ? <>
            <p role="alert" className="text-sm text-muted">코디를 불러오지 못했어요. 삭제된 코디이거나 연결에 문제가 있을 수 있어요.</p>
            <button type="button" onClick={() => void query.refetch()} className="rounded-full bg-ink px-5 py-2 text-sm font-bold text-white">다시 시도</button>
          </> : <p role="status" className="text-sm text-muted">코디를 불러오는 중...</p>}
        </div>
      </section>
    )
  }

  const items = [...new Map([...catalogItems, ...query.data.wardrobeItems].map((item) => [item.id, item])).values()]
  return <OutfitDetailModal outfit={query.data.outfit} items={items} onClose={onClose} backLabel="통계로 돌아가기" />
}

export function WearStatistics({ data }: { data: WardrobeStatistics }) {
  const sectionId = useId()
  const [activeTab, setActiveTab] = useState<(typeof wearTabs)[number]['id']>('item')
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null)

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-base font-black">가장 자주 입은 {activeTab === 'item' ? '옷' : '코디'}</h2>
      <div role="tablist" aria-label="착용 순위 기준" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
        {wearTabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`${sectionId}-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${sectionId}-${tab.id}-panel`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? wearTabs.length - 1
                : event.key === 'ArrowRight' ? (index + 1) % wearTabs.length
                  : event.key === 'ArrowLeft' ? (index + wearTabs.length - 1) % wearTabs.length : null
              if (nextIndex === null) return
              event.preventDefault()
              setActiveTab(wearTabs[nextIndex].id)
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
            }}
            className={`min-h-10 rounded-lg px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-accent ${activeTab === tab.id ? 'bg-ink text-white shadow-sm' : 'text-muted hover:text-ink'}`}
          >{tab.label}</button>
        ))}
      </div>
      <div id={`${sectionId}-item-panel`} role="tabpanel" aria-labelledby={`${sectionId}-item-tab`} hidden={activeTab !== 'item'} tabIndex={0} className="mt-3 rounded-xl focus-visible:outline-2 focus-visible:outline-accent">
        <p className="text-xs leading-5 text-muted">같은 옷은 하루에 한 번으로 계산해요 · 상위 5개</p>
        <StatisticsRanking kind="item" unit="회" empty="플래너에 착용 기록을 남기면 순위가 생겨요."
          entries={data.mostWorn.map((item) => ({
            key: item.id, label: item.name, count: item.wearCount, imageUrl: item.imageUrl,
            href: `/closet/${item.id}?from=${encodeURIComponent('/settings/statistics')}`,
          }))} />
        {data.totalItems > 0 && <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-xs leading-5 text-muted">아직 착용 기록이 없는 옷은 {data.unwornCount}개예요.</p>}
      </div>
      <div id={`${sectionId}-outfit-panel`} role="tabpanel" aria-labelledby={`${sectionId}-outfit-tab`} hidden={activeTab !== 'outfit'} tabIndex={0} className="mt-3 rounded-xl focus-visible:outline-2 focus-visible:outline-accent">
        <p className="text-xs leading-5 text-muted">코디북에 저장된 코디 기준 · 상위 5개<br />같은 코디는 하루에 한 번으로 계산해요.</p>
        <StatisticsRanking kind="outfit" unit="회" empty={data.totalOutfits === 0 ? '코디북에 코디를 저장하고 플래너에 기록하면 순위가 생겨요.' : '저장한 코디를 플래너에 기록하면 순위가 생겨요.'}
          entries={data.mostWornOutfits.map((outfit) => ({
            key: outfit.id, label: outfit.name, count: outfit.wearCount, imageUrl: outfit.imageUrl,
            imageUrls: outfit.itemImageUrls, onSelect: () => setSelectedOutfitId(outfit.id),
          }))} />
        {data.totalOutfits > 0 && <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-xs leading-5 text-muted">아직 착용 기록이 없는 코디는 {data.unwornOutfitCount}개예요.</p>}
      </div>
      {selectedOutfitId && <StatisticsOutfitDetail id={selectedOutfitId} onClose={() => setSelectedOutfitId(null)} />}
    </section>
  )
}
