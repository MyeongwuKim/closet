import { useEffect, useState } from 'react'
import type { OutfitPreview } from '@closet/types'
import {
  BookHeart,
  Check,
  ChevronLeft,
  ImagePlus,
  LoaderCircle,
  Sparkles,
} from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useUiStore } from '../../../stores/useUiStore'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { useGenerateOutfitPreviewMutation } from '../../lookbook/api/lookbookQueries'
import { OutfitSlotEditor } from '../../lookbook/components/OutfitSlotEditor'
import { SavedOutfitPreviewDialog } from '../../lookbook/components/SavedOutfitPreviewDialog'
import { getOutfitCompletionMessage } from '../../lookbook/utils/outfitComposition'
import {
  usePlannerWeekQuery,
  useSavePlannerOutfitToLookbookMutation,
  useSetDirectPlannerEntryMutation,
} from '../api/plannerQueries'
import {
  createEmptyWeeklyPlan,
  getCurrentWeekStart,
} from '../data/weeklyPlan'
import { usePlanStore } from '../stores/usePlanStore'

export function PlanDetailPage() {
  const navigate = useNavigate()
  const { date } = useParams()
  const [searchParams] = useSearchParams()
  const items = useClosetStore((state) => state.items)
  const entries = usePlanStore((state) => state.entries)
  const setWeek = usePlanStore((state) => state.setWeek)
  const hydrateEntries = usePlanStore((state) => state.hydrateEntries)
  const setEntryItems = usePlanStore((state) => state.setEntryItems)
  const pushToast = useUiStore((state) => state.pushToast)
  const [isLookbookOpen, setIsLookbookOpen] = useState(false)
  const [generatedPreview, setGeneratedPreview] = useState<OutfitPreview | null>(
    null,
  )
  const [isPromoted, setIsPromoted] = useState(false)
  const generatePreview = useGenerateOutfitPreviewMutation()
  const setDirectPlannerEntry = useSetDirectPlannerEntryMutation()
  const saveToLookbook = useSavePlannerOutfitToLookbookMutation()
  const parsedDate = date ? new Date(`${date}T00:00:00`) : null
  const weekStartsOn =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? getCurrentWeekStart(parsedDate)
      : ''
  const plannerWeekQuery = usePlannerWeekQuery(weekStartsOn)
  const fallbackEntry = weekStartsOn
    ? createEmptyWeeklyPlan(weekStartsOn).find((plan) => plan.date === date)
    : undefined
  const entry =
    entries.find((plan) => plan.date === date) ??
    plannerWeekQuery.data?.find((plan) => plan.date === date) ??
    fallbackEntry
  const requestedBackPath = searchParams.get('from')
  const backPath =
    requestedBackPath?.startsWith('/') && !requestedBackPath.startsWith('//')
      ? requestedBackPath
      : '/plan'

  useEffect(() => {
    if (!plannerWeekQuery.data || !weekStartsOn) return
    setWeek(weekStartsOn)
    hydrateEntries(plannerWeekQuery.data)
  }, [hydrateEntries, plannerWeekQuery.data, setWeek, weekStartsOn])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isLookbookOpen) {
        setIsLookbookOpen(false)
        return
      }
      navigate(backPath)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [backPath, isLookbookOpen, navigate])

  if (!entry) return null

  const outfitItems = entry.itemIds
    .map((itemId) => items.find((item) => item.id === itemId))
    .filter((item) => item !== undefined)
  const isEmpty = outfitItems.length === 0
  const outfitCompletionMessage = getOutfitCompletionMessage(outfitItems)
  const generatedPreviewUrl = generatedPreview
    ? `data:${generatedPreview.mimeType};base64,${generatedPreview.imageBase64}`
    : null
  const previewImageUrl = generatedPreviewUrl ?? entry.previewImageUrl
  const isPlannerOnly = Boolean(
    entry.outfitId && entry.plannerOnly && !isPromoted,
  )
  const isSavedToLookbook = Boolean(
    entry.outfitId && (!entry.plannerOnly || isPromoted),
  )
  const entryDate = new Date(`${entry.date}T00:00:00`)
  const formattedDate = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
  }).format(entryDate)
  const entryTitle = entry.title || '코디를 설정해주세요'

  const openAiLookbook = async () => {
    if (previewImageUrl) {
      setIsLookbookOpen(true)
      return
    }
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return
    }

    try {
      const preview = await generatePreview.mutateAsync({
        selectedItemIds: outfitItems.map((item) => item.id),
        style: entry.outfitStyle,
      })
      setGeneratedPreview(preview)
      setIsLookbookOpen(true)
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'AI 룩북을 만들지 못했습니다.',
        'error',
      )
    }
  }

  const saveDirectOutfit = async () => {
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return
    }

    try {
      const nextEntries = await setDirectPlannerEntry.mutateAsync({
        weekStartsOn,
        date: entry.date,
        itemIds: outfitItems.map((item) => item.id),
        previewImage: generatedPreview ?? undefined,
        recommendationStyle: entry.outfitStyle,
      })
      hydrateEntries(nextEntries)
      const savedEntry = nextEntries.find(
        (nextEntry) => nextEntry.date === entry.date,
      )
      if (!savedEntry?.outfitId) {
        throw new Error('저장된 코디 정보를 찾을 수 없습니다.')
      }

      if (savedEntry.plannerOnly) {
        pushToast('변경한 코디를 이 날짜에 저장했습니다.', 'success')
      } else {
        pushToast(
          `같은 조합의 '${savedEntry.title}' 코디를 이 날짜에 연결했습니다.`,
          'success',
        )
      }
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '코디를 추가하지 못했습니다.',
        'error',
      )
    }
  }

  const promoteToLookbook = async () => {
    if (!entry.outfitId) return

    try {
      const savedOutfit = await saveToLookbook.mutateAsync({
        outfitId: entry.outfitId,
        previewImage: generatedPreview ?? undefined,
      })
      setIsPromoted(true)
      pushToast(
        savedOutfit.id === entry.outfitId
          ? '코디북에 저장했습니다.'
          : '같은 옷 조합의 기존 코디를 연결했습니다.',
        'success',
      )
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '코디북에 저장하지 못했습니다.',
        'error',
      )
    }
  }

  return (
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={`${entryTitle} 상세`}
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface"
            aria-label="플래너로 돌아가기"
            autoFocus
          >
            <ChevronLeft size={25} strokeWidth={2.2} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-[-0.03em]">
              {entryTitle}
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted">
              {formattedDate} · {entry.dayLabel}요일
              {entry.occasion ? ` · ${entry.occasion}` : ''}
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 px-3 py-3 sm:px-6 sm:py-6">
        <div className="mx-auto h-full max-w-3xl">
          <OutfitSlotEditor
            items={items}
            selectedItems={outfitItems}
            onChange={(nextItems) => {
              const nextItemIds = nextItems.map((item) => item.id)
              if (
                nextItemIds.length === entry.itemIds.length &&
                nextItemIds.every((itemId) => entry.itemIds.includes(itemId))
              ) {
                return
              }
              const hadSavedPreview = Boolean(entry.previewImageUrl)
              setGeneratedPreview(null)
              setEntryItems(entry.date, nextItemIds)
              if (hadSavedPreview) {
                pushToast(
                  '코디 구성이 바뀌어 기존 AI 룩북 연결을 해제했습니다.',
                )
              }
            }}
            className="h-full w-full"
          />
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)]">
        <div className="mx-auto grid max-w-3xl grid-cols-[0.95fr_1.05fr] gap-2">
          <button
            type="button"
            onClick={() => void openAiLookbook()}
            disabled={isEmpty || generatePreview.isPending}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generatePreview.isPending ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : previewImageUrl ? (
              <Sparkles size={18} />
            ) : (
              <ImagePlus size={18} />
            )}
            {generatePreview.isPending
              ? '만드는 중...'
              : previewImageUrl
                ? 'AI 룩북 보기'
                : 'AI 룩북 만들기'}
          </button>
          <button
            type="button"
            onClick={() =>
              void (isPlannerOnly ? promoteToLookbook() : saveDirectOutfit())
            }
            disabled={
              isEmpty ||
              Boolean(outfitCompletionMessage) ||
              isSavedToLookbook ||
              setDirectPlannerEntry.isPending ||
              saveToLookbook.isPending
            }
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSavedToLookbook ? (
              <Check size={17} />
            ) : isPlannerOnly ? (
              <BookHeart size={17} />
            ) : null}
            {setDirectPlannerEntry.isPending || saveToLookbook.isPending
              ? '저장 중...'
              : isSavedToLookbook
                ? '코디북 저장됨'
                : isPlannerOnly
                  ? '코디북에 추가'
                  : '변경사항 저장'}
          </button>
        </div>
      </footer>

      {isLookbookOpen && previewImageUrl && (
        <SavedOutfitPreviewDialog
          imageUrl={previewImageUrl}
          outfitName={entryTitle}
          isSaved={!generatedPreview}
          onClose={() => setIsLookbookOpen(false)}
        />
      )}
    </section>
  )
}
