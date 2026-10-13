import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type {
  Season,
  WardrobeItem,
} from '@closet/types'
import { MAX_OUTFIT_ITEMS } from '@closet/types'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { outfitStyleOptions } from '../../../constants/styleOptions'
import { allSeasons } from '../../../constants/seasons'
import { useUiStore } from '../../../stores/useUiStore'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { useClosetStore } from '../../closet/stores/useClosetStore'
import { formatDateOnly } from '../../plan/data/weeklyPlan'
import { useRecentWearReminder } from '../../plan/hooks/useRecentWearReminder'
import { useMeQuery } from '../../settings/api/profileQueries'
import { OutfitComposerHeader } from '../components/OutfitComposerHeader'
import { OutfitCompletionActions } from '../components/OutfitCompletionActions'
import { OutfitMatchPanel } from '../components/OutfitMatchPanel'
import { OutfitPreviewDialog } from '../components/OutfitPreviewDialog'
import { OutfitSaveDialog } from '../components/OutfitSaveDialog'
import { SavedOutfitPreviewDialog } from '../components/SavedOutfitPreviewDialog'
import {
  useCreateOutfitMutation,
  useGenerateOutfitPreviewMutation,
  useOutfitPreviewAssetQuery,
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
import {
  getOutfitComposerBackPath,
  shouldExitOutfitComposer,
} from '../utils/outfitComposerNavigation'
import {
  cacheOutfitPreview,
  getOutfitPreviewCompositionKey,
  readCachedOutfitPreview,
} from '../utils/outfitPreviewCache'
import {
  getOutfitSelectionCategory,
  getOutfitSelectionCapacity,
  getOutfitSlotId,
  getRecommendedTargetCategory,
  outfitSelectionOrder,
  type OutfitSelectionCategory,
} from '../utils/outfitSelection'
import './OutfitComposerPage.css'

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

/** 옷장·코디북 → 새 Look 만들기. 옷장 아이템을 선택해 조합 보드에 놓고 확인 화면까지 이어지는 편집 상태를 관리한다. 저장·AI 이미지 생성은 기존 mutation에 요청한다. */
export function OutfitComposerPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const items = useClosetStore((state) => state.items)
  const outfits = useLookbookStore((state) => state.outfits)
  const addOutfit = useLookbookStore((state) => state.addOutfit)
  const createOutfit = useCreateOutfitMutation()
  const previewMutation = useGenerateOutfitPreviewMutation()
  const previewAssetId = searchParams.get('previewAssetId')
  const previewRouteState = searchParams.get('preview')
  const shouldRestorePreview = previewRouteState === 'open'
  const shouldRestorePreviewFailure = previewRouteState === 'failed'
  const restoredPreview = useOutfitPreviewAssetQuery(previewAssetId)
  const { confirmRecentWear, isCheckingRecentWear } =
    useRecentWearReminder()
  const meQuery = useMeQuery()
  const pushToast = useUiStore((state) => state.pushToast)

  // 편집 중 URL의 items가 바뀌어도 최초 아이템과 복귀 경로는 유지한다.
  const [initialItemIds] = useState(
    () => (searchParams.get('items') ?? '').split(',').filter(Boolean),
  )
  const routeItemIdsValue = searchParams.get('items') ?? ''
  const routeItemIds = useMemo(
    () => routeItemIdsValue.split(',').filter(Boolean),
    [routeItemIdsValue],
  )
  const initialItems = useMemo(
    () =>
      initialItemIds.flatMap((itemId) => {
        const item = items.find((candidate) => candidate.id === itemId)
        return item ? [item] : []
      }),
    [items, initialItemIds],
  )
  const backPath = getOutfitComposerBackPath(searchParams.get('from'))
  const initializedFromQueryRef = useRef(
    initialItemIds.length === 0 || initialItems.length > 0,
  )
  const hydratedNotificationRouteRef = useRef<string | null>(null)
  const previewRequestVersionRef = useRef(0)

  const [composerState, dispatch] = useReducer(
    outfitComposerReducer,
    {
      layers: createOutfitLayers(initialItems),
      originItemIds: initialItemIds,
    },
    ({ layers, originItemIds }) =>
      createOutfitComposerState(layers, originItemIds),
  )
  const [style, setStyle] = useState<string>(
    () => searchParams.get('style') ?? '',
  )
  const [outfitSeasons, setOutfitSeasons] = useState<Season[]>(() =>
    getCommonSeasons(initialItems),
  )
  const [outfitName, setOutfitName] = useState(() =>
    getDefaultOutfitName(initialItems, outfits.length),
  )
  const [isSavedLookbookOpen, setIsSavedLookbookOpen] = useState(false)
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false)
  /** 모바일 옷장 시트가 열리면 하단 진행 버튼을 가리고, 보드가 시트 높이만큼 줄어든다. */
  const [isWardrobeExpanded, setIsWardrobeExpanded] = useState(false)
  /** 채운 Look 칸을 다시 열었을 때 새 후보와 맞바꿀 현재 아이템 ID. */
  const [replacementItemId, setReplacementItemId] = useState<string | null>(null)
  const composerRootRef = useRef<HTMLElement>(null)
  const composerFooterRef = useRef<HTMLElement>(null)
  /** 시트를 닫을 때 진행 버튼을 다시 보여주고, 다음 칸 선택에 교체 대상이 남지 않게 한다. */
  const changeWardrobeExpanded = useCallback((expanded: boolean) => {
    setIsWardrobeExpanded(expanded)
    if (!expanded) setReplacementItemId(null)
  }, [])
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
  const selectedIds = layers.map((layer) => layer.wardrobeItemId)
  const currentPreviewCompositionKey = getOutfitPreviewCompositionKey(
    selectedIds,
    style,
  )
  const cachedCurrentPreview = meQuery.data?.id
    ? readCachedOutfitPreview(meQuery.data.id, currentPreviewCompositionKey)
    : undefined
  const hasGeneratedPreview =
    composerState.preview.status === 'success' &&
    composerState.preview.compositionKey === currentPreviewCompositionKey &&
    Boolean(
      (composerState.preview.assetId || composerState.preview.imageBase64) &&
        composerState.preview.mimeType &&
        composerState.preview.model,
    )
  const isSaveStepOpen = step === 'save'

  // 실제 버튼 영역 높이를 시트와 보드에 공유해 두 경계가 함께 움직이게 한다.
  useEffect(() => {
    const footer = composerFooterRef.current
    const root = composerRootRef.current
    if (!footer || !root) return

    const updateFooterHeight = () => {
      root.style.setProperty('--outfit-footer-height', `${footer.getBoundingClientRect().height}px`)
    }
    updateFooterHeight()
    const observer = new ResizeObserver(updateFooterHeight)
    observer.observe(footer)
    return () => observer.disconnect()
  }, [isSaveStepOpen])
  const shouldReturnToOrigin = shouldExitOutfitComposer(composerState)

  const goBackStep = useCallback(() => {
    if (isSavedLookbookOpen) {
      setIsSavedLookbookOpen(false)
      return
    }
    if (isWardrobeExpanded) {
      changeWardrobeExpanded(false)
      return
    }
    if (shouldReturnToOrigin) {
      navigate(backPath, { replace: true })
      return
    }
    setReplacementItemId(null)
    dispatch({ type: 'GO_BACK' })
  }, [backPath, changeWardrobeExpanded, isSavedLookbookOpen, isWardrobeExpanded, navigate, shouldReturnToOrigin])

  /** 선택한 옷이 남아 있으면 종료 확인을 띄우고, 빈 Look이면 진입 화면으로 돌아간다. */
  const requestClose = useCallback(() => {
    if (composerState.layers.length > 0) {
      setIsExitConfirmOpen(true)
      return
    }
    navigate(backPath, { replace: true })
  }, [backPath, composerState.layers.length, navigate])

  useEffect(() => {
    if (initializedFromQueryRef.current || items.length === 0) return
    const resolvedItems = initialItemIds.flatMap((itemId) => {
      const item = items.find((candidate) => candidate.id === itemId)
      return item ? [item] : []
    })
    previewRequestVersionRef.current += 1
    dispatch({
      type: 'HYDRATE',
      layers: createOutfitLayers(resolvedItems),
      originItemIds: resolvedItems.map((item) => item.id),
    })
    initializedFromQueryRef.current = true
  }, [items, initialItemIds])

  useEffect(() => {
    if (
      (previewRouteState !== 'open' && previewRouteState !== 'failed') ||
      routeItemIds.length === 0 ||
      items.length === 0
    ) return

    const routeKey = `${previewRouteState}:${previewAssetId ?? ''}:${routeItemIdsValue}`
    if (hydratedNotificationRouteRef.current === routeKey) return

    const resolvedItems = routeItemIds.flatMap((itemId) => {
      const item = items.find((candidate) => candidate.id === itemId)
      return item ? [item] : []
    })
    if (resolvedItems.length !== routeItemIds.length) return

    previewRequestVersionRef.current += 1
    dispatch({
      type: 'HYDRATE',
      layers: createOutfitLayers(resolvedItems),
      originItemIds: routeItemIds,
    })
    const routeStyle = searchParams.get('style')
    initializedFromQueryRef.current = true
    hydratedNotificationRouteRef.current = routeKey

    const syncDetailsTimer = window.setTimeout(() => {
      if (routeStyle) setStyle(routeStyle)
      setOutfitSeasons(getCommonSeasons(resolvedItems))
      setOutfitName(getDefaultOutfitName(resolvedItems, outfits.length))
    }, 0)
    return () => window.clearTimeout(syncDetailsTimer)
  }, [
    items,
    outfits.length,
    previewAssetId,
    previewRouteState,
    routeItemIds,
    routeItemIdsValue,
    searchParams,
  ])

  useEffect(() => {
    if (!shouldRestorePreview || !restoredPreview.data) return
    dispatch({
      type: 'PREVIEW_SUCCESS',
      imageUrl: restoredPreview.data.imageUrl,
      assetId: restoredPreview.data.assetId,
      compositionKey: getOutfitPreviewCompositionKey(
        routeItemIds,
        searchParams.get('style') ?? style,
      ),
      mimeType: restoredPreview.data.mimeType,
      model: restoredPreview.data.model,
      open: true,
    })
  }, [restoredPreview.data, routeItemIds, searchParams, shouldRestorePreview, style])

  useEffect(() => {
    if (!meQuery.data?.id || !restoredPreview.data || !shouldRestorePreview) {
      return
    }
    cacheOutfitPreview(
      meQuery.data.id,
      getOutfitPreviewCompositionKey(
        routeItemIds,
        searchParams.get('style') ?? style,
      ),
      restoredPreview.data,
    )
  }, [
    meQuery.data?.id,
    restoredPreview.data,
    routeItemIds,
    searchParams,
    shouldRestorePreview,
    style,
  ])

  useEffect(() => {
    if (!shouldRestorePreview || !restoredPreview.error) return
    dispatch({
      type: 'PREVIEW_ERROR',
      message:
        restoredPreview.error instanceof Error
          ? restoredPreview.error.message
          : '완성된 AI 코디 이미지를 불러오지 못했어요.',
      open: true,
    })
  }, [restoredPreview.error, shouldRestorePreview])

  useEffect(() => {
    if (!shouldRestorePreviewFailure) return
    dispatch({
      type: 'PREVIEW_ERROR',
      message: 'AI 룩 이미지를 완성하지 못했어요. 다시 만들기를 눌러주세요.',
      open: true,
    })
  }, [routeItemIdsValue, shouldRestorePreviewFailure])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !useUiStore.getState().recentWearConfirmation
      ) {
        if (isExitConfirmOpen) {
          setIsExitConfirmOpen(false)
          return
        }
        goBackStep()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [goBackStep, isExitConfirmOpen])

  const selectedItems = selectedIds.flatMap((itemId) => {
    const item = items.find((candidate) => candidate.id === itemId)
    return item ? [item] : []
  })
  const outfitCompletionMessage = getOutfitCompletionMessage(selectedItems)
  const duplicateOutfit = findDuplicateOutfit(outfits, selectedIds)
  const duplicateMessage = duplicateOutfit
    ? `같은 옷 조합이 이미 '${duplicateOutfit.name}' 코디로 저장되어 있어요.`
    : null
  const savedLookbookImageUrl = duplicateOutfit?.previewImageUrl
  const canUseSavedLookbookPreview = Boolean(
    savedLookbookImageUrl && composerState.compositionRevision === 0,
  )
  const selectedSlotCounts = selectedItems.reduce<Record<string, number>>(
    (counts, item) => {
      const slotId = getOutfitSlotId(item)
      if (slotId) counts[slotId] = (counts[slotId] ?? 0) + 1
      return counts
    },
    {},
  )
  const hasDress = selectedItems.some((item) => item.category === 'dress')
  const hasBottom = selectedItems.some((item) => item.category === 'bottom')
  const targetOptions = outfitSelectionOrder.filter((category) => {
    if (hasDress && ['top', 'bottom', 'dress'].includes(category)) return false
    if (hasBottom && category === 'dress') return false
    const slotId = getOutfitSlotId(category)
    const slotLimit = getOutfitSelectionCapacity(category, selectedItems)
    return (selectedSlotCounts[slotId ?? category] ?? 0) < slotLimit
  })
  const recommendedTargetCategory = getRecommendedTargetCategory(
    selectedItems,
    targetOptions,
  )
  // 첫 아이템을 고르기 전에도 빈 보드 슬롯에서 해당 종류의 옷장을 열 수 있다.
  const activeTargetCategory =
    targetCategory && (targetOptions.includes(targetCategory) || Boolean(replacementItemId))
      ? targetCategory
      : null

  useEffect(() => {
    if (!initializedFromQueryRef.current) return
    if (
      (previewRouteState === 'open' || previewRouteState === 'failed') &&
      selectedIds.join(',') !== routeItemIdsValue
    ) return
    const nextSearchParams = new URLSearchParams(searchParams)
    if (selectedIds.length > 0) {
      nextSearchParams.set('items', selectedIds.join(','))
    } else {
      nextSearchParams.delete('items')
    }
    if (nextSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(nextSearchParams, { replace: true })
    }
  }, [
    previewRouteState,
    routeItemIdsValue,
    searchParams,
    selectedIds,
    setSearchParams,
  ])

  const invalidateStoredPreview = () => {
    previewRequestVersionRef.current += 1
    if (!previewAssetId && !searchParams.has('preview')) return

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('previewAssetId')
    nextSearchParams.delete('preview')
    setSearchParams(nextSearchParams, { replace: true })
  }

  /** 선택 목록의 빼기는 현재 열린 교체 대상과 관계없이 해당 아이템만 제거한다. */
  const removeItem = (item: (typeof items)[number]) => {
    if (!selectedIds.includes(item.id)) return
    invalidateStoredPreview()
    dispatch({ type: 'REMOVE_ITEM', itemId: item.id })
    changeWardrobeExpanded(false)
  }

  const toggleItem = (item: (typeof items)[number]) => {
    const replacingItem = replacementItemId
      ? selectedItems.find((selectedItem) => selectedItem.id === replacementItemId)
      : null

    if (replacingItem) {
      if (item.id === replacingItem.id) return
      if (selectedIds.includes(item.id)) {
        pushToast('이미 Look에 담긴 아이템이에요.', 'error')
        return
      }
      if (getOutfitSlotId(item) !== getOutfitSlotId(replacingItem)) {
        pushToast('같은 칸에 넣을 수 있는 아이템을 골라주세요.', 'error')
        return
      }

      const otherSelectedItems = selectedItems.filter((selectedItem) => selectedItem.id !== replacingItem.id)
      const hasOtherDress = otherSelectedItems.some((selectedItem) => selectedItem.category === 'dress')
      const hasOtherTopOrBottom = otherSelectedItems.some((selectedItem) =>
        selectedItem.category === 'top' || selectedItem.category === 'bottom',
      )
      if (
        (item.category === 'dress' && hasOtherTopOrBottom) ||
        (hasOtherDress && (item.category === 'top' || item.category === 'bottom'))
      ) {
        pushToast('원피스는 상의나 하의와 함께 선택할 수 없어요.', 'error')
        return
      }

      invalidateStoredPreview()
      dispatch({
        type: 'REPLACE_ITEM',
        oldItemId: replacingItem.id,
        newItemId: item.id,
      })
      changeWardrobeExpanded(false)
      return
    }

    const isSelected = layers.some(
      (layer) => layer.wardrobeItemId === item.id,
    )

    if (isSelected) {
      removeItem(item)
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
          selectedItem && getOutfitSlotId(selectedItem) === getOutfitSlotId(item),
      )
    const selectionCategory = getOutfitSelectionCategory(item)
    const slotLimit = selectionCategory
      ? getOutfitSelectionCapacity(selectionCategory, selectedItems)
      : 1

    if (sameSlotItems.length >= slotLimit) {
      pushToast(
        selectedItems.length >= MAX_OUTFIT_ITEMS
          ? `코디에는 최대 ${MAX_OUTFIT_ITEMS}개까지 넣을 수 있어요. 다른 아이템을 빼고 골라주세요.`
          : selectionCategory === 'accessory'
            ? '액세서리는 네 개까지 선택할 수 있어요.'
            : selectionCategory === 'bag'
              ? '가방은 한 개만 선택할 수 있어요.'
              : item.category === 'midlayer'
                ? '중간 아우터는 두 개까지 선택할 수 있어요.'
                : '같은 위치의 아이템은 한 개만 선택할 수 있어요.',
        'error',
      )
      return
    }

    invalidateStoredPreview()
    dispatch({
      type: 'ADD_ITEM',
      layer: createOutfitLayer(item, layers),
    })
    changeWardrobeExpanded(false)
  }

  const resetLayout = () => {
    invalidateStoredPreview()
    changeWardrobeExpanded(false)
    dispatch({ type: 'RESET' })
    setOutfitSeasons([])
    pushToast('선택한 옷을 모두 해제했습니다.')
  }

  const selectTargetCategory = (category: OutfitSelectionCategory) => {
    setReplacementItemId(null)
    dispatch({ type: 'SELECT_CATEGORY', category })
  }

  /** 이미 채운 칸에서 바꿀 아이템을 지정하고, 같은 종류의 옷장을 연다. */
  const selectReplacementItem = (itemId: string, category: OutfitSelectionCategory) => {
    if (!selectedIds.includes(itemId)) return
    setReplacementItemId(itemId)
    dispatch({ type: 'SELECT_CATEGORY', category })
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
    closePreview()
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

    const confirmed = await confirmRecentWear({
      itemIds: layers.map((layer) => layer.wardrobeItemId),
      targetDate: formatDateOnly(new Date()),
      includeTargetDate: true,
      confirmLabel: '그래도 저장',
      cancelLabel: '계속 편집',
    })
    if (!confirmed) return

    try {
      const savedOutfit = await createOutfit.mutateAsync({
        name,
        style,
        seasons: outfitSeasons,
        items: layers.map((layer) => ({
          wardrobeItemId: layer.wardrobeItemId,
          layerOrder: layer.order,
        })),
        previewImageAssetId: hasGeneratedPreview
          ? composerState.preview.assetId ?? undefined
          : undefined,
        previewImage: hasGeneratedPreview && !composerState.preview.assetId
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

  const generatePreview = (forceNew = false) => {
    if (outfitCompletionMessage) {
      pushToast(outfitCompletionMessage, 'error')
      return
    }
    if (!forceNew && previewAssetId) {
      if (restoredPreview.data) {
        dispatch({
          type: 'PREVIEW_SUCCESS',
          imageUrl: restoredPreview.data.imageUrl,
          assetId: restoredPreview.data.assetId,
          compositionKey: currentPreviewCompositionKey,
          mimeType: restoredPreview.data.mimeType,
          model: restoredPreview.data.model,
          open: true,
        })
      }
      return
    }
    const requestedPreviewVersion = previewRequestVersionRef.current
    const requestedItemIds = [...selectedIds]
    const requestedStyle = style
    const requestedCompositionKey = getOutfitPreviewCompositionKey(
      requestedItemIds,
      requestedStyle,
    )

    if (!forceNew && cachedCurrentPreview) {
      dispatch({
        type: 'PREVIEW_SUCCESS',
        imageUrl: cachedCurrentPreview.imageUrl,
        assetId: cachedCurrentPreview.assetId,
        compositionKey: requestedCompositionKey,
        mimeType: cachedCurrentPreview.mimeType,
        model: cachedCurrentPreview.model,
        open: true,
      })
      return
    }

    dispatch({ type: 'OPEN_PREVIEW' })
    if (previewMutation.isPending) return

    void previewMutation
      .mutateAsync({ selectedItemIds: requestedItemIds, style: requestedStyle })
      .then((result) => {
        if (
          meQuery.data?.id &&
          result.assetId &&
          result.imageUrl
        ) {
          cacheOutfitPreview(meQuery.data.id, requestedCompositionKey, {
            assetId: result.assetId,
            imageUrl: result.imageUrl,
            mimeType: result.mimeType,
            model: result.model,
          })
        }
        if (previewRequestVersionRef.current !== requestedPreviewVersion) return
        dispatch({
          type: 'PREVIEW_SUCCESS',
          imageUrl:
            result.imageUrl ??
            `data:${result.mimeType};base64,${result.imageBase64}`,
          imageBase64: result.imageBase64,
          assetId: result.assetId,
          compositionKey: requestedCompositionKey,
          mimeType: result.mimeType,
          model: result.model,
          open: true,
        })
        if (result.assetId) {
          const nextSearchParams = new URLSearchParams(searchParams)
          nextSearchParams.set('previewAssetId', result.assetId)
          if (requestedStyle) nextSearchParams.set('style', requestedStyle)
          setSearchParams(nextSearchParams, { replace: true })
        }
      })
      .catch((error: unknown) => {
        if (previewRequestVersionRef.current !== requestedPreviewVersion) return
        dispatch({
          type: 'PREVIEW_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'AI 룩 이미지를 만들지 못했습니다.',
        })
      })
  }

  const openAiLookbook = () => {
    if (hasGeneratedPreview && composerState.preview.imageUrl) {
      dispatch({ type: 'REOPEN_PREVIEW' })
      return
    }
    if (canUseSavedLookbookPreview) {
      setIsSavedLookbookOpen(true)
      return
    }
    generatePreview()
  }

  const updateOutfitStyle = (nextStyle: string) => {
    if (nextStyle === style) return

    // 스타일 없이 만든 이미지는 첫 스타일 선택 때 그대로 저장할 수 있다.
    // 이미 지정한 스타일을 바꾸면 이미지에 반영된 방향도 달라지므로 다시 만든다.
    const keepPreview = !style && hasGeneratedPreview
    const nextSearchParams = new URLSearchParams(searchParams)
    if (nextStyle) nextSearchParams.set('style', nextStyle)
    else nextSearchParams.delete('style')
    nextSearchParams.delete('preview')

    if (keepPreview) {
      const nextCompositionKey = getOutfitPreviewCompositionKey(selectedIds, nextStyle)
      dispatch({
        type: 'REKEY_PREVIEW',
        previousCompositionKey: currentPreviewCompositionKey,
        compositionKey: nextCompositionKey,
      })

      const { assetId, imageUrl, mimeType, model } = composerState.preview
      if (assetId) {
        nextSearchParams.set('previewAssetId', assetId)
        if (meQuery.data?.id && imageUrl && mimeType && model) {
          cacheOutfitPreview(
            meQuery.data.id,
            nextCompositionKey,
            { assetId, imageUrl, mimeType, model },
            { replacesCompositionKey: currentPreviewCompositionKey },
          )
        }
      } else {
        nextSearchParams.delete('previewAssetId')
      }
    } else {
      previewRequestVersionRef.current += 1
      nextSearchParams.delete('previewAssetId')
      dispatch({ type: 'INVALIDATE_PREVIEW' })
    }

    setStyle(nextStyle)
    if (nextSearchParams.toString() !== searchParams.toString()) {
      setSearchParams(nextSearchParams, { replace: true })
    }
  }

  const closePreview = () => {
    dispatch({ type: 'CLOSE_PREVIEW' })
    if (!searchParams.has('preview')) return

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('preview')
    setSearchParams(nextSearchParams, { replace: true })
  }

  const composerSession = {
    items,
    selectedIds,
    selectedItems,
    targetCategory: activeTargetCategory,
    targetOptions,
    replacementItemId,
    recommendedCategory: recommendedTargetCategory,
    step: step === 'save' ? composerState.returnStep : step,
    isSaveOpen: isSaveStepOpen,
    preview: composerState.preview,
    toggleItem,
    removeItem,
    selectTargetCategory,
    selectReplacementItem,
    goBackStep,
    requestClose,
    reset: resetLayout,
    generatePreview,
    addPreviewToLookbook,
    closePreview,
    outfitName,
    outfitStyle: style,
    outfitSeasons,
    styleOptions: availableStyleOptions,
    includesPreview: hasGeneratedPreview,
    isSaving: isCheckingRecentWear || createOutfit.isPending,
    isPersisting: createOutfit.isPending,
    setOutfitName,
    setOutfitStyle: updateOutfitStyle,
    setOutfitSeasons,
    saveOutfit: () => void saveOutfit(),
    closeSave: () => dispatch({ type: 'GO_BACK' }),
  }

  return createPortal(
    <OutfitComposerContext.Provider value={composerSession}>
      <section ref={composerRootRef} className="classification-page-enter fixed inset-0 z-[80] flex h-dvh flex-col overflow-hidden bg-canvas" role="dialog" aria-modal="true" aria-label="코디 맞춰보기">
        <OutfitComposerHeader />

        <div className="min-h-0 flex-1 bg-canvas">
          <OutfitMatchPanel isWardrobeExpanded={isWardrobeExpanded} onWardrobeExpandedChange={changeWardrobeExpanded} />
        </div>

        {!isSaveStepOpen && (
          <footer ref={composerFooterRef} className={`outfit-composer__footer shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(27,27,24,0.06)]${isWardrobeExpanded ? ' outfit-composer__footer--covered' : ''}`}>
            <div className="mx-auto max-w-2xl">
              <OutfitCompletionActions
                completionMessage={outfitCompletionMessage}
                isEmpty={selectedItems.length === 0}
                duplicateMessage={duplicateMessage}
                hasAvailableLookbook={Boolean(
                  canUseSavedLookbookPreview ||
                    hasGeneratedPreview ||
                    Boolean(cachedCurrentPreview),
                )}
                onOpenLookbook={openAiLookbook}
                onComplete={openSaveStep}
              />
            </div>
          </footer>
        )}
        <OutfitPreviewDialog isReadOnly={Boolean(duplicateOutfit)} />
        <OutfitSaveDialog />
        {isSavedLookbookOpen &&
          canUseSavedLookbookPreview &&
          savedLookbookImageUrl &&
          duplicateOutfit && (
          <SavedOutfitPreviewDialog
            imageUrl={savedLookbookImageUrl}
            outfitName={duplicateOutfit.name}
            onClose={() => setIsSavedLookbookOpen(false)}
          />
          )}
        {isExitConfirmOpen && (
          <ConfirmDialog
            title="Look 만들기를 닫을까요?"
            description="저장하지 않은 아이템 조합은 사라져요."
            confirmLabel="닫기"
            onCancel={() => setIsExitConfirmOpen(false)}
            onConfirm={() => navigate(backPath, { replace: true })}
          />
        )}
      </section>
    </OutfitComposerContext.Provider>,
    document.body,
  )
}
