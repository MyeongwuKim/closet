import { useEffect, useMemo, useState } from 'react'
import type { OutfitPreview, WardrobeItem } from '@closet/types'
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
import { useGenerateOutfitPreviewMutation } from '../../lookbook/api/lookbookQueries'
import type { OutfitPreviewState } from '../../lookbook/contexts/OutfitComposerContext'
import { getOutfitCompletionMessage } from '../../lookbook/utils/outfitComposition'

interface TodayOutfitRecommendationDialogProps {
  date: string
  items: WardrobeItem[]
  initialItems: WardrobeItem[]
  style: OutfitStyle
  hasTodayOutfit: boolean
  isSaving: boolean
  onClose: () => void
  onApply: (
    items: WardrobeItem[],
    previewImage?: OutfitPreview,
  ) => Promise<boolean>
}

function createPreviewState(): OutfitPreviewState {
  return {
    isOpen: false,
    status: 'idle',
    imageUrl: null,
    imageBase64: null,
    mimeType: null,
    model: null,
    errorMessage: null,
  }
}

export function TodayOutfitRecommendationDialog({
  date,
  items,
  initialItems,
  style,
  hasTodayOutfit,
  isSaving,
  onClose,
  onApply,
}: TodayOutfitRecommendationDialogProps) {
  const [selectedItems, setSelectedItems] = useState(initialItems)
  const [preview, setPreview] = useState(createPreviewState)
  const generateOutfitPreview = useGenerateOutfitPreviewMutation()
  const availableItems = useMemo(() => {
    const itemById = new Map(items.map((item) => [item.id, item]))
    initialItems.forEach((item) => itemById.set(item.id, item))
    return [...itemById.values()]
  }, [initialItems, items])
  const completionMessage = getOutfitCompletionMessage(selectedItems)
  const dateValue = new Date(`${date}T00:00:00`)
  const formattedDate = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(dateValue)
  const generatedPreview: OutfitPreview | undefined =
    preview.status === 'success' &&
    preview.imageBase64 &&
    preview.mimeType &&
    preview.model
      ? {
          imageBase64: preview.imageBase64,
          mimeType: preview.mimeType,
          model: preview.model,
        }
      : undefined

  const generatePreview = () => {
    if (completionMessage || generateOutfitPreview.isPending) return

    setPreview({
      isOpen: true,
      status: 'loading',
      imageUrl: null,
      imageBase64: null,
      mimeType: null,
      model: null,
      errorMessage: null,
    })

    void generateOutfitPreview
      .mutateAsync({
        selectedItemIds: selectedItems.map((item) => item.id),
        style,
      })
      .then((result) => {
        setPreview({
          isOpen: true,
          status: 'success',
          imageUrl: `data:${result.mimeType};base64,${result.imageBase64}`,
          imageBase64: result.imageBase64,
          mimeType: result.mimeType,
          model: result.model,
          errorMessage: null,
        })
      })
      .catch((error: unknown) => {
        setPreview({
          isOpen: true,
          status: 'error',
          imageUrl: null,
          imageBase64: null,
          mimeType: null,
          model: null,
          errorMessage:
            error instanceof Error
              ? error.message
              : 'AI 룩북을 만들지 못했어요.',
        })
      })
  }

  const openOrGeneratePreview = () => {
    if (preview.status === 'success' && preview.imageUrl) {
      setPreview((current) => ({ ...current, isOpen: true }))
      return
    }
    generatePreview()
  }

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

  return createPortal(
    <section
      className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label="오늘의 추천 코디 상세"
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface"
            aria-label="추천 코디로 돌아가기"
            autoFocus
          >
            <ChevronLeft size={25} strokeWidth={2.2} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 truncate text-lg font-black tracking-[-0.03em]">
              <Sparkles className="shrink-0 text-accent" size={18} />
              오늘의 추천 코디
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted">
              {formattedDate} · 아이템을 누르면 바꿀 수 있어요.
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 px-3 py-3 sm:px-6 sm:py-6">
        <div className="mx-auto h-full max-w-3xl">
          <OutfitSlotEditor
            items={availableItems}
            selectedItems={selectedItems}
            onChange={(nextItems) => {
              setSelectedItems(nextItems)
              setPreview(createPreviewState())
            }}
            className="h-full w-full"
          />
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)]">
        <div className="mx-auto max-w-3xl">
          {completionMessage && (
            <p className="mb-2 text-center text-xs font-bold text-muted">
              {completionMessage}
            </p>
          )}
          <div className="grid grid-cols-[0.85fr_1.15fr] gap-2">
            <button
              type="button"
              onClick={openOrGeneratePreview}
              disabled={Boolean(completionMessage)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {preview.status === 'success' && preview.imageUrl ? (
                <Sparkles size={16} />
              ) : (
                <ImagePlus size={16} />
              )}
              {preview.status === 'success' && preview.imageUrl
                ? 'AI 룩북 보기'
                : 'AI 룩북 만들기'}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (completionMessage) return
                const didApply = await onApply(selectedItems, generatedPreview)
                if (didApply) onClose()
              }}
              disabled={Boolean(completionMessage) || isSaving}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-3.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
            >
              {isSaving ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <CalendarPlus size={18} />
              )}
              {isSaving
                ? '일정에 담는 중...'
                : hasTodayOutfit
                  ? '오늘 코디 바꾸기'
                  : '오늘 일정에 추가'}
            </button>
          </div>
        </div>
      </footer>

      <OutfitPreviewDialogView
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
            onClose()
          })
        }}
        primaryLabel={hasTodayOutfit ? '오늘 코디 바꾸기' : '오늘 일정에 추가'}
        isPrimaryPending={isSaving}
      />
    </section>,
    document.body,
  )
}
