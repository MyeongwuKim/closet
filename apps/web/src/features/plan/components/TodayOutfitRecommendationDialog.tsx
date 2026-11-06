import { AiCreditActionButton } from '../../lookbook/components/AiCreditActionButton'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { OutfitPreview, Season, WardrobeItem } from '@closet/types'
import type { OutfitStyle } from '../../../constants/styleOptions'
import {
  CalendarPlus,
  ChevronLeft,
  ImagePlus,
  LoaderCircle,
  Sparkles,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { OutfitSlotEditor } from '../../lookbook/components/OutfitSlotEditor'
import { OutfitPreviewDialogView } from '../../lookbook/components/OutfitPreviewDialog'
import { PreviewCreditSummary } from '../../lookbook/components/PreviewCreditSummary'
import { useGenerateOutfitPreviewMutation } from '../../lookbook/api/lookbookQueries'
import type { OutfitPreviewState } from '../../lookbook/contexts/OutfitComposerContext'
import { getOutfitCompletionMessage } from '../../lookbook/utils/outfitComposition'
import { useUiStore } from '../../../stores/useUiStore'
import { RecommendationLookbookSave } from './today-outfit-recommendation/RecommendationLookbookSave'
import {
  cacheRecommendationPreview,
  getRecommendationPreviewKey,
  readRecommendationPreview,
} from '../utils/recommendationPreviewCache'
import { recommendationDayLabels, type RecommendationMode } from './today-outfit-recommendation/recommendationFlow'

interface TodayOutfitRecommendationDialogProps {
  viewerId: string
  date: string
  title?: string
  backLabel?: string
  items: WardrobeItem[]
  initialItems: WardrobeItem[]
  style: OutfitStyle | null
  season: Season
  hasScheduledOutfit: boolean
  mode?: RecommendationMode
  isSaving: boolean
  onClose: () => void
  onApplied?: () => void
  onOpenLookbook?: () => void
  onApply: (
    items: WardrobeItem[],
    previewImage?: OutfitPreview,
  ) => Promise<boolean>
}

function createPreviewState(
  cachedPreview?: OutfitPreview,
): OutfitPreviewState {
  if (cachedPreview) {
    return {
      isOpen: false,
      status: 'success',
      imageUrl: cachedPreview.imageUrl ?? `data:${cachedPreview.mimeType};base64,${cachedPreview.imageBase64}`,
      imageBase64: cachedPreview.imageBase64,
      assetId: cachedPreview.assetId ?? null,
      compositionKey: null,
      mimeType: cachedPreview.mimeType,
      model: cachedPreview.model,
      errorMessage: null,
    }
  }

  return {
    isOpen: false,
    status: 'idle',
    imageUrl: null,
    imageBase64: null,
    assetId: null,
    compositionKey: null,
    mimeType: null,
    model: null,
    errorMessage: null,
  }
}

/** AI 추천 조합을 전체화면으로 편집한다. 옷 교체, 착장 이미지 생성, 대상 날짜에 적용, 코디북 저장을 제공한다. */
export function TodayOutfitRecommendationDialog({
  viewerId,
  date,
  title,
  backLabel = '추천 코디로 돌아가기',
  items,
  initialItems,
  style,
  season,
  hasScheduledOutfit,
  mode = 'today',
  isSaving,
  onClose,
  onApplied,
  onApply,
  onOpenLookbook,
}: TodayOutfitRecommendationDialogProps) {
  const dayLabel = recommendationDayLabels[mode]
  const dialogTitle = title ?? `${dayLabel}의 추천 코디`
  const applyLabel = hasScheduledOutfit
    ? `${dayLabel} 코디 바꾸기`
    : mode === 'tomorrow' ? '내일 일정에 담기' : '오늘 일정에 추가'
  const detailDialogRef = useRef<HTMLElement>(null)
  const [selectedItems, setSelectedItems] = useState(initialItems)
  const initialPreviewKey = getRecommendationPreviewKey(
    viewerId,
    style,
    initialItems.map((item) => item.id),
  )
  const [preview, setPreview] = useState(() =>
    createPreviewState(readRecommendationPreview(initialPreviewKey)),
  )
  const completionMessage = getOutfitCompletionMessage(selectedItems)
  const generateOutfitPreview = useGenerateOutfitPreviewMutation(completionMessage ? undefined : { selectedItemIds: selectedItems.map((item) => item.id), style: style ?? undefined })
  const availableItems = useMemo(() => {
    const itemById = new Map(items.map((item) => [item.id, item]))
    initialItems.forEach((item) => itemById.set(item.id, item))
    return [...itemById.values()]
  }, [initialItems, items])
  const previewKey = getRecommendationPreviewKey(
    viewerId,
    style,
    selectedItems.map((item) => item.id),
  )
  const previewKeyRef = useRef(previewKey)
  const dateValue = new Date(`${date}T00:00:00`)
  const formattedDate = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(dateValue)
  const generatedPreview: OutfitPreview | undefined = generateOutfitPreview.completedPreview ?? (
    preview.status === 'success' &&
    (preview.assetId || preview.imageBase64) &&
    preview.mimeType &&
    preview.model
      ? {
          imageBase64: preview.imageBase64 ?? '',
          ...(preview.assetId ? { assetId: preview.assetId } : {}),
          ...(preview.imageUrl ? { imageUrl: preview.imageUrl } : {}),
          mimeType: preview.mimeType,
          model: preview.model,
        }
      : undefined)
  const handleApplied = onApplied ?? onClose

  useEffect(() => {
    previewKeyRef.current = previewKey
  }, [previewKey])

  const hasRestorablePreview = Boolean(generateOutfitPreview.completedPreview || generateOutfitPreview.hasCompletedPreview || generateOutfitPreview.isCompletedLookupError)
  const generatePreview = (forceNew = false) => {
    const restoreCompleted = !forceNew && hasRestorablePreview
    if (completionMessage || (!restoreCompleted && (generateOutfitPreview.isPending || generateOutfitPreview.isRestoringCompleted))) return

    const requestedPreviewKey = previewKey

    setPreview({
      isOpen: true,
      status: 'loading',
      imageUrl: null,
      imageBase64: null,
      assetId: null,
      compositionKey: null,
      mimeType: null,
      model: null,
      errorMessage: null,
    })

    void (restoreCompleted
      ? generateOutfitPreview.completedPreview ? Promise.resolve(generateOutfitPreview.completedPreview) : generateOutfitPreview.restoreCompletedAsync()
      : generateOutfitPreview.mutateAsync({
        selectedItemIds: selectedItems.map((item) => item.id),
        ...(style ? { style } : {}),
      }))
      .then((result) => {
        cacheRecommendationPreview(requestedPreviewKey, result)
        if (previewKeyRef.current !== requestedPreviewKey) return

        setPreview((current) => ({
          // 창을 닫은 뒤 완료되어도 코디북 저장 화면 위에 다시 열지 않는다.
          isOpen: current.isOpen,
          status: 'success',
          imageUrl: result.imageUrl ?? `data:${result.mimeType};base64,${result.imageBase64}`,
          imageBase64: result.imageBase64,
          assetId: result.assetId ?? null,
          compositionKey: null,
          mimeType: result.mimeType,
          model: result.model,
          errorMessage: null,
        }))
      })
      .catch((error: unknown) => {
        if (previewKeyRef.current !== requestedPreviewKey) return

        setPreview((current) => ({
          isOpen: current.isOpen,
          status: 'error',
          imageUrl: null,
          imageBase64: null,
          assetId: null,
          compositionKey: null,
          mimeType: null,
          model: null,
          errorMessage:
            error instanceof Error
              ? error.message
              : 'AI 룩북을 만들지 못했어요.',
        }))
      })
  }

  const openOrGeneratePreview = () => {
    if (hasRestorablePreview) {
      generatePreview()
      return
    }
    if (preview.status === 'success' && preview.imageUrl) {
      setPreview((current) => ({ ...current, isOpen: true }))
      return
    }

    const cachedPreview = readRecommendationPreview(previewKey)
    if (cachedPreview) {
      setPreview({
        ...createPreviewState(cachedPreview),
        isOpen: true,
      })
      return
    }

    generatePreview()
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !useUiStore.getState().recentWearConfirmation
      ) {
        const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
        // 포털로 열린 저장 화면과 옷 선택창은 자체적으로 Escape를 처리한다.
        if (detailDialogRef.current?.contains(dialogs.item(dialogs.length - 1))) onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div
      className={`fixed inset-0 bg-canvas ${mode === 'tomorrow' ? 'z-[90]' : 'z-[80]'}`}
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={detailDialogRef}
        className="classification-page-enter flex h-dvh w-full flex-col overflow-hidden bg-canvas"
        role="dialog"
        aria-modal="true"
        aria-label={`${dayLabel}의 추천 코디 상세`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-line bg-canvas pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface"
              aria-label={backLabel}
              autoFocus
            >
              <ChevronLeft size={25} strokeWidth={2.2} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="flex min-w-0 items-center gap-1.5 text-base font-black tracking-[-0.03em]">
                <Sparkles className="shrink-0 text-accent" size={18} />
                <span className="min-w-0 flex-1 truncate" title={dialogTitle}>
                  {dialogTitle}
                </span>
              </h1>
              <p className="mt-0.5 truncate text-xs text-muted">
                {formattedDate} · 아이템을 누르면 바꿀 수 있어요.
              </p>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 px-3 py-3">
          <div className="mx-auto h-full max-w-3xl">
            <OutfitSlotEditor
              items={availableItems}
              selectedItems={selectedItems}
              onChange={(nextItems) => {
                setSelectedItems(nextItems)
                const nextPreviewKey = getRecommendationPreviewKey(
                  viewerId,
                  style,
                  nextItems.map((item) => item.id),
                )
                previewKeyRef.current = nextPreviewKey
                setPreview(
                  createPreviewState(
                    readRecommendationPreview(nextPreviewKey),
                  ),
                )
              }}
              className="h-full w-full"
            />
          </div>
        </div>

        <footer className="shrink-0 border-t border-line bg-canvas px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-3xl">
            <div className="mb-2"><PreviewCreditSummary /></div>
            {completionMessage && (
              <p className="mb-2 text-center text-xs font-bold text-muted">
                {completionMessage}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <AiCreditActionButton
                requiresCredit={!hasRestorablePreview && !(preview.status === 'success' && preview.imageUrl) && !generateOutfitPreview.willResume}
                label={hasRestorablePreview || (preview.status === 'success' && preview.imageUrl) ? 'AI 룩북 보기' : 'AI 착장 이미지 만들기'}
                adLabel="광고 보고 AI 이미지 만들기"
                onClick={openOrGeneratePreview}
                disabled={Boolean(completionMessage) || (!hasRestorablePreview && !(preview.status === 'success' && preview.imageUrl) && (generateOutfitPreview.isPending || generateOutfitPreview.isRestoringCompleted))}
                className="flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {preview.status === 'success' && preview.imageUrl ? (
                  <Sparkles size={16} />
                ) : (
                  <ImagePlus size={16} />
                )}
              </AiCreditActionButton>
              <button
                type="button"
                onClick={async () => {
                  if (completionMessage) return
                  const didApply = await onApply(selectedItems, generatedPreview)
                  if (didApply) handleApplied()
                }}
                disabled={Boolean(completionMessage) || isSaving}
                className="flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
              >
                {isSaving ? (
                  <LoaderCircle className="shrink-0 animate-spin" size={18} />
                ) : (
                  <CalendarPlus className="shrink-0" size={18} />
                )}
                <span className="min-w-0 break-keep text-balance">{isSaving
                  ? '일정에 담는 중...'
                  : applyLabel}</span>
              </button>
              <RecommendationLookbookSave
                date={date}
                name={dialogTitle}
                season={season}
                style={style}
                items={selectedItems}
                preview={generatedPreview}
                disabled={isSaving}
                onOpenLookbook={onOpenLookbook}
              />
            </div>
          </div>
        </footer>

        <OutfitPreviewDialogView
          creditSummary={<PreviewCreditSummary />}
          selectedItems={selectedItems}
          preview={preview}
          generatePreview={generatePreview}
          closePreview={() =>
            setPreview((current) => ({ ...current, isOpen: false }))
          }
          onPrimary={() => {
            void onApply(selectedItems, generatedPreview).then((didApply) => {
              if (!didApply) return
              setPreview((current) => ({ ...current, isOpen: false }))
              handleApplied()
            })
          }}
          primaryLabel={applyLabel}
          isPrimaryPending={isSaving}
        />
      </section>
    </div>,
    document.body,
  )
}
