import { useState } from 'react'
import type { Season, WardrobeItem, WeatherSnapshot } from '@closet/types'
import {
  CalendarPlus,
  ChevronRight,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import {
  getOutfitStyleLabel,
  type OutfitStyle,
} from '../../../../constants/styleOptions'
import { seasonLabels } from '../../../../constants/seasons'
import { useWardrobeItemsQuery } from '../../../closet/api/wardrobeQueries'
import { ClosetItemVisual } from '../../../closet/components/ClosetItemVisual'
import { useClosetStore } from '../../../closet/stores/useClosetStore'
import { useTodayOutfitRecommendationResult } from '../../hooks/useTodayOutfitRecommendationResult'
import { formatRecommendationHeadline } from '../../utils/todayOutfitRecommendation'
import { TodayOutfitRecommendationDialog } from '../TodayOutfitRecommendationDialog'
import { TodayOutfitRecommendationLoading } from '../TodayOutfitRecommendationLoading'
import { RecommendationExplanationDialog } from './RecommendationExplanationDialog'
import { WeatherSnapshotSummary } from '../../../weather/components/WeatherSnapshotSummary'

interface TodayOutfitRecommendationResultProps {
  viewerId: string
  date: string
  season: Season
  style: OutfitStyle
  baseItemId?: string
  weather?: WeatherSnapshot | null
  hasTodayOutfit: boolean
  onOpenCloset: () => void
}

function RecommendationRefreshLoading({
  items,
  season,
  style,
}: {
  items: WardrobeItem[]
  season: Season
  style: OutfitStyle
}) {
  return (
    <div
      className="ai-recommendation-chat-enter flex min-h-0 flex-1 items-center gap-3 p-3"
      role="status"
      aria-live="polite"
      aria-label="다른 추천 코디를 고르고 있습니다"
    >
      <div
        className="relative grid size-24 shrink-0 grid-cols-2 gap-1 overflow-hidden rounded-xl bg-canvas p-1.5"
        aria-hidden="true"
      >
        {items.slice(0, 4).map((item, index) => (
          <span
            className="ai-recommendation-refresh-item flex min-h-0 items-center justify-center overflow-hidden rounded-lg bg-surface"
            style={{ animationDelay: `${index * 140}ms` }}
            key={item.id}
          >
            <ClosetItemVisual item={item} compact />
          </span>
        ))}
        <span className="absolute inset-0 bg-canvas/35" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-9 items-center justify-center rounded-xl bg-ink text-white shadow-lg">
            <Sparkles className="ai-outfit-loading-sparkles" size={17} />
          </span>
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-black text-accent">
          <Sparkles size={11} /> {seasonLabels[season]} ·{' '}
          {getOutfitStyleLabel(style)}
        </span>
        <h2 className="mt-2 text-sm leading-5 font-black tracking-[-0.02em]">
          다른 조합을 맞춰보고 있어요
        </h2>
        <p className="mt-1 text-[11px] leading-4 text-muted">
          실루엣과 아이템 궁합을 다시 살펴보는 중이에요
          <span className="ml-1 inline-flex gap-0.5" aria-hidden="true">
            <span className="ai-outfit-loading-dot">.</span>
            <span className="ai-outfit-loading-dot">.</span>
            <span className="ai-outfit-loading-dot">.</span>
          </span>
        </p>
      </div>
    </div>
  )
}

export function TodayOutfitRecommendationResult({
  viewerId,
  date,
  season,
  style,
  baseItemId,
  weather,
  hasTodayOutfit,
  onOpenCloset,
}: TodayOutfitRecommendationResultProps) {
  const closetItems = useClosetStore((state) => state.items)
  const [activeOverlay, setActiveOverlay] = useState<
    'explanation' | 'detail-result' | 'detail-explanation' | null
  >(null)
  const isDetailOpen =
    activeOverlay === 'detail-result' ||
    activeOverlay === 'detail-explanation'
  const wardrobeQuery = useWardrobeItemsQuery(isDetailOpen)
  const {
    recommendation,
    recommendationQuery,
    refreshSourceItems,
    errorMessage,
    isSaving,
    actions,
  } = useTodayOutfitRecommendationResult({
    viewerId,
    date,
    season,
    style,
    baseItemId,
    weather,
    hasTodayOutfit,
  })

  if (recommendationQuery.isLoading) {
    return <TodayOutfitRecommendationLoading />
  }

  if (recommendationQuery.isError || !recommendation) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-sm font-black">
          {baseItemId
            ? '이 옷에 맞는 코디를 불러오지 못했어요'
            : '오늘의 코디를 불러오지 못했어요'}
        </p>
        <p className="mt-2 text-xs leading-5 text-muted" role="alert">
          {errorMessage}
        </p>
        <button
          type="button"
          onClick={() => void recommendationQuery.refetch()}
          disabled={recommendationQuery.isFetching}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-bold disabled:opacity-50"
        >
          <RefreshCw
            className={recommendationQuery.isFetching ? 'animate-spin' : ''}
            size={14}
          />{' '}
          다시 시도
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
          onClick={onOpenCloset}
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
        aria-busy={recommendationQuery.isFetching}
      >
        {recommendationQuery.isFetching ? (
          <RecommendationRefreshLoading
            items={
              refreshSourceItems.length > 0
                ? refreshSourceItems
                : recommendation.items
            }
            season={season}
            style={style}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center gap-3 p-3">
            <button
              type="button"
              onClick={() => setActiveOverlay('detail-result')}
              style={{ animationDelay: '140ms' }}
              className="ai-recommendation-chat-enter group relative grid size-24 shrink-0 grid-cols-2 gap-1 rounded-xl bg-canvas p-1.5 text-left transition hover:ring-2 hover:ring-accent/30 focus-visible:outline-2 focus-visible:outline-accent"
              aria-label="추천 코디 구성 변경하기"
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
              <div className="flex items-center gap-2">
                <span
                  className="ai-recommendation-chat-enter inline-flex min-w-0 items-center gap-1 rounded-full bg-accent/10 px-2 py-1 text-[10px] font-black text-accent"
                  style={{ animationDelay: '70ms' }}
                >
                  <Sparkles className="shrink-0" size={11} />
                  <span className="truncate">
                    {seasonLabels[season]} ·{' '}
                    {getOutfitStyleLabel(recommendation.style)}
                  </span>
                </span>
              </div>
              <h2
                className="ai-recommendation-chat-enter mt-2 line-clamp-2 text-sm leading-5 font-black tracking-[-0.02em]"
                style={{ animationDelay: '210ms' }}
              >
                {formatRecommendationHeadline(recommendation.headline)}
              </h2>
              <p
                className="ai-recommendation-chat-enter mt-1 line-clamp-3 text-[11px] leading-4 text-muted"
                style={{ animationDelay: '260ms' }}
              >
                {recommendation.summary}
              </p>
              {recommendation.weather && (
                <WeatherSnapshotSummary weather={recommendation.weather} compact />
              )}
              <button
                type="button"
                onClick={() => setActiveOverlay('explanation')}
                style={{ animationDelay: '310ms' }}
                className="ai-recommendation-chat-enter mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-muted hover:text-ink"
                aria-haspopup="dialog"
                aria-expanded={activeOverlay === 'explanation'}
              >
                설명 전체 보기 <ChevronRight size={11} />
              </button>
            </div>
          </div>
        )}

        <div
          className="ai-recommendation-chat-enter grid shrink-0 grid-cols-[0.85fr_1.15fr] gap-2 border-t border-line/70 bg-canvas/45 p-2.5"
          style={{ animationDelay: '360ms' }}
        >
          <button
            type="button"
            onClick={actions.requestAnotherRecommendation}
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
            onClick={() => void actions.applyTodayOutfit()}
            disabled={recommendationQuery.isFetching || isSaving}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {isSaving ? (
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
          title={formatRecommendationHeadline(recommendation.headline)}
          backLabel={
            activeOverlay === 'detail-explanation'
              ? '추천 설명으로 돌아가기'
              : '추천 코디로 돌아가기'
          }
          items={wardrobeQuery.data ?? closetItems}
          initialItems={recommendation.items}
          style={style}
          hasTodayOutfit={hasTodayOutfit}
          isSaving={isSaving}
          onClose={() =>
            setActiveOverlay(
              activeOverlay === 'detail-explanation' ? 'explanation' : null,
            )
          }
          onApplied={() => setActiveOverlay(null)}
          onApply={actions.applyTodayOutfit}
        />
      )}

      {activeOverlay === 'explanation' && (
        <RecommendationExplanationDialog
          headline={recommendation.headline}
          summary={recommendation.summary}
          reasons={recommendation.reasons}
          season={season}
          style={style}
          items={recommendation.items}
          onClose={() => setActiveOverlay(null)}
          onOpenDetails={() => setActiveOverlay('detail-explanation')}
        />
      )}
    </>
  )
}
