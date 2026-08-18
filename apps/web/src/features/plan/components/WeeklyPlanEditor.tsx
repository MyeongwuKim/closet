import { useEffect, useState } from 'react'
import type { Season } from '@closet/types'
import {
  Check,
  ChevronLeft,
  Images,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatSeasonLabels, seasonLabels } from '../../../constants/seasons'
import { getOutfitStyleLabel } from '../../../constants/styleOptions'
import { useUiStore } from '../../../stores/useUiStore'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { OutfitCardVisual } from '../../lookbook/components/OutfitCardVisual'
import { OutfitFilterControls } from '../../lookbook/components/OutfitFilterControls'
import { OutfitWearStatus } from '../../lookbook/components/OutfitWearStatus'
import { useOutfitWearSummaries } from '../../lookbook/hooks/useOutfitWearSummaries'
import { useLookbookStore } from '../../lookbook/stores/useLookbookStore'
import {
  filterSavedOutfits,
  getVisibleOutfitStyleOptions,
} from '../../lookbook/utils/outfitFilters'
import {
  useClearPlannerEntryMutation,
  useSetPlannerEntryMutation,
} from '../api/plannerQueries'
import { usePlanStore } from '../stores/usePlanStore'

interface WeeklyPlanEditorProps {
  onClose: () => void
}

export function WeeklyPlanEditor({ onClose }: WeeklyPlanEditorProps) {
  const navigate = useNavigate()
  const items = useClosetStore((state) => state.items)
  const outfits = useLookbookStore((state) => state.outfits)
  const entries = usePlanStore((state) => state.entries)
  const assignOutfit = usePlanStore((state) => state.assignOutfit)
  const clearOutfit = usePlanStore((state) => state.clearOutfit)
  const pushToast = useUiStore((state) => state.pushToast)
  const setPlannerEntry = useSetPlannerEntryMutation()
  const clearPlannerEntry = useClearPlannerEntryMutation()
  const [activeDate, setActiveDate] = useState(entries[0]?.date ?? '')
  const [activeStyle, setActiveStyle] = useState('all')
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const wearSummaries = useOutfitWearSummaries(
    outfits.map((outfit) => outfit.id),
  )
  const activeEntry = entries.find((entry) => entry.date === activeDate)
  const visibleStyleOptions = getVisibleOutfitStyleOptions(outfits)
  const visibleOutfits = filterSavedOutfits({
    outfits,
    wardrobeItems: items,
    activeStyle,
    activeSeason,
    searchQuery,
  })

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const chooseOutfit = async (outfit: (typeof outfits)[number]) => {
    if (/^[a-f\d]{24}$/i.test(outfit.id)) {
      try {
        await setPlannerEntry.mutateAsync({
          weekStartsOn: entries[0].date,
          date: activeDate,
          outfitId: outfit.id,
          title: outfit.name,
          occasion: activeEntry?.occasion,
        })
      } catch (error) {
        pushToast(
          error instanceof Error ? error.message : '플래너를 저장하지 못했습니다.',
          'error',
        )
        return
      }
    }

    assignOutfit(activeDate, outfit)
    pushToast(`${activeEntry?.dayLabel}요일 코디를 설정했습니다.`, 'success')
  }

  const removeOutfit = async () => {
    if (activeEntry?.outfitId && /^[a-f\d]{24}$/i.test(activeEntry.outfitId)) {
      try {
        await clearPlannerEntry.mutateAsync({
          weekStartsOn: entries[0].date,
          date: activeDate,
        })
      } catch (error) {
        pushToast(
          error instanceof Error ? error.message : '플래너를 비우지 못했습니다.',
          'error',
        )
        return
      }
    }
    clearOutfit(activeDate)
  }

  const toggleSearch = () => {
    if (isSearchOpen) setSearchQuery('')
    setIsSearchOpen(!isSearchOpen)
  }

  return (
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label="이번 주 옷 설정"
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center gap-3 px-3 py-2 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 items-center justify-center rounded-full hover:bg-surface"
            aria-label="주간 옷 설정 닫기"
            autoFocus
          >
            <ChevronLeft size={25} />
          </button>
          <div>
            <h1 className="text-lg font-black">이번 주 옷 설정</h1>
            <p className="text-xs text-muted">요일을 고른 뒤 코디북의 코디를 배치하세요.</p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="scrollbar-hidden flex gap-2 overflow-x-auto pb-2" aria-label="설정할 요일">
            {entries.map((entry) => {
              const isActive = entry.date === activeDate
              return (
                <button
                  type="button"
                  onClick={() => setActiveDate(entry.date)}
                  className={`min-w-[76px] shrink-0 rounded-2xl border px-3 py-3 text-center transition ${
                    isActive
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-surface hover:border-ink'
                  }`}
                  aria-pressed={isActive}
                  key={entry.date}
                >
                  <span className="block text-xs font-bold opacity-70">{entry.dayLabel}요일</span>
                  <strong className="mt-1 block text-lg">{entry.dayNumber}</strong>
                  <span className="mt-1 block text-[10px]">{entry.itemIds.length > 0 ? `${entry.itemIds.length}개 설정` : '비어 있음'}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">
                {activeEntry?.dayLabel}요일에 입을 코디
              </h2>
              <p className="mt-1 text-sm text-muted">
                저장된 코디 하나를 선택할 수 있어요.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {outfits.length > 0 && (
                <button
                  type="button"
                  onClick={toggleSearch}
                  className={`flex size-9 items-center justify-center rounded-full border transition ${
                    isSearchOpen
                      ? 'border-ink bg-ink text-white'
                      : 'border-line bg-surface text-muted hover:text-ink'
                  }`}
                  aria-label={isSearchOpen ? '코디 검색 닫기' : '코디 검색'}
                  aria-expanded={isSearchOpen}
                  title={isSearchOpen ? '검색 닫기' : '코디 검색'}
                >
                  <Search size={17} />
                </button>
              )}
              {activeEntry && activeEntry.itemIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => void removeOutfit()}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-2 text-xs font-bold text-muted hover:border-ink hover:text-ink"
                >
                  <Trash2 size={14} /> 비우기
                </button>
              )}
            </div>
          </div>

          {outfits.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-line bg-surface p-8 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sage">
                <Images size={22} />
              </span>
              <h3 className="mt-4 font-black">
                먼저 코디북에 코디를 저장해주세요
              </h3>
              <p className="mt-2 text-sm text-muted">
                저장한 코디를 요일별로 빠르게 배치할 수 있어요.
              </p>
              <button
                type="button"
                onClick={() => navigate('/lookbook/new')}
                className="mt-5 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
              >
                코디 만들기
              </button>
            </div>
          ) : (
            <>
              <OutfitFilterControls
                activeSeason={activeSeason}
                activeStyle={activeStyle}
                isSearchOpen={isSearchOpen}
                searchQuery={searchQuery}
                styleOptions={visibleStyleOptions}
                onSeasonChange={setActiveSeason}
                onStyleChange={setActiveStyle}
                onSearchChange={setSearchQuery}
              />

              {visibleOutfits.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-line bg-surface p-8 text-center">
                  <h3 className="font-black">
                    {searchQuery.trim()
                      ? '검색 결과가 없어요'
                      : activeSeason
                        ? `${seasonLabels[activeSeason]} 코디가 없어요`
                        : activeStyle !== 'all'
                          ? `${getOutfitStyleLabel(activeStyle)} 코디가 없어요`
                          : '조건에 맞는 코디가 없어요'}
                  </h3>
                  <p className="mt-2 text-sm text-muted">
                    다른 검색어나 계절, 스타일을 선택해보세요.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {visibleOutfits.map((outfit) => {
                    const isAssigned = activeEntry?.outfitId === outfit.id
                    return (
                      <button
                        type="button"
                        onClick={() => void chooseOutfit(outfit)}
                        className={`relative overflow-hidden rounded-3xl border bg-surface p-2 text-left transition ${
                          isAssigned
                            ? 'border-accent ring-2 ring-accent/20'
                            : 'border-line hover:border-ink'
                        }`}
                        aria-pressed={isAssigned}
                        key={outfit.id}
                      >
                        {isAssigned && (
                          <span className="absolute top-4 right-4 z-10 flex size-7 items-center justify-center rounded-full bg-accent text-white">
                            <Check size={15} />
                          </span>
                        )}
                        <div className="relative">
                          <OutfitCardVisual
                            outfit={outfit}
                            items={items}
                            className="aspect-[4/5] w-full"
                          />
                          {outfit.previewImageUrl && (
                            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-bold text-white backdrop-blur">
                              <Sparkles size={10} /> AI 룩
                            </span>
                          )}
                        </div>
                        <div className="px-2 pt-3 pb-2">
                          <div className="flex min-w-0 gap-1 overflow-hidden">
                            <span className="inline-flex shrink-0 rounded-full bg-sage px-2 py-1 text-[10px] font-bold">
                              {getOutfitStyleLabel(outfit.style)}
                            </span>
                            {outfit.seasons.length > 0 && (
                              <span className="truncate rounded-full border border-line px-2 py-1 text-[10px] font-bold text-muted">
                                {formatSeasonLabels(outfit.seasons)}
                              </span>
                            )}
                          </div>
                          <strong className="mt-1 block truncate text-sm">
                            {outfit.name}
                          </strong>
                          <OutfitWearStatus
                            summary={wearSummaries.get(outfit.id)}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
