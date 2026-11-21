import { AiCreditActionButton } from './AiCreditActionButton'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OutfitPreview, Season, WardrobeItem } from '@closet/types'
import {
  ImagePlus,
  Pencil,
  Save,
  Sparkles,
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
import { OutfitReadView } from './OutfitReadView'
import { OutfitDetailHeader } from './OutfitDetailHeader'
import { OutfitPreviewDialogView } from './OutfitPreviewDialog'
import { PreviewCreditSummary } from './PreviewCreditSummary'
import { OutfitStyleSelector } from './OutfitStyleSelector'
import { SavedOutfitPreviewDialog } from './SavedOutfitPreviewDialog'
import { useWardrobeItemsQuery } from '../../closet/api/wardrobeQueries'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { formatDateOnly } from '../../plan/data/weeklyPlan'
import { useRecentWearReminder } from '../../plan/hooks/useRecentWearReminder'
import type { OutfitWearSummary } from '../utils/outfitWearSummary'
import { getOutfitPreviewCompositionKey } from '../utils/outfitPreviewCache'
import { getSavedOutfitItems } from '../utils/savedOutfitItems'

interface OutfitDetailModalProps {
  outfit: SavedOutfit
  items: WardrobeItem[]
  onClose: () => void
  backLabel?: string
  wearSummary?: OutfitWearSummary
}

function createPreviewState(): OutfitPreviewState {
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

/** 저장된 코디는 보기로 열고, 수정 모드의 초안만 저장한다. 취소하면 저장된 구성·정보를 복원하며 삭제된 옷의 기록과 AI 생성 제한은 유지한다. */
export function OutfitDetailModal({
  outfit,
  items,
  onClose,
  backLabel = '코디북으로 돌아가기',
  wearSummary,
}: OutfitDetailModalProps) {
  const catalog = useWardrobeItemsQuery()
  useEffect(() => {
    if (catalog.data) useClosetStore.getState().mergeItems(catalog.data)
  }, [catalog.data])
  const outfits = useLookbookStore((state) => state.outfits)
  const addOutfit = useLookbookStore((state) => state.addOutfit)
  const removeOutfit = useLookbookStore((state) => state.removeOutfit)
  const pushToast = useUiStore((state) => state.pushToast)
  const updateOutfit = useUpdateOutfitMutation()
  const { confirmRecentWear, isCheckingRecentWear } =
    useRecentWearReminder()
  const deleteOutfit = useDeleteOutfitMutation()
  const [draftItems, setDraftItems] = useState(() =>
    getSavedOutfitItems(outfit, items),
  )
  const [draftName, setDraftName] = useState(outfit.name)
  const [draftStyle, setDraftStyle] = useState(outfit.style)
  const [draftSeasons, setDraftSeasons] = useState<Season[]>(outfit.seasons)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [draftPreview, setDraftPreview] = useState(createPreviewState)
  const outfitCompletionMessage = getOutfitCompletionMessage(draftItems)
  const activeItems = items.filter((item) => !item.archivedAt)
  const hasArchivedItems = draftItems.some((item) => item.archivedAt)
  const archivedItemMessage = hasArchivedItems ? '새로 저장하거나 생성하려면 삭제된 옷을 교체해주세요.' : undefined

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
  const generateOutfitPreview = useGenerateOutfitPreviewMutation(outfitCompletionMessage ? undefined : { selectedItemIds: draftItemIds, style: draftStyle })
  const currentPreviewKey = getOutfitPreviewCompositionKey(draftItemIds, draftStyle)
  const previewKeyRef = useRef<string | null>(currentPreviewKey)
  useEffect(() => {
    previewKeyRef.current = currentPreviewKey
    return () => { if (previewKeyRef.current === currentPreviewKey) previewKeyRef.current = null }
  }, [currentPreviewKey])
  const hasRestorablePreview = Boolean(generateOutfitPreview.completedPreview || generateOutfitPreview.hasCompletedPreview || generateOutfitPreview.isCompletedLookupError)
  const hasCurrentDraftPreview = draftPreview.status === 'success' && draftPreview.compositionKey === currentPreviewKey && Boolean(draftPreview.imageUrl)
  const duplicateOutfit = findDuplicateOutfit(
    outfits,
    draftItemIds,
    outfit.id,
  )
  const itemsChanged =
    originalItemIds.length !== draftItemIds.length ||
    originalItemIds.some((itemId, index) => itemId !== draftItemIds[index])
  const isPreviewInProgress = draftPreview.status === 'loading' && draftPreview.compositionKey === currentPreviewKey
  const hasViewablePreview = hasRestorablePreview || hasCurrentDraftPreview || Boolean(outfit.previewImageUrl && !itemsChanged)
  const requiresPreviewCredit = !isPreviewInProgress && !hasViewablePreview && !generateOutfitPreview.willResume
  const originalItemIdSet = new Set(originalItemIds)
  const itemSetChanged =
    originalItemIds.length !== draftItemIds.length ||
    draftItemIds.some((itemId) => !originalItemIdSet.has(itemId))
  const infoChanged =
    draftName.trim() !== outfit.name ||
    draftStyle !== outfit.style ||
    draftSeasons.length !== outfit.seasons.length ||
    draftSeasons.some((season) => !outfit.seasons.includes(season))
  const isDirty = itemsChanged || infoChanged
  const isSaving = isCheckingRecentWear || updateOutfit.isPending

  /** 서버에 저장하지 않은 구성·정보·미리보기를 버리고 보기로 돌아간다. */
  const cancelEdit = () => {
    if (isSaving) return
    setDraftItems(getSavedOutfitItems(outfit, items))
    setDraftName(outfit.name)
    setDraftStyle(outfit.style)
    setDraftSeasons(outfit.seasons)
    setDraftPreview(createPreviewState())
    setIsInfoOpen(false)
    setIsEditing(false)
  }

  const saveChanges = async (previewImage?: OutfitPreview) => {
    if (archivedItemMessage) {
      pushToast(archivedItemMessage, 'error')
      return
    }
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

    if (itemSetChanged) {
      const confirmed = await confirmRecentWear({
        itemIds: draftItems.map((item) => item.id),
        targetDate: formatDateOnly(new Date()),
        includeTargetDate: true,
        confirmLabel: '그래도 저장',
        cancelLabel: '계속 편집',
      })
      if (!confirmed) return
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
      setDraftItems(getSavedOutfitItems(updated, items))
      setDraftName(updated.name)
      setDraftStyle(updated.style)
      setDraftSeasons(updated.seasons)
      pushToast(
        previewImage
          ? '코디 수정 내용과 새 AI 룩북을 저장했어요.'
          : itemsChanged && outfit.previewImageUrl
          ? '코디를 수정하고 기존 AI 룩북 연결을 해제했어요.'
          : '코디 정보를 수정했어요.',
        'success',
      )
      return updated
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '코디를 수정하지 못했어요.',
        'error',
      )
      return null
    }
  }

  const createDraftPreview = (forceNew = false) => {
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return
    }
    const restoreCompleted = !forceNew && hasRestorablePreview
    if (archivedItemMessage && !restoreCompleted && !generateOutfitPreview.willResume) {
      pushToast(archivedItemMessage, 'error')
      return
    }
    if (!restoreCompleted && duplicateOutfit) {
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
      assetId: null,
      compositionKey: currentPreviewKey,
      mimeType: null,
      model: null,
      errorMessage: null,
    })
    if (!restoreCompleted && (generateOutfitPreview.isPending || generateOutfitPreview.isRestoringCompleted)) return
    const requestedPreviewKey = currentPreviewKey

    void (restoreCompleted
      ? generateOutfitPreview.completedPreview ? Promise.resolve(generateOutfitPreview.completedPreview) : generateOutfitPreview.restoreCompletedAsync()
      : generateOutfitPreview.mutateAsync({ selectedItemIds: draftItemIds, style: draftStyle }))
      .then((result) => {
        if (previewKeyRef.current !== requestedPreviewKey) return
        setDraftPreview((current) => ({
          ...current,
          status: 'success',
          imageUrl: result.imageUrl ?? `data:${result.mimeType};base64,${result.imageBase64}`,
          imageBase64: result.imageBase64,
          assetId: result.assetId ?? null,
          compositionKey: requestedPreviewKey,
          mimeType: result.mimeType,
          model: result.model,
          errorMessage: null,
        }))
      })
      .catch((error: unknown) => {
        if (previewKeyRef.current !== requestedPreviewKey) return
        setDraftPreview((current) => ({
          ...current,
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

  const saveDraftPreview = async () => {
    if (
      (!draftPreview.assetId && !draftPreview.imageBase64) ||
      !draftPreview.mimeType ||
      !draftPreview.model
    ) {
      return
    }
    const updated = await saveChanges({
      imageBase64: draftPreview.imageBase64 ?? '',
      ...(draftPreview.assetId ? { assetId: draftPreview.assetId } : {}),
      ...(draftPreview.imageUrl ? { imageUrl: draftPreview.imageUrl } : {}),
      mimeType: draftPreview.mimeType,
      model: draftPreview.model,
    })
    if (updated) {
      setDraftPreview(createPreviewState())
    }
  }

  return createPortal(
    <section
      className="classification-page-enter fixed inset-0 z-[90] flex h-dvh flex-col overflow-hidden bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label={`${outfit.name} 코디 상세`}
    >
      <OutfitDetailHeader name={draftName} description={`${draftSeasons.length ? `${formatSeasonLabels(draftSeasons)} · ` : ''}${getOutfitStyleLabel(draftStyle)} · 옷 ${draftItems.length}개`}
        isEditing={isEditing} isSaving={isSaving} backLabel={backLabel} wearSummary={wearSummary}
        onBack={isEditing ? cancelEdit : onClose} onEditInfo={() => setIsInfoOpen(true)} onDelete={() => setIsDeleteConfirmOpen(true)} />

      {hasArchivedItems && <p className="mx-auto w-full max-w-3xl shrink-0 px-4 py-2 text-center text-[11px] text-muted">삭제한 옷도 이 코디의 기록에는 남아 있어요.</p>}

      <div className={`min-h-0 flex-1 px-3 py-3 sm:px-6 sm:py-6 ${isEditing ? '' : 'overflow-y-auto'}`}>
        <div className="relative mx-auto h-full max-w-3xl">
          {isEditing ? <OutfitSlotEditor
            items={activeItems}
            selectedItems={draftItems}
            showArchivedStatus
            onChange={setDraftItems}
            className="h-full w-full"
          /> : <OutfitReadView items={draftItems} />}
          {isEditing && itemsChanged && outfit.previewImageUrl && (
            <p className="absolute top-3 right-3 left-3 z-20 rounded-xl bg-ink/88 px-3 py-2 text-center text-[11px] font-bold text-white backdrop-blur">
              구성이 바뀌어 저장하면 기존 AI 룩북이 해제돼요.
            </p>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)]">
        <div className="mx-auto grid max-w-3xl grid-cols-[0.85fr_1.15fr] gap-2">
          {!isEditing && requiresPreviewCredit && <div className="col-span-2"><PreviewCreditSummary /></div>}
          {!isEditing ? <AiCreditActionButton
            requiresCredit={requiresPreviewCredit}
            label={isPreviewInProgress ? '진행 상태 보기' : hasViewablePreview ? 'AI 룩북 보기' : 'AI 룩북 만들기'}
            adLabel="광고 보고 AI 룩북 만들기"
            onClick={() => {
              if (isPreviewInProgress || hasCurrentDraftPreview) {
                setDraftPreview((current) => ({ ...current, isOpen: true }))
                return
              }
              // 같은 옷의 다른 생성 결과가 있어도 이 코디북에 저장한 사진을 먼저 연다.
              if (outfit.previewImageUrl && !itemsChanged) {
                setIsPreviewOpen(true)
                return
              }
              if (hasRestorablePreview) {
                createDraftPreview()
                return
              }
              createDraftPreview()
            }}
            disabled={
              !isPreviewInProgress && !hasViewablePreview &&
              (hasArchivedItems || Boolean(outfitCompletionMessage) || Boolean(duplicateOutfit) || generateOutfitPreview.isPending || generateOutfitPreview.isRestoringCompleted)
            }
            title={
              archivedItemMessage ?? (duplicateOutfit
                ? `'${duplicateOutfit.name}' 코디와 같은 옷 조합이에요.`
                : outfitCompletionMessage ?? undefined)
            }
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {outfit.previewImageUrl && !itemsChanged ? (
              <Sparkles size={15} />
            ) : (
              <ImagePlus size={15} />
            )}
          </AiCreditActionButton> : <button type="button" onClick={cancelEdit} disabled={isSaving} className="min-h-12 rounded-xl border border-line bg-canvas px-3 py-3 text-sm font-semibold disabled:opacity-40">취소</button>}
          {isEditing ? <button
            type="button"
            onClick={async () => { if (await saveChanges()) setIsEditing(false) }}
            disabled={
              !isDirty ||
              hasArchivedItems ||
              isCheckingRecentWear ||
              updateOutfit.isPending ||
              Boolean(outfitCompletionMessage) ||
              Boolean(duplicateOutfit)
            }
            title={
              archivedItemMessage ?? (duplicateOutfit
                ? `'${duplicateOutfit.name}' 코디와 같은 옷 조합이에요.`
                : outfitCompletionMessage ?? undefined)
            }
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save size={16} />
            {isCheckingRecentWear || updateOutfit.isPending
              ? '저장 중…'
              : '변경사항 저장'}
          </button> : <button type="button" onClick={() => setIsEditing(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-3 text-sm font-semibold text-surface"><Pencil size={16} />코디 수정</button>}
          {hasArchivedItems && <p className="col-span-2 text-center text-[10px] text-muted">새로 저장하거나 생성하려면 삭제된 옷을 교체해주세요.</p>}
        </div>
      </footer>

      {isInfoOpen && (
        <div
          className="classification-page-enter fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 p-3 backdrop-blur-[2px]"
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
                <h2 id="outfit-info-edit-title" className="text-base font-semibold">
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
          onRegenerate={hasArchivedItems ? undefined : () => {
            setIsPreviewOpen(false)
            createDraftPreview(true)
          }}
        />
      )}
      <OutfitPreviewDialogView
        creditSummary={<PreviewCreditSummary />}
        selectedItems={draftItems}
        preview={draftPreview}
        generatePreview={createDraftPreview}
        closePreview={() =>
          setDraftPreview((current) => ({ ...current, isOpen: false }))
        }
        onPrimary={() => void saveDraftPreview()}
        primaryLabel={
          itemsChanged ? '수정한 코디에 저장' : '새 AI 룩북으로 저장'
        }
        isPrimaryPending={isCheckingRecentWear || updateOutfit.isPending}
      />
      {isDeleteConfirmOpen && (
        <ConfirmDialog
          title="코디북에서 삭제할까요?"
          description={`${outfit.name} 코디가 코디북에서 삭제돼요. 플래너에 저장한 코디와 착용 기록은 유지돼요.`}
          confirmLabel="코디 삭제"
          isPending={deleteOutfit.isPending}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={() => {
            void deleteOutfit
              .mutateAsync(outfit.id)
              .then(() => {
                removeOutfit(outfit.id)
                pushToast('코디북에서 삭제했어요.', 'success')
                onClose()
              })
              .catch((error: unknown) => {
                pushToast(
                  error instanceof Error
                    ? error.message
                    : '코디를 삭제하지 못했어요.',
                  'error',
                )
              })
          }}
        />
      )}
    </section>,
    document.body,
  )
}
