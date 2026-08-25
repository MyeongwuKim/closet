import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import type {
  ClothingCategory,
  Season,
  WardrobeItem,
} from '@closet/types'
import { Sparkles } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { outfitStyleOptions } from '../../../constants/styleOptions'
import { allSeasons } from '../../../constants/seasons'
import { useUiStore } from '../../../stores/useUiStore'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { useStyleProfileStore } from '../../settings/stores/useStyleProfileStore'
import { OutfitComposerHeader } from '../components/OutfitComposerHeader'
import { OutfitMatchPanel } from '../components/OutfitMatchPanel'
import { OutfitPreviewDialog } from '../components/OutfitPreviewDialog'
import { OutfitSaveDialog } from '../components/OutfitSaveDialog'
import {
  useCreateOutfitMutation,
  useGenerateOutfitPreviewMutation,
} from '../api/lookbookQueries'
import {
  createOutfitComposerState,
  OutfitComposerContext,
  outfitComposerReducer,
} from '../contexts/OutfitComposerContext'
import { useLookbookStore } from '../stores/useLookbookStore'
import {
  createOutfitLayer,
  createOutfitLayers,
} from '../utils/createOutfitLayer'
import {
  findDuplicateOutfit,
  getOutfitCompletionMessage,
} from '../utils/outfitComposition'

const targetCategoryOrder: ClothingCategory[] = [
  'top',
  'bottom',
  'outer',
  'shoes',
  'midlayer',
  'accessory',
  'dress',
]

const categoryFlowByStart: Record<ClothingCategory, ClothingCategory[]> = {
  top: ['bottom', 'outer', 'shoes', 'midlayer', 'accessory'],
  bottom: ['top', 'outer', 'shoes', 'midlayer', 'accessory'],
  outer: ['top', 'bottom', 'shoes', 'accessory', 'midlayer'],
  midlayer: ['top', 'bottom', 'outer', 'shoes', 'accessory'],
  dress: ['outer', 'shoes', 'accessory', 'midlayer'],
  shoes: ['bottom', 'top', 'outer', 'accessory', 'midlayer'],
  accessory: ['top', 'bottom', 'outer', 'shoes', 'midlayer'],
  other: ['top', 'bottom', 'outer', 'shoes', 'midlayer'],
}

function getSlotId(item: Pick<WardrobeItem, 'category'> | ClothingCategory) {
  const category = typeof item === 'string' ? item : item.category
  if (category === 'dress') return 'top'
  if (category === 'other') return 'accessory'
  return category
}

function getDefaultTargetCategory(
  selectedItems: WardrobeItem[],
  targetOptions: ClothingCategory[],
) {
  const startCategory = selectedItems[0]?.category
  const preferredOrder = startCategory
    ? categoryFlowByStart[startCategory]
    : targetCategoryOrder
  return (
    preferredOrder.find((category) => targetOptions.includes(category)) ??
    targetOptions[0] ??
    null
  )
}

function getRecommendedTargetCategory(
  selectedItems: WardrobeItem[],
  targetOptions: ClothingCategory[],
) {
  const hasUpper = selectedItems.some(
    (item) => item.category === 'top' || item.category === 'dress',
  )
  const hasLower = selectedItems.some(
    (item) => item.category === 'bottom' || item.category === 'dress',
  )

  if (hasUpper && hasLower && targetOptions.includes('shoes')) return 'shoes'
  return getDefaultTargetCategory(selectedItems, targetOptions)
}

function getDefaultOutfitName(
  selectedItems: WardrobeItem[],
  outfitCount: number,
) {
  if (!selectedItems[0]) return `코디 ${outfitCount + 1}`
  if (selectedItems.length === 2) {
    return `${selectedItems[0].name} + ${selectedItems[1].name}`
  }
  return `${selectedItems[0].name} 코디`
}

function getCommonSeasons(items: WardrobeItem[]) {
  if (items.length === 0 || items.some((item) => item.seasons.length === 0)) {
    return []
  }
  return allSeasons.filter((season) =>
    items.every((item) => item.seasons.includes(season)),
  )
}

export function OutfitComposerPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const items = useClosetStore((state) => state.items)
  const outfits = useLookbookStore((state) => state.outfits)
  const addOutfit = useLookbookStore((state) => state.addOutfit)
  const createOutfit = useCreateOutfitMutation()
  const previewMutation = useGenerateOutfitPreviewMutation()
  const pushToast = useUiStore((state) => state.pushToast)
  const preferredStyles = useStyleProfileStore(
    (state) => state.profile.preferredStyles,
  )

  const requestedItemIds = useMemo(
    () => (searchParams.get('items') ?? '').split(',').filter(Boolean),
    [searchParams],
  )
  const initialItems = useMemo(
    () =>
      requestedItemIds.flatMap((itemId) => {
        const item = items.find((candidate) => candidate.id === itemId)
        return item ? [item] : []
      }),
    [items, requestedItemIds],
  )
  const fromPath = searchParams.get('from')
  const backPath =
    fromPath?.startsWith('/') && !fromPath.startsWith('//')
      ? fromPath
      : '/lookbook'
  const initializedFromQueryRef = useRef(
    requestedItemIds.length === 0 || initialItems.length > 0,
  )

  const [composerState, dispatch] = useReducer(
    outfitComposerReducer,
    createOutfitLayers(initialItems),
    createOutfitComposerState,
  )
  const [style, setStyle] = useState<string>(() => preferredStyles[0] ?? '')
  const [outfitSeasons, setOutfitSeasons] = useState<Season[]>(() =>
    getCommonSeasons(initialItems),
  )
  const [outfitName, setOutfitName] = useState(() =>
    getDefaultOutfitName(initialItems, outfits.length),
  )
  const { layers, targetCategory, step } = composerState
  const availableStyleOptions = useMemo(() => {
    const defaultValues = new Set<string>(
      outfitStyleOptions.map((option) => option.value),
    )
    const customStyles = [...new Set(outfits.map((outfit) => outfit.style))]
      .filter((outfitStyle) => !defaultValues.has(outfitStyle))
      .map((outfitStyle) => ({ label: outfitStyle, value: outfitStyle }))
    return [...outfitStyleOptions, ...customStyles]
  }, [outfits])
  const hasGeneratedPreview =
    composerState.preview.status === 'success' &&
    Boolean(
      composerState.preview.imageBase64 &&
        composerState.preview.mimeType &&
        composerState.preview.model,
    )
  const isStepDecisionOpen = step === 'category'
  const isSaveStepOpen = step === 'save'

  const goBackStep = useCallback(() => {
    if (step === 'start') {
      navigate(backPath)
      return
    }
    dispatch({ type: 'GO_BACK' })
  }, [backPath, navigate, step])

  useEffect(() => {
    if (initializedFromQueryRef.current || items.length === 0) return
    const resolvedItems = requestedItemIds.flatMap((itemId) => {
      const item = items.find((candidate) => candidate.id === itemId)
      return item ? [item] : []
    })
    dispatch({ type: 'HYDRATE', layers: createOutfitLayers(resolvedItems) })
    initializedFromQueryRef.current = true
  }, [items, requestedItemIds])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') goBackStep()
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [goBackStep])

  const selectedIds = layers.map((layer) => layer.wardrobeItemId)
  const selectedItems = selectedIds.flatMap((itemId) => {
    const item = items.find((candidate) => candidate.id === itemId)
    return item ? [item] : []
  })
  const outfitCompletionMessage = getOutfitCompletionMessage(selectedItems)
  const duplicateOutfit = findDuplicateOutfit(outfits, selectedIds)
  const duplicateMessage = duplicateOutfit
    ? `같은 옷 조합이 이미 '${duplicateOutfit.name}' 코디로 저장되어 있어요.`
    : null
  const outfitBlockingMessage = outfitCompletionMessage ?? duplicateMessage
  const canCompleteOutfit = outfitBlockingMessage === null
  const selectedSlotCounts = selectedItems.reduce<Record<string, number>>(
    (counts, item) => {
      const slotId = getSlotId(item)
      if (slotId) counts[slotId] = (counts[slotId] ?? 0) + 1
      return counts
    },
    {},
  )
  const hasDress = selectedItems.some((item) => item.category === 'dress')
  const hasBottom = selectedItems.some((item) => item.category === 'bottom')
  const targetOptions = targetCategoryOrder.filter((category) => {
    if (hasDress && ['top', 'bottom', 'dress'].includes(category)) return false
    if (hasBottom && category === 'dress') return false
    const slotId = getSlotId(category)
    const slotLimit = category === 'midlayer' ? 2 : 1
    return (selectedSlotCounts[slotId ?? category] ?? 0) < slotLimit
  })
  const recommendedTargetCategory = getRecommendedTargetCategory(
    selectedItems,
    targetOptions,
  )
  const activeTargetCategory =
    selectedIds.length === 0
      ? null
      : targetCategory && targetOptions.includes(targetCategory)
        ? targetCategory
        : null

  useEffect(() => {
    if (!initializedFromQueryRef.current) return
    const nextSearchParams = new URLSearchParams(searchParams)
    if (selectedIds.length > 0) {
      nextSearchParams.set('items', selectedIds.join(','))
    } else {
      nextSearchParams.delete('items')
    }
    if (nextSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(nextSearchParams, { replace: true })
    }
  }, [searchParams, selectedIds, setSearchParams])

  const toggleItem = (item: (typeof items)[number]) => {
    const isSelected = layers.some(
      (layer) => layer.wardrobeItemId === item.id,
    )

    if (isSelected) {
      dispatch({ type: 'REMOVE_ITEM', itemId: item.id })
      return
    }

    const hasSelectedDress = selectedItems.some(
      (selectedItem) => selectedItem.category === 'dress',
    )
    const hasSelectedTopOrBottom = selectedItems.some(
      (selectedItem) =>
        selectedItem.category === 'top' || selectedItem.category === 'bottom',
    )
    if (
      (item.category === 'dress' && hasSelectedTopOrBottom) ||
      (hasSelectedDress &&
        (item.category === 'top' || item.category === 'bottom'))
    ) {
      pushToast('원피스는 상의나 하의와 함께 선택할 수 없어요.', 'error')
      return
    }

    const sameSlotItems = layers
      .map((layer) =>
        items.find((candidate) => candidate.id === layer.wardrobeItemId),
      )
      .filter(
        (selectedItem) =>
          selectedItem && getSlotId(selectedItem) === getSlotId(item),
      )
    const slotLimit = item.category === 'midlayer' ? 2 : 1

    if (sameSlotItems.length >= slotLimit) {
      pushToast(
        item.category === 'midlayer'
          ? '중간 아우터는 두 개까지 선택할 수 있어요.'
          : '같은 위치의 아이템은 한 개만 선택할 수 있어요.',
        'error',
      )
      return
    }

    dispatch({
      type: 'ADD_ITEM',
      layer: createOutfitLayer(item, layers),
    })
  }

  const resetLayout = () => {
    dispatch({ type: 'RESET' })
    setOutfitSeasons([])
    pushToast('선택한 옷을 모두 해제했습니다.')
  }

  const selectTargetCategory = (category: ClothingCategory) => {
    dispatch({ type: 'SELECT_CATEGORY', category })
  }

  const openCategoryPicker = () => {
    dispatch({ type: 'OPEN_CATEGORY_PICKER' })
  }

  const openSaveStep = () => {
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return
    }
    if (duplicateOutfit) {
      pushToast(duplicateMessage!, 'error')
      return
    }
    setOutfitName(getDefaultOutfitName(selectedItems, outfits.length))
    if (outfitSeasons.length === 0) {
      setOutfitSeasons(getCommonSeasons(selectedItems))
    }
    dispatch({ type: 'OPEN_SAVE' })
  }

  const addPreviewToLookbook = () => {
    if (duplicateOutfit) {
      pushToast(duplicateMessage!, 'error')
      return
    }
    setOutfitName(getDefaultOutfitName(selectedItems, outfits.length))
    if (outfitSeasons.length === 0) {
      setOutfitSeasons(getCommonSeasons(selectedItems))
    }
    dispatch({ type: 'CLOSE_PREVIEW' })
    dispatch({ type: 'OPEN_SAVE' })
  }

  const saveOutfit = async () => {
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return
    }

    if (duplicateOutfit) {
      pushToast(duplicateMessage!, 'error')
      return
    }

    if (!style) {
      pushToast('코디 스타일을 선택해주세요.', 'error')
      return
    }

    if (outfitSeasons.length === 0) {
      pushToast('코디를 입을 계절을 선택해주세요.', 'error')
      return
    }

    const name = outfitName.trim()
    if (!name) {
      pushToast('코디 이름을 입력해주세요.', 'error')
      return
    }

    try {
      const savedOutfit = await createOutfit.mutateAsync({
        name,
        style,
        seasons: outfitSeasons,
        items: layers.map((layer) => ({
          wardrobeItemId: layer.wardrobeItemId,
          layerOrder: layer.order,
        })),
        previewImage: hasGeneratedPreview
          ? {
              imageBase64: composerState.preview.imageBase64!,
              mimeType: composerState.preview.mimeType!,
              model: composerState.preview.model!,
            }
          : undefined,
      })
      addOutfit(savedOutfit)
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '코디를 저장하지 못했습니다.',
        'error',
      )
      return
    }
    pushToast('코디북에 새 코디를 저장했습니다.', 'success')
    navigate('/lookbook', { replace: true })
  }

  const generatePreview = () => {
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return
    }
    if (duplicateOutfit) {
      pushToast(duplicateMessage!, 'error')
      return
    }
    dispatch({ type: 'OPEN_PREVIEW' })
    if (previewMutation.isPending) return

    void previewMutation
      .mutateAsync({ selectedItemIds: selectedIds, style })
      .then((result) => {
        dispatch({
          type: 'PREVIEW_SUCCESS',
          imageUrl: `data:${result.mimeType};base64,${result.imageBase64}`,
          imageBase64: result.imageBase64,
          mimeType: result.mimeType,
          model: result.model,
        })
      })
      .catch((error: unknown) => {
        dispatch({
          type: 'PREVIEW_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'AI 룩 이미지를 만들지 못했습니다.',
        })
      })
  }

  const composerSession = {
    items,
    selectedIds,
    selectedItems,
    targetCategory: activeTargetCategory,
    targetOptions,
    recommendedCategory: recommendedTargetCategory,
    step: step === 'save' ? composerState.returnStep : step,
    isSaveOpen: isSaveStepOpen,
    hasPreviousStep: step !== 'start',
    preview: composerState.preview,
    toggleItem,
    selectTargetCategory,
    goBackStep,
    reset: resetLayout,
    generatePreview,
    addPreviewToLookbook,
    closePreview: () => dispatch({ type: 'CLOSE_PREVIEW' }),
    outfitName,
    outfitStyle: style,
    outfitSeasons,
    styleOptions: availableStyleOptions,
    includesPreview: hasGeneratedPreview,
    isSaving: createOutfit.isPending,
    setOutfitName,
    setOutfitStyle: setStyle,
    setOutfitSeasons,
    saveOutfit: () => void saveOutfit(),
    closeSave: () => dispatch({ type: 'GO_BACK' }),
  }

  return (
    <OutfitComposerContext.Provider value={composerSession}>
      <section className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas">
        <OutfitComposerHeader />

        <div className="min-h-0 flex-1 bg-canvas">
          <OutfitMatchPanel />
        </div>

        {!isSaveStepOpen && layers.length > 0 && (
          <footer className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)]">
          <div className="mx-auto max-w-2xl">
            {isStepDecisionOpen ? (
              canCompleteOutfit ? (
                <div className="grid grid-cols-[0.95fr_1.05fr] gap-2">
                  <button
                    type="button"
                    onClick={generatePreview}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold text-ink"
                  >
                    <Sparkles size={15} /> AI 룩 미리보기
                  </button>
                  <button
                    type="button"
                    onClick={openSaveStep}
                    className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white"
                  >
                    이대로 완성
                  </button>
                </div>
              ) : (
                <p className="rounded-xl bg-canvas px-4 py-3 text-center text-xs font-bold text-muted">
                  {outfitBlockingMessage}
                </p>
              )
            ) : activeTargetCategory ? (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={openCategoryPicker}
                  className="rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold text-ink"
                >
                  다른 종류 고르기
                </button>
                {canCompleteOutfit ? (
                  <div className="grid grid-cols-[0.95fr_1.05fr] gap-2">
                    <button
                      type="button"
                      onClick={generatePreview}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-3 py-3 text-xs font-bold text-ink"
                    >
                      <Sparkles size={14} /> AI 룩 미리보기
                    </button>
                    <button
                      type="button"
                      onClick={openSaveStep}
                      className="rounded-xl bg-accent px-3 py-3 text-xs font-bold text-white"
                    >
                      이대로 완성
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-[11px] font-bold text-muted">
                    {outfitBlockingMessage}
                  </p>
                )}
              </div>
            ) : null}
          </div>
          </footer>
        )}
        <OutfitPreviewDialog />
        <OutfitSaveDialog />
      </section>
    </OutfitComposerContext.Provider>
  )
}
