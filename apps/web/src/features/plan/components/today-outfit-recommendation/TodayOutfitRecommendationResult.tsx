import { useEffect, useState } from 'react'
import type { OutfitPreview, Season, WardrobeItem } from '@closet/types'
import {
  CalendarPlus,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  getOutfitStyleLabel,
  type OutfitStyle,
} from '../../../../constants/styleOptions'
import { seasonLabels } from '../../../../constants/seasons'
import { useUiStore } from '../../../../stores/useUiStore'
import { ClosetItemVisual } from '../../../closet/components/ClosetItemVisual'
import { useClosetStore } from '../../../closet/stores/useClosetStore'
import { useSetDirectPlannerEntryMutation } from '../../api/plannerQueries'
import {
  readStoredTodayRecommendation,
  storeTodayRecommendation,
  useTodayOutfitRecommendationQuery,
} from '../../api/todayOutfitQueries'
import { getCurrentWeekStart } from '../../data/weeklyPlan'
import { usePlanStore } from '../../stores/usePlanStore'
import { TodayOutfitRecommendationDialog } from '../TodayOutfitRecommendationDialog'
import { TodayOutfitRecommendationLoading } from '../TodayOutfitRecommendationLoading'

interface TodayOutfitRecommendationResultProps {
  viewerId: string
  date: string
  season: Season
  style: OutfitStyle
  hasTodayOutfit: boolean
}

function formatRecommendationHeadline(value: string) {
  const normalized = value
    .trim()
    .replace(/^추천\s*코디\s*[—–-]\s*/u, '')
    .replace(/\s*(?:루킹|룩킹)/gu, ' 코디')
    .replace(/코디(?:\s+코디)+/gu, '코디')
    .replace(/\s+/gu, ' ')
    .trim()

  return normalized || '오늘의 추천 코디'
}

export function TodayOutfitRecommendationResult({
  viewerId,
  date,
  season,
  style,
  hasTodayOutfit,
}: TodayOutfitRecommendationResultProps) {
  const navigate = useNavigate()
  const closetItems = useClosetStore((state) => state.items)
  const pushToast = useUiStore((state) => state.pushToast)
  const hydrateEntries = usePlanStore((state) => state.hydrateEntries)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [storedRecommendation] = useState(() =>
    readStoredTodayRecommendation(viewerId, date, season, style),
  )
  const [variation, setVariation] = useState(
    storedRecommendation?.variation ?? 0,
  )
  const recommendationQuery = useTodayOutfitRecommendationQuery(
    viewerId,
    date,
    season,
    style,
    variation,
    storedRecommendation?.variation === variation
      ? storedRecommendation.recommendation
      : undefined,
  )
  const setDirectPlannerEntry = useSetDirectPlannerEntryMutation()
  const recommendation = recommendationQuery.data

  useEffect(() => {
    if (!recommendation || recommendationQuery.isPlaceholderData) return
    storeTodayRecommendation(
      viewerId,
      date,
      season,
      style,
      variation,
      recommendation,
    )
  }, [
    date,
    recommendation,
    recommendationQuery.isPlaceholderData,
    season,
    style,
    variation,
    viewerId,
  ])

  const applyTodayOutfit = async (
    selectedItems: WardrobeItem[] = recommendation?.items ?? [],
    previewImage?: OutfitPreview,
  ) => {
    if (!recommendation?.ready) return false

    try {
      const nextEntries = await setDirectPlannerEntry.mutateAsync({
        weekStartsOn: getCurrentWeekStart(new Date(`${date}T00:00:00`)),
        date,
        itemIds: selectedItems.map((item) => item.id),
        previewImage,
        recommendationName: formatRecommendationHeadline(
          recommendation.headline,
        ),
        recommendationStyle: style,
      })
      hydrateEntries(nextEntries)
      pushToast(
        hasTodayOutfit
          ? '오늘의 코디를 추천 조합으로 바꿨어요.'
          : '추천 코디를 오늘 일정에 담았어요.',
        'success',
      )
      return true
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '추천 코디를 담지 못했어요.',
        'error',
      )
      return false
    }
  }

  if (recommendationQuery.isLoading) {
    return <TodayOutfitRecommendationLoading />
  }

  if (recommendationQuery.isError || !recommendation) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-sm font-black">오늘의 코디를 불러오지 못했어요</p>
        <button
          type="button"
          onClick={() => void recommendationQuery.refetch()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-bold"
        >
          <RefreshCw size={14} /> 다시 시도
        </button>
      </section>
    )
  }

  if (!recommendation.ready) {
    return (
      <section className="flex h-full flex-col justify-center rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage">
            <Sparkles size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black tracking-[0.08em] text-accent">
              오늘의 추천
            </p>
            <h2 className="mt-1 text-base font-black">
              {formatRecommendationHeadline(recommendation.headline)}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              {recommendation.summary}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/closet')}
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white"
        >
          옷 등록하러 가기 <ChevronRight size={16} />
        </button>
      </section>
    )
  }

  return (
    <>
      <section
        key={`${recommendation.headline}:${recommendation.items.map((item) => item.id).join(',')}`}
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_8px_24px_rgba(27,27,24,0.05)]"
      >
        <div className="flex min-h-0 flex-1 items-center gap-3 p-3">
          <button
            type="button"
            onClick={() => setIsDetailOpen(true)}
            style={{ animationDelay: '140ms' }}
            className="ai-recommendation-chat-enter group relative grid size-24 shrink-0 grid-cols-2 gap-1 rounded-xl bg-canvas p-1.5 text-left transition hover:ring-2 hover:ring-accent/30 focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="추천 코디 자세히 보기"
          >
            {recommendation.items.slice(0, 4).map((item) => (
              <span
                className="flex min-h-0 items-center justify-center overflow-hidden rounded-lg bg-surface"
                key={item.id}
              >
                <ClosetItemVisual item={item} compact />
              </span>
            ))}
            <span className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full bg-ink text-white shadow-sm transition group-hover:bg-accent">
              <ChevronRight size={13} />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <span
              className="ai-recommendation-chat-enter inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-black text-accent"
              style={{ animationDelay: '70ms' }}
            >
              <Sparkles size={11} /> {seasonLabels[season]} ·{' '}
              {getOutfitStyleLabel(recommendation.style)}
            </span>
            <h2
              className="ai-recommendation-chat-enter mt-2 max-h-10 overflow-hidden text-sm leading-5 font-black tracking-[-0.02em]"
              style={{ animationDelay: '210ms' }}
            >
              {formatRecommendationHeadline(recommendation.headline)}
            </h2>
            <p
              className="ai-recommendation-chat-enter mt-1 max-h-12 overflow-hidden text-[11px] leading-4 text-muted"
              style={{ animationDelay: '260ms' }}
            >
              {recommendation.summary}
            </p>
            <button
              type="button"
              onClick={() => setIsDetailOpen(true)}
              style={{ animationDelay: '310ms' }}
              className="ai-recommendation-chat-enter mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-muted hover:text-ink"
            >
              자세히 보기 <ChevronRight size={11} />
            </button>
          </div>
        </div>

        <div
          className="ai-recommendation-chat-enter grid shrink-0 grid-cols-[0.85fr_1.15fr] gap-2 border-t border-line/70 bg-canvas/45 p-2.5"
          style={{ animationDelay: '360ms' }}
        >
          <button
            type="button"
            onClick={() => setVariation((current) => (current + 1) % 21)}
            disabled={recommendationQuery.isFetching}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            <RefreshCw
              className={recommendationQuery.isFetching ? 'animate-spin' : ''}
              size={15}
            />
            다른 추천
          </button>
          <button
            type="button"
            onClick={() => void applyTodayOutfit()}
            disabled={setDirectPlannerEntry.isPending}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {setDirectPlannerEntry.isPending ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : (
              <CalendarPlus size={16} />
            )}
            {hasTodayOutfit ? '오늘 코디 바꾸기' : '오늘 일정에 담기'}
          </button>
        </div>
      </section>

      {isDetailOpen && (
        <TodayOutfitRecommendationDialog
          date={date}
          items={closetItems}
          initialItems={recommendation.items}
          hasTodayOutfit={hasTodayOutfit}
          isSaving={setDirectPlannerEntry.isPending}
          onClose={() => setIsDetailOpen(false)}
          onApply={applyTodayOutfit}
        />
      )}
    </>
  )
}
