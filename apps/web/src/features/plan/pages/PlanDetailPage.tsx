import { AiCreditActionButton } from '../../lookbook/components/AiCreditActionButton'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OutfitPreview, WardrobeItem } from '@closet/types'
import {
  BookHeart,
  ChevronLeft,
  ImagePlus,
  Images,
  LoaderCircle,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { useUiStore } from '../../../stores/useUiStore'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { useGenerateOutfitPreviewMutation } from '../../lookbook/api/lookbookQueries'
import { OutfitSlotEditor } from '../../lookbook/components/OutfitSlotEditor'
import { OutfitPreviewDialogView } from '../../lookbook/components/OutfitPreviewDialog'
import { PreviewCreditSummary } from '../../lookbook/components/PreviewCreditSummary'
import { SavedOutfitPreviewDialog } from '../../lookbook/components/SavedOutfitPreviewDialog'
import type { OutfitPreviewState } from '../../lookbook/contexts/OutfitComposerContext'
import { getOutfitCompletionMessage } from '../../lookbook/utils/outfitComposition'
import { getOutfitPreviewCompositionKey } from '../../lookbook/utils/outfitPreviewCache'
import {
  usePlannerWeekQuery,
  useClearPlannerEntryMutation,
  useSavePlannerOutfitToLookbookMutation,
  useSetDirectPlannerEntryMutation,
} from '../api/plannerQueries'
import {
  createEmptyWeeklyPlan,
  getCurrentWeekStart,
} from '../data/weeklyPlan'
import { useRecentWearReminder } from '../hooks/useRecentWearReminder'
import { usePlanStore } from '../stores/usePlanStore'
import { PlannerOutfitPicker } from '../components/PlannerOutfitPicker'
import { PlannerWearAction } from '../components/PlannerWearAction'
import { PlanTomorrowForecast } from '../components/PlanTomorrowForecast'
import { useKoreaPlannerToday } from '../hooks/useKoreaPlannerToday'
import { getPlanEntryItems } from '../utils/plannerItems'
import { getKoreaPlannerTomorrow } from '../utils/plannerWear'

/** 아직 생성하지 않았거나 구성이 바뀐 플래너 미리보기의 닫힌 초기 상태를 만든다. */
function createPreviewDialogState(): OutfitPreviewState {
  return { isOpen: false, status: 'idle', imageUrl: null, imageBase64: null, assetId: null, compositionKey: null, mimeType: null, model: null, errorMessage: null }
}

/** 복원한 완료 이미지도 새 생성 결과와 같은 팝업·저장 경로로 연다. */
function completedPreviewDialog(preview: OutfitPreview, compositionKey: string, isOpen: boolean): OutfitPreviewState {
  return {
    ...createPreviewDialogState(), isOpen, status: 'success', compositionKey,
    imageUrl: preview.imageUrl ?? `data:${preview.mimeType};base64,${preview.imageBase64}`,
    imageBase64: preview.imageBase64, assetId: preview.assetId ?? null, mimeType: preview.mimeType, model: preview.model,
  }
}

/** 플래너 → 날짜별 코디 설정. 직접 편집, 코디북 배정, 내일 예보 추천을 제공하고 실제 착용 기록과 저장한 이미지를 관리한다. */
export function PlanDetailPage() {
  const navigate = useNavigate()
  const { date } = useParams()
  const [searchParams] = useSearchParams()
  const today = useKoreaPlannerToday()
  const items = useClosetStore((state) => state.items)
  const entries = usePlanStore((state) => state.entries)
  const setWeek = usePlanStore((state) => state.setWeek)
  const hydrateEntries = usePlanStore((state) => state.hydrateEntries)
  const setEntryItems = usePlanStore((state) => state.setEntryItems)
  const clearOutfit = usePlanStore((state) => state.clearOutfit)
  const pushToast = useUiStore((state) => state.pushToast)
  const [isOutfitPickerOpen, setIsOutfitPickerOpen] = useState(false)
  const [isTomorrowRecommendationOpen, setIsTomorrowRecommendationOpen] = useState(false)
  const detailDialogRef = useRef<HTMLElement>(null)
  const [isLookbookOpen, setIsLookbookOpen] = useState(false)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false)
  const [generatedPreview, setGeneratedPreview] = useState<OutfitPreview | null>(
    null,
  )
  /** 생성 팝업의 열림·진행·결과 상태. 닫아도 요청을 취소하지 않고 같은 구성의 완료 결과는 보관한다. */
  const [previewDialog, setPreviewDialog] = useState(createPreviewDialogState)
  /** 요청 당시의 옷 사진. 팝업을 닫은 뒤 구성을 편집해도 진행 중인 작업의 옷을 바꾸지 않는다. */
  const [previewItems, setPreviewItems] = useState<WardrobeItem[]>([])
  /** 코디북 복사는 날짜 코디를 승격하지 않는다. 복사한 날짜·구성·이미지에만 완료 안내를 표시한다. */
  const [copiedRecordKey, setCopiedRecordKey] = useState<string | null>(null)
  const previewRequestVersionRef = useRef(0)
  const previewInFlightRef = useRef<string | null>(null)
  const setDirectPlannerEntry = useSetDirectPlannerEntryMutation()
  const { confirmRecentWear, isCheckingRecentWear } =
    useRecentWearReminder()
  const clearPlannerEntry = useClearPlannerEntryMutation()
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
  const activeItems = items.filter((item) => !item.archivedAt)
  const outfitItems = entry ? getPlanEntryItems(entry, activeItems) : []
  const outfitCompletionMessage = getOutfitCompletionMessage(outfitItems)
  const generatePreview = useGenerateOutfitPreviewMutation(
    entry && !outfitCompletionMessage
      ? { selectedItemIds: entry.itemIds, style: entry.outfitStyle }
      : undefined,
  )
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

  // 날짜 이동·화면 종료 뒤 이전 요청이 다른 날짜의 편집 결과에 붙지 않게 한다. 서버 작업은 계속된다.
  useEffect(() => () => { previewRequestVersionRef.current += 1 }, [date])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (event.defaultPrevented || detailDialogRef.current?.inert) return
      if (useUiStore.getState().recentWearConfirmation) return
      if (previewDialog.isOpen) {
        setPreviewDialog((current) => ({ ...current, isOpen: false }))
        return
      }
      if (isRemoveConfirmOpen) {
        setIsRemoveConfirmOpen(false)
        return
      }
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
  }, [backPath, isLookbookOpen, isRemoveConfirmOpen, navigate, previewDialog.isOpen])

  if (!entry) return null

  const hasArchivedItems = outfitItems.some((item) => item.archivedAt)
  const isEmpty = outfitItems.length === 0
  const currentPreviewKey = `${entry.date}:${getOutfitPreviewCompositionKey(entry.itemIds, entry.outfitStyle ?? '')}`
  const currentGeneratedPreview = previewDialog.compositionKey === currentPreviewKey ? generatedPreview : null
  // 다른 화면의 공용 완료 결과는 명시적으로 열기 전까지 이 날짜의 저장 사진을 대신하지 않는다.
  const readyPreview = currentGeneratedPreview
  const hasCurrentPendingPreview = !generatePreview.hasCompletedPreview && (generatePreview.canResumeExisting || (generatePreview.isPending && previewDialog.compositionKey === currentPreviewKey))
  const generatedPreviewUrl = readyPreview
    ? readyPreview.imageUrl ?? `data:${readyPreview.mimeType};base64,${readyPreview.imageBase64}`
    : null
  const previewImageUrl = generatedPreviewUrl ?? entry.previewImageUrl
  const hasCompletedImage = Boolean(previewImageUrl || generatePreview.hasCompletedPreview)
  const isCompletedLookupError = generatePreview.isCompletedLookupError && !hasCompletedImage
  const hasLocalPreview = Boolean(readyPreview || entry.previewImageUrl)
  const isPreviewActionLoading = hasCurrentPendingPreview || (!hasLocalPreview && (generatePreview.isPending || generatePreview.isRestoringCompleted))
  const isPreviewActionDisabled = isEmpty || (hasArchivedItems && !hasCompletedImage && !hasCurrentPendingPreview) || (!hasLocalPreview && generatePreview.isRestoringCompleted) || (generatePreview.isPending && !hasCurrentPendingPreview && !hasCompletedImage)
  const hasUnsavedPreview = Boolean(readyPreview && (
    readyPreview.assetId ? readyPreview.assetId !== entry.previewImageAssetId : generatedPreviewUrl !== entry.previewImageUrl
  ))
  const isDateSaved = Boolean(entry.outfitId) && !hasUnsavedPreview
  const recordKey = `${entry.date}:${entry.outfitId ?? ''}:${currentPreviewKey}:${entry.previewImageAssetId ?? entry.previewImageUrl ?? ''}`
  const isCopiedToLookbook = copiedRecordKey === recordKey
  const hasPlannerOutfit = Boolean(entry.outfitId || entry.itemIds.length > 0)
  const isWearProtected = Boolean(entry.wornAt)
  const isTomorrow = entry.date === getKoreaPlannerTomorrow(today)
  const entryDate = new Date(`${entry.date}T00:00:00`)
  const formattedDate = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
  }).format(entryDate)
  const entryTitle = entry.title || '코디를 설정해주세요'

  /** 코디북 배정이 성공하면 이전 초안의 AI 결과가 새 날짜 코디에 붙지 않도록 초기화한다. */
  const resetPreviewAfterAssignment = () => {
    previewRequestVersionRef.current += 1
    setGeneratedPreview(null)
    setPreviewDialog(createPreviewDialogState())
    setCopiedRecordKey(null)
  }

  const openAiLookbook = async (forceNew = false) => {
    if (previewInFlightRef.current === currentPreviewKey) {
      if (previewDialog.compositionKey === currentPreviewKey) setPreviewDialog((current) => ({ ...current, isOpen: true }))
      return
    }
    if (!forceNew && !hasCurrentPendingPreview && !readyPreview && entry.previewImageUrl) {
      setIsLookbookOpen(true)
      return
    }
    // 완료 포인터가 있으면 이미지 조회만 재시도한다. 조회 실패를 새 생성으로 처리하지 않는다.
    if (!forceNew && !hasCurrentPendingPreview && (readyPreview || generatePreview.hasCompletedPreview || isCompletedLookupError)) {
      const requestedPreviewVersion = previewRequestVersionRef.current
      try {
        const preview = readyPreview ?? await generatePreview.restoreCompletedAsync()
        if (previewRequestVersionRef.current !== requestedPreviewVersion) return
        setGeneratedPreview(preview)
        setPreviewItems(outfitItems)
        setPreviewDialog(completedPreviewDialog(preview, currentPreviewKey, true))
      } catch (error) {
        if (previewRequestVersionRef.current === requestedPreviewVersion) pushToast(error instanceof Error ? error.message : '완료 이미지를 불러오지 못했어요.', 'error')
      }
      return
    }
    // 화면 복귀로 찾은 작업은 결과가 바뀌었더라도 새 접수 없이 같은 작업만 조회한다.
    const resumeExisting = !forceNew && generatePreview.canResumeExisting
    if (!resumeExisting && !forceNew && previewImageUrl) {
      setIsLookbookOpen(true)
      return
    }
    if (hasArchivedItems && !resumeExisting) {
      pushToast('새 AI 룩북을 만들려면 삭제된 옷을 교체해주세요.', 'error')
      return
    }
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return
    }

    const requestedPreviewVersion = previewRequestVersionRef.current
    previewInFlightRef.current = currentPreviewKey
    setPreviewItems(outfitItems)
    setGeneratedPreview(null)
    setPreviewDialog({ ...createPreviewDialogState(), isOpen: true, status: 'loading', compositionKey: currentPreviewKey })

    try {
      const preview = await (resumeExisting
        ? generatePreview.resumeExistingAsync()
        : generatePreview.mutateAsync({
          selectedItemIds: outfitItems.map((item) => item.id),
          style: entry.outfitStyle,
        }))
      if (previewRequestVersionRef.current !== requestedPreviewVersion) return
      setGeneratedPreview(preview)
      setPreviewDialog((current) => completedPreviewDialog(preview, currentPreviewKey, current.isOpen))
    } catch (error) {
      if (previewRequestVersionRef.current !== requestedPreviewVersion) return
      setPreviewDialog((current) => ({ ...current, status: 'error', errorMessage: error instanceof Error ? error.message : 'AI 룩북을 만들지 못했습니다.' }))
    } finally {
      if (previewInFlightRef.current === currentPreviewKey) previewInFlightRef.current = null
    }
  }

  const saveDirectOutfit = async () => {
    if (hasArchivedItems) {
      pushToast('변경사항을 저장하려면 삭제된 옷을 교체해주세요.', 'error')
      return false
    }
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return false
    }

    const confirmed = await confirmRecentWear({
      itemIds: outfitItems.map((item) => item.id),
      targetDate: entry.date,
      confirmLabel: '그래도 저장',
      cancelLabel: '코디 다시 고르기',
    })
    if (!confirmed) return false

    try {
      const nextEntries = await setDirectPlannerEntry.mutateAsync({
        weekStartsOn,
        date: entry.date,
        itemIds: outfitItems.map((item) => item.id),
        previewImage: readyPreview ?? undefined,
        recommendationStyle: entry.outfitStyle,
      })
      hydrateEntries(nextEntries)
      const savedEntry = nextEntries.find(
        (nextEntry) => nextEntry.date === entry.date,
      )
      if (!savedEntry?.outfitId) {
        throw new Error('저장된 코디 정보를 찾을 수 없습니다.')
      }
      pushToast('변경한 코디를 이 날짜에 저장했습니다.', 'success')
      return true
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '코디를 추가하지 못했습니다.',
        'error',
      )
      return false
    }
  }

  const copyToLookbook = async () => {
    if (!entry.outfitId) return false
    if (hasArchivedItems) return false

    try {
      await saveToLookbook.mutateAsync({
        outfitId: entry.outfitId,
      })
      setCopiedRecordKey(recordKey)
      pushToast('이 날짜의 코디를 코디북에 저장했습니다. 이후 변경은 각각 적용돼요.', 'success')
      return true
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '코디북에 저장하지 못했습니다.',
        'error',
      )
      return false
    }
  }

  const removeFromPlanner = async () => {
    if (clearPlannerEntry.isPending) return
    if (isWearProtected) {
      setIsRemoveConfirmOpen(false)
      return
    }

    try {
      if (entry.outfitId && /^[a-f\d]{24}$/i.test(entry.outfitId)) {
        await clearPlannerEntry.mutateAsync({
          weekStartsOn,
          date: entry.date,
        })
      }
      clearOutfit(entry.date)
      setGeneratedPreview(null)
      setIsLookbookOpen(false)
      pushToast(`${formattedDate} 코디를 플래너에서 뺐어요.`, 'success')
      navigate(backPath)
    } catch (error) {
      pushToast(
        error instanceof Error
          ? error.message
          : '플래너에서 코디를 빼지 못했습니다.',
        'error',
      )
    }
  }

  return createPortal(
    <section
      ref={detailDialogRef}
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={`${entryTitle} 상세`}
      inert={isOutfitPickerOpen || (isTomorrow && isTomorrowRecommendationOpen)}
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
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black tracking-[-0.03em]">
              {entryTitle}
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted">
              {formattedDate} · {entry.dayLabel}요일
              {entry.occasion ? ` · ${entry.occasion}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOutfitPickerOpen(true)}
            disabled={isWearProtected || plannerWeekQuery.isPending || plannerWeekQuery.isError || isCheckingRecentWear || setDirectPlannerEntry.isPending || saveToLookbook.isPending || clearPlannerEntry.isPending}
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-bold text-accent hover:border-accent disabled:opacity-50"
          >
            <Images size={15} aria-hidden="true" />
            코디북에서 고르기
          </button>
          {hasPlannerOutfit && (
            <button
              type="button"
              onClick={() => setIsRemoveConfirmOpen(true)}
              disabled={isWearProtected || clearPlannerEntry.isPending}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-sage hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="이 날짜에서 코디 빼기"
            >
              {clearPlannerEntry.isPending ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <Trash2 size={18} />
              )}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl shrink-0">
        {isTomorrow && (
          <div className="px-3 pt-2 sm:px-5">
            <PlanTomorrowForecast
              key={entry.date}
              date={entry.date}
              onOpenChange={setIsTomorrowRecommendationOpen}
              onApplied={resetPreviewAfterAssignment}
            />
          </div>
        )}
        <PlannerWearAction entry={entry} />
        {isWearProtected && <p className="px-4 py-2 text-xs leading-4 text-muted">코디를 수정하거나 빼려면 먼저 ‘착용 취소’를 눌러주세요.</p>}
        {hasArchivedItems && <p className="px-4 py-2 text-center text-[11px] text-muted">삭제한 옷도 이 날짜의 기록에는 남아 있어요.</p>}
      </div>

      <div className="min-h-0 flex-1 px-3 py-3 sm:px-6 sm:py-6">
        <div className="mx-auto h-full max-w-3xl">
          <OutfitSlotEditor
            key={`${entry.date}:${isWearProtected}`}
            items={activeItems}
            selectedItems={outfitItems}
            showArchivedStatus
            readOnly={isWearProtected}
            onChange={(nextItems) => {
              const nextItemIds = nextItems.map((item) => item.id)
              if (
                nextItemIds.length === entry.itemIds.length &&
                nextItemIds.every((itemId) => entry.itemIds.includes(itemId))
              ) {
                return
              }
              const hadSavedPreview = Boolean(entry.previewImageUrl)
              previewRequestVersionRef.current += 1
              setGeneratedPreview(null)
              setPreviewDialog((current) => ({ ...current, isOpen: false }))
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
          <div className="col-span-2"><PreviewCreditSummary /></div>
          <AiCreditActionButton
            requiresCredit={!hasCompletedImage && !isCompletedLookupError && !hasCurrentPendingPreview && !generatePreview.willResume}
            label={hasCurrentPendingPreview ? '생성 과정 보기' : hasCompletedImage ? 'AI 룩북 보기' : isCompletedLookupError ? '이미지 다시 불러오기' : generatePreview.isPending ? '만드는 중...' : 'AI 착장 이미지 만들기'}
            adLabel="광고 보고 AI 이미지 만들기"
            onClick={() => void openAiLookbook()}
            disabled={isPreviewActionDisabled}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPreviewActionLoading ? (
              <LoaderCircle className="animate-spin" size={16} />
            ) : hasCompletedImage ? (
              <Sparkles size={18} />
            ) : (
              <ImagePlus size={18} />
            )}
          </AiCreditActionButton>
          <button
            type="button"
            onClick={() => void saveDirectOutfit()}
            disabled={
              isEmpty ||
              hasArchivedItems ||
              Boolean(outfitCompletionMessage) ||
              isDateSaved ||
              isCheckingRecentWear ||
              setDirectPlannerEntry.isPending ||
              saveToLookbook.isPending
            }
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isCheckingRecentWear ||
            setDirectPlannerEntry.isPending ||
            saveToLookbook.isPending
              ? '저장 중...'
              : isDateSaved ? '이 날짜에 저장됨' : '변경사항 저장'}
          </button>
          {entry.outfitId && (
            <button
              type="button"
              onClick={() => void copyToLookbook()}
              disabled={hasArchivedItems || !isDateSaved || isCopiedToLookbook || saveToLookbook.isPending}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-2 text-xs font-bold disabled:opacity-40"
            >
              <BookHeart size={15} />
              {saveToLookbook.isPending ? '저장 중...' : isCopiedToLookbook ? '코디북에도 저장됨' : hasArchivedItems ? '삭제된 옷 교체 후 코디북에 추가' : hasUnsavedPreview ? '이 날짜에 저장한 뒤 코디북에 추가' : '코디북에 추가'}
            </button>
          )}
        </div>
      </footer>

      {isOutfitPickerOpen && (
        <PlannerOutfitPicker
          key={entry.date}
          dayEntry={entry}
          lockBodyScroll={false}
          onClose={() => setIsOutfitPickerOpen(false)}
          onAssigned={resetPreviewAfterAssignment}
        />
      )}

      {isRemoveConfirmOpen && (
        <ConfirmDialog
          title="이 날짜에서 코디를 뺄까요?"
          description={`코디북에 저장된 코디는 삭제되지 않고, ${formattedDate} 플래너에서만 빠져요.`}
          confirmLabel="플래너에서 빼기"
          pendingLabel="플래너에서 빼는 중..."
          isPending={clearPlannerEntry.isPending}
          onCancel={() => setIsRemoveConfirmOpen(false)}
          onConfirm={() => void removeFromPlanner()}
        />
      )}

      {isLookbookOpen && previewImageUrl && (
        <SavedOutfitPreviewDialog
          assetId={entry.previewImageAssetId}
          imageUrl={previewImageUrl}
          outfitName={entryTitle}
          isSaved
          onClose={() => setIsLookbookOpen(false)}
          onRegenerate={hasArchivedItems ? undefined : () => {
            setIsLookbookOpen(false)
            void openAiLookbook(true)
          }}
        />
      )}
      <OutfitPreviewDialogView
        selectedItems={previewItems}
        preview={previewDialog}
        creditSummary={<PreviewCreditSummary />}
        generatePreview={() => void openAiLookbook(true)}
        closePreview={() => setPreviewDialog((current) => ({ ...current, isOpen: false }))}
        onPrimary={() => {
          void saveDirectOutfit().then((saved) => {
            if (saved) setPreviewDialog((current) => ({ ...current, isOpen: false }))
          })
        }}
        primaryLabel="이 날짜에 저장"
        primaryAction="save"
        isPrimaryPending={isCheckingRecentWear || setDirectPlannerEntry.isPending || saveToLookbook.isPending}
      />
    </section>,
    document.body,
  )
}
