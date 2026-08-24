import { useMemo, useState } from 'react'
import type { OutfitPreview, Season, WardrobeItem } from '@closet/types'
import {
  ChevronLeft,
  ImagePlus,
  Pencil,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import {
  getOutfitStyleLabel,
  outfitStyleOptions,
} from '../../../constants/styleOptions'
import { formatSeasonLabels } from '../../../constants/seasons'
import { SeasonMultiSelect } from '../../../components/SeasonMultiSelect'
import { useUiStore } from '../../../stores/useUiStore'
import {
  useDeleteOutfitMutation,
  useGenerateOutfitPreviewMutation,
  useUpdateOutfitMutation,
} from '../api/lookbookQueries'
import type { OutfitPreviewState } from '../contexts/OutfitComposerContext'
import { useLookbookStore } from '../stores/useLookbookStore'
import type { SavedOutfit } from '../types'
import {
  findDuplicateOutfit,
  getOutfitCompletionMessage,
} from '../utils/outfitComposition'
import { OutfitSlotEditor } from './OutfitSlotEditor'
import { OutfitPreviewDialogView } from './OutfitPreviewDialog'
import { OutfitStyleSelector } from './OutfitStyleSelector'
import { SavedOutfitPreviewDialog } from './SavedOutfitPreviewDialog'

interface OutfitDetailModalProps {
  outfit: SavedOutfit
  items: WardrobeItem[]
  onClose: () => void
}

function getOutfitItems(outfit: SavedOutfit, items: WardrobeItem[]) {
  return outfit.layers
    .slice()
    .sort((left, right) => left.order - right.order)
    .flatMap((layer) => {
      const item = items.find(
        (candidate) => candidate.id === layer.wardrobeItemId,
      )
      return item ? [item] : []
    })
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

export function OutfitDetailModal({
  outfit,
  items,
  onClose,
}: OutfitDetailModalProps) {
  const outfits = useLookbookStore((state) => state.outfits)
  const addOutfit = useLookbookStore((state) => state.addOutfit)
  const removeOutfit = useLookbookStore((state) => state.removeOutfit)
  const pushToast = useUiStore((state) => state.pushToast)
  const updateOutfit = useUpdateOutfitMutation()
  const deleteOutfit = useDeleteOutfitMutation()
  const generateOutfitPreview = useGenerateOutfitPreviewMutation()
  const [draftItems, setDraftItems] = useState(() =>
    getOutfitItems(outfit, items),
  )
  const [draftName, setDraftName] = useState(outfit.name)
  const [draftStyle, setDraftStyle] = useState(outfit.style)
  const [draftSeasons, setDraftSeasons] = useState<Season[]>(outfit.seasons)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [draftPreview, setDraftPreview] = useState(createPreviewState)
  const outfitCompletionMessage = getOutfitCompletionMessage(draftItems)

  const styleOptions = useMemo(() => {
    const defaultValues = new Set<string>(
      outfitStyleOptions.map((option) => option.value),
    )
    const customStyles = [...new Set(outfits.map((saved) => saved.style))]
      .filter((style) => !defaultValues.has(style))
      .map((style) => ({ label: style, value: style }))
    return [...outfitStyleOptions, ...customStyles]
  }, [outfits])
  const originalItemIds = outfit.layers
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((layer) => layer.wardrobeItemId)
  const draftItemIds = draftItems.map((item) => item.id)
  const duplicateOutfit = findDuplicateOutfit(
    outfits,
    draftItemIds,
    outfit.id,
  )
  const itemsChanged =
    originalItemIds.length !== draftItemIds.length ||
    originalItemIds.some((itemId, index) => itemId !== draftItemIds[index])
  const infoChanged =
    draftName.trim() !== outfit.name ||
    draftStyle !== outfit.style ||
    draftSeasons.length !== outfit.seasons.length ||
    draftSeasons.some((season) => !outfit.seasons.includes(season))
  const isDirty = itemsChanged || infoChanged

  const saveChanges = async (previewImage?: OutfitPreview) => {
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return
    }
    if (duplicateOutfit) {
      pushToast(
        `같은 옷 조합이 이미 '${duplicateOutfit.name}' 코디로 저장되어 있어요.`,
        'error',
      )
      return
    }

    try {
      const updated = await updateOutfit.mutateAsync({
        id: outfit.id,
        name: draftName,
        style: draftStyle,
        seasons: draftSeasons,
        items: draftItems.map((item, order) => ({
          wardrobeItemId: item.id,
          layerOrder: order,
        })),
        previewImage,
      })
      addOutfit(updated)
      setDraftItems(getOutfitItems(updated, items))
      setDraftName(updated.name)
      setDraftStyle(updated.style)
      setDraftSeasons(updated.seasons)
      pushToast(
        previewImage
          ? '코디 수정 내용과 새 AI 룩북을 저장했습니다.'
          : itemsChanged && outfit.previewImageUrl
          ? '코디를 수정하고 기존 AI 룩북 연결을 해제했습니다.'
          : '코디 정보를 수정했습니다.',
        'success',
      )
      return updated
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '코디를 수정하지 못했습니다.',
        'error',
      )
      return null
    }
  }

  const createDraftPreview = () => {
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return
    }
    if (duplicateOutfit) {
      pushToast(
        `같은 옷 조합이 이미 '${duplicateOutfit.name}' 코디로 저장되어 있어요.`,
        'error',
      )
      return
    }
    setDraftPreview({
      isOpen: true,
      status: 'loading',
      imageUrl: null,
      imageBase64: null,
      mimeType: null,
      model: null,
      errorMessage: null,
    })
    if (generateOutfitPreview.isPending) return

    void generateOutfitPreview
      .mutateAsync(draftItemIds)
      .then((result) => {
        setDraftPreview({
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
        setDraftPreview({
          isOpen: true,
          status: 'error',
          imageUrl: null,
          imageBase64: null,
          mimeType: null,
          model: null,
          errorMessage:
            error instanceof Error
              ? error.message
              : 'AI 룩 이미지를 만들지 못했습니다.',
        })
      })
  }

  const saveDraftPreview = async () => {
    if (
      !draftPreview.imageBase64 ||
      !draftPreview.mimeType ||
      !draftPreview.model
    ) {
      return
    }
    const updated = await saveChanges({
      imageBase64: draftPreview.imageBase64,
      mimeType: draftPreview.mimeType,
      model: draftPreview.model,
    })
    if (updated) {
      setDraftPreview(createPreviewState())
    }
  }

  return (
    <section
      className="classification-page-enter fixed inset-0 z-[90] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={`${outfit.name} 코디 상세`}
    >
      <header className="shrink-0 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-2 px-3 py-2 sm:min-h-18 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-surface"
            aria-label="코디북으로 돌아가기"
            autoFocus
          >
            <ChevronLeft size={25} strokeWidth={2.2} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black tracking-[-0.03em]">
              {draftName}
            </h1>
            <p className="mt-0.5 truncate text-xs text-muted">
              {draftSeasons.length > 0
                ? `${formatSeasonLabels(draftSeasons)} · `
                : ''}
              {getOutfitStyleLabel(draftStyle)} · 옷 {draftItems.length}개
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsInfoOpen(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface hover:text-ink"
            aria-label="코디 이름과 스타일 수정"
            title="코디 이름과 스타일 수정"
          >
            <Pencil size={17} />
          </button>
          <button
            type="button"
            onClick={() => setIsDeleteConfirmOpen(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-[#fff0ec] hover:text-accent"
            aria-label="코디북에서 삭제"
            title="코디북에서 삭제"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 px-3 py-3 sm:px-6 sm:py-6">
        <div className="relative mx-auto h-full max-w-3xl">
          <OutfitSlotEditor
            items={items}
            selectedItems={draftItems}
            onChange={setDraftItems}
            className="h-full w-full"
          />
          {itemsChanged && outfit.previewImageUrl && (
            <p className="absolute top-3 right-3 left-3 z-20 rounded-xl bg-ink/88 px-3 py-2 text-center text-[11px] font-bold text-white backdrop-blur">
              구성이 바뀌어 저장하면 기존 AI 룩북이 해제돼요.
            </p>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)]">
        <div className="mx-auto grid max-w-3xl grid-cols-[0.85fr_1.15fr] gap-2">
          <button
            type="button"
            onClick={() => {
              if (outfit.previewImageUrl && !itemsChanged) {
                setIsPreviewOpen(true)
                return
              }
              createDraftPreview()
            }}
            disabled={
              !(outfit.previewImageUrl && !itemsChanged) &&
              (Boolean(outfitCompletionMessage) || Boolean(duplicateOutfit))
            }
            title={
              duplicateOutfit
                ? `'${duplicateOutfit.name}' 코디와 같은 옷 조합이에요.`
                : outfitCompletionMessage ?? undefined
            }
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {outfit.previewImageUrl && !itemsChanged ? (
              <Sparkles size={15} />
            ) : (
              <ImagePlus size={15} />
            )}
            {outfit.previewImageUrl && !itemsChanged
              ? 'AI 룩북 보기'
              : outfit.previewImageUrl
                ? '새 AI 룩 만들기'
                : 'AI 룩 만들기'}
          </button>
          <button
            type="button"
            onClick={() => void saveChanges()}
            disabled={
              !isDirty ||
              updateOutfit.isPending ||
              Boolean(outfitCompletionMessage) ||
              Boolean(duplicateOutfit)
            }
            title={
              duplicateOutfit
                ? `'${duplicateOutfit.name}' 코디와 같은 옷 조합이에요.`
                : outfitCompletionMessage ?? undefined
            }
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={16} />
            {updateOutfit.isPending
              ? '저장 중...'
              : '변경사항 저장'}
          </button>
        </div>
      </footer>

      {isInfoOpen && (
        <div
          className="classification-page-enter fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="outfit-info-edit-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsInfoOpen(false)
          }}
        >
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-[1.75rem] bg-surface shadow-2xl">
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 id="outfit-info-edit-title" className="text-base font-black">
                  코디 정보 수정
                </h2>
                <p className="mt-0.5 text-[11px] text-muted">
                  이름과 스타일, 입을 계절을 바꿀 수 있어요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-canvas"
                aria-label="코디 정보 수정 닫기"
              >
                <X size={18} />
              </button>
            </header>
            <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <label className="grid gap-2 text-xs font-black">
                코디 이름
                <input
                  type="text"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  maxLength={40}
                  className="h-12 rounded-xl border border-line bg-canvas px-3 text-sm font-bold outline-none focus:border-accent"
                />
              </label>
              <fieldset className="mt-5">
                <legend className="mb-2 text-xs font-black">스타일 카테고리</legend>
                <OutfitStyleSelector
                  value={draftStyle}
                  options={styleOptions}
                  onChange={setDraftStyle}
                />
              </fieldset>
              <fieldset className="mt-5">
                <legend className="text-xs font-black">입을 계절</legend>
                <p className="mt-1 text-[11px] text-muted">
                  여러 계절을 함께 선택할 수 있어요.
                </p>
                <div className="mt-2">
                  <SeasonMultiSelect
                    value={draftSeasons}
                    onChange={setDraftSeasons}
                  />
                </div>
              </fieldset>
            </div>
            <footer className="border-t border-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                disabled={
                  !draftName.trim() ||
                  !draftStyle ||
                  draftSeasons.length === 0
                }
                className="w-full rounded-xl bg-ink px-3 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                적용
              </button>
            </footer>
          </div>
        </div>
      )}

      {isPreviewOpen && outfit.previewImageUrl && (
        <SavedOutfitPreviewDialog
          imageUrl={outfit.previewImageUrl}
          outfitName={outfit.name}
          onClose={() => setIsPreviewOpen(false)}
          onRegenerate={() => {
            setIsPreviewOpen(false)
            createDraftPreview()
          }}
        />
      )}
      <OutfitPreviewDialogView
        selectedItems={draftItems}
        preview={draftPreview}
        generatePreview={createDraftPreview}
        closePreview={() =>
          setDraftPreview((current) => ({ ...current, isOpen: false }))
        }
        onPrimary={() => void saveDraftPreview()}
        primaryLabel={
          itemsChanged ? '수정한 코디에 저장' : '새 룩북으로 저장'
        }
        isPrimaryPending={updateOutfit.isPending}
      />
      {isDeleteConfirmOpen && (
        <ConfirmDialog
          title="코디북에서 삭제할까요?"
          description={`${outfit.name} 코디가 코디북에서 사라지고, 이 코디를 등록한 플래너 일정도 비워져요.`}
          confirmLabel="코디 삭제"
          isPending={deleteOutfit.isPending}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={() => {
            void deleteOutfit
              .mutateAsync(outfit.id)
              .then(() => {
                removeOutfit(outfit.id)
                pushToast('코디북에서 삭제했습니다.', 'success')
                onClose()
              })
              .catch((error: unknown) => {
                pushToast(
                  error instanceof Error
                    ? error.message
                    : '코디를 삭제하지 못했습니다.',
                  'error',
                )
              })
          }}
        />
      )}
    </section>
  )
}
