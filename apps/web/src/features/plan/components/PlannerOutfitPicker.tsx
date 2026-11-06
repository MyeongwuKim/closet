import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { findDuplicateOutfit } from '../../lookbook/utils/outfitComposition'
import { useLookbookStore } from '../../lookbook/stores/useLookbookStore'
import {
  filterSavedOutfits,
  getVisibleOutfitStyleOptions,
} from '../../lookbook/utils/outfitFilters'
import {
  useClearPlannerEntryMutation,
  useSetPlannerEntryMutation,
} from '../api/plannerQueries'
import { getCurrentWeekStart, type PlanEntry } from '../data/weeklyPlan'
import { useRecentWearReminder } from '../hooks/useRecentWearReminder'
import { usePlanStore } from '../stores/usePlanStore'
import { WeeklyPlanDayButton } from './WeeklyPlanDayButton'

interface PlannerOutfitPickerProps {
  /** 지정하면 해당 날짜에만 배정한다. 생략하면 현재 주의 요일을 선택해 편집한다. */
  dayEntry?: PlanEntry
  onClose: () => void
  onAssigned?: () => void
  /** 날짜 상세처럼 이미 배경 스크롤을 잠근 화면 안에서는 끈다. */
  lockBodyScroll?: boolean
}

/** 코디북 검색과 날짜별 배정을 제공한다. 착용 완료 날짜는 안내만 표시하고, 주간 편집에서는 다른 요일을 이어서 고를 수 있다. */
export function PlannerOutfitPicker({ dayEntry, onClose, onAssigned, lockBodyScroll = true }: PlannerOutfitPickerProps) {
  const navigate = useNavigate()
  const items = useClosetStore((state) => state.items)
  const outfits = useLookbookStore((state) => state.outfits)
  const entries = usePlanStore((state) => state.entries)
  const clearOutfit = usePlanStore((state) => state.clearOutfit)
  const pushToast = useUiStore((state) => state.pushToast)
  const setPlannerEntry = useSetPlannerEntryMutation()
  const clearPlannerEntry = useClearPlannerEntryMutation()
  const { confirmRecentWear, isCheckingRecentWear } =
    useRecentWearReminder()
  const [activeWeekDate, setActiveWeekDate] = useState(entries[0]?.date ?? '')
  const [activeStyle, setActiveStyle] = useState('all')
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const wearSummaries = useOutfitWearSummaries(
    outfits.map((outfit) => outfit.id),
  )
  const activeEntry = dayEntry ?? entries.find((entry) => entry.date === activeWeekDate)
  const isWearConfirmed = Boolean(activeEntry?.wornAt)
  const formattedDay = dayEntry
    ? new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' })
        .format(new Date(`${dayEntry.date}T00:00:00`))
    : null
  const dialogTitle = dayEntry ? '하루 코디 선택' : '주간 코디 편집'
  const isSavingDay = Boolean(dayEntry && setPlannerEntry.isPending)
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
    if (lockBodyScroll) document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !isSavingDay &&
        !useUiStore.getState().recentWearConfirmation
      ) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      if (lockBodyScroll) document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSavingDay, lockBodyScroll, onClose])

  const chooseOutfit = async (outfit: (typeof outfits)[number]) => {
    if (!activeEntry || isWearConfirmed) return
    const { date, occasion } = activeEntry
    const weekStartsOn = dayEntry
      ? getCurrentWeekStart(new Date(`${date}T00:00:00`))
      : entries[0]?.date
    if (!weekStartsOn) return

    const confirmed = await confirmRecentWear({
      itemIds: outfit.layers.map((layer) => layer.wardrobeItemId),
      targetDate: date,
      confirmLabel: '그래도 추가',
      cancelLabel: '다른 코디 고르기',
    })
    if (!confirmed) return

    try {
      await setPlannerEntry.mutateAsync({
        weekStartsOn,
        date,
        outfitId: outfit.id,
        title: outfit.name,
        occasion,
      })
    } catch (error) {
      pushToast(error instanceof Error ? error.message : '플래너를 저장하지 못했습니다.', 'error')
      return
    }

    pushToast(`${formattedDay ?? `${activeEntry.dayLabel}요일`} 코디를 설정했습니다.`, 'success')
    if (dayEntry) {
      onAssigned?.()
      onClose()
    }
  }

  const removeOutfit = async () => {
    if (!activeEntry || isWearConfirmed) return
    if (activeEntry.outfitId && /^[a-f\d]{24}$/i.test(activeEntry.outfitId)) {
      try {
        await clearPlannerEntry.mutateAsync({
          weekStartsOn: entries[0].date,
          date: activeWeekDate,
        })
      } catch (error) {
        pushToast(
          error instanceof Error ? error.message : '플래너를 비우지 못했습니다.',
          'error',
        )
        return
      }
    }
    clearOutfit(activeWeekDate)
  }

  const toggleSearch = () => {
    if (isSearchOpen) setSearchQuery('')
    setIsSearchOpen(!isSearchOpen)
  }

  return createPortal(
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={dialogTitle}
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center gap-3 px-3 py-2 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSavingDay}
            className="flex size-10 items-center justify-center rounded-full hover:bg-surface disabled:opacity-50"
            aria-label={dayEntry ? '하루 코디 선택 닫기' : '주간 옷 설정 닫기'}
            autoFocus
          >
            <ChevronLeft size={25} />
          </button>
          <div>
            <h1 className="text-lg font-black">{dialogTitle}</h1>
            <p className="text-xs text-muted">
              {dayEntry ? '코디북에 저장한 코디를 골라주세요.' : '요일을 고른 뒤 코디북의 코디를 배치하세요.'}
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {!dayEntry && (
            <div className="scrollbar-hidden flex gap-2 overflow-x-auto pb-2" aria-label="설정할 요일">
              {entries.map((entry) => (
                <WeeklyPlanDayButton
                  key={entry.date}
                  entry={entry}
                  items={items}
                  isActive={entry.date === activeWeekDate}
                  onSelect={setActiveWeekDate}
                />
              ))}
            </div>
          )}

          <div className={`flex items-center justify-between gap-3 ${dayEntry ? '' : 'mt-6'}`}>
            <div>
              <h2 className="text-xl font-black">
                {formattedDay ? `${formattedDay}에 넣을 코디` : `${activeEntry?.dayLabel ?? ''}요일에 입을 코디`}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {isWearConfirmed ? '실제로 입은 코디가 기록되어 있어요.' : '저장된 코디 하나를 선택할 수 있어요.'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!isWearConfirmed && outfits.length > 0 && (
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
              {!isWearConfirmed && !dayEntry && activeEntry && activeEntry.itemIds.length > 0 && (
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

          {isWearConfirmed ? (
            <div className="mt-5 rounded-3xl border border-line bg-surface p-5">
              <h3 className="font-bold text-ink">착용 완료</h3>
              <p className="mt-1 text-sm text-muted">코디를 바꾸거나 비우려면 날짜 상세에서 먼저 착용을 취소해 주세요.</p>
            </div>
          ) : outfits.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-line bg-surface p-8 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sage">
                <Images size={22} />
              </span>
              <h3 className="mt-4 font-black">
                먼저 코디북에 코디를 저장해주세요
              </h3>
              <p className="mt-2 text-sm text-muted">
                {dayEntry ? '저장한 코디를 선택한 날짜에 바로 넣을 수 있어요.' : '저장한 코디를 요일별로 빠르게 배치할 수 있어요.'}
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
                    const isAssigned = Boolean(activeEntry?.outfitId && findDuplicateOutfit([outfit], activeEntry.itemIds))
                    return (
                      <button
                        type="button"
                        onClick={() => void chooseOutfit(outfit)}
                        disabled={
                          isCheckingRecentWear || setPlannerEntry.isPending
                        }
                        className={`relative overflow-hidden rounded-3xl border bg-surface p-2 text-left transition ${
                          isAssigned
                            ? 'border-accent ring-2 ring-accent/20'
                            : 'border-line hover:border-ink'
                        } disabled:cursor-wait disabled:opacity-60`}
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
    </section>,
    document.body,
  )
}
