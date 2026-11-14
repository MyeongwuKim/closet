import { OutfitPreviewJobDialog } from '../features/lookbook/components/OutfitPreviewJobDialog'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type {
  ClothingCategory,
  ColorMode,
  FashionItemAttributes,
  Season,
} from '@closet/types'
import { ClassificationConfirmModal } from './ClassificationConfirmModal'
import { WardrobeBatchRegistrationDialog } from '../features/closet/components/WardrobeBatchRegistrationDialog'
import { ToastViewport } from './ToastViewport'
import { useSaveWardrobeItemMutation } from '../features/closet/api/saveWardrobeItem'
import { useWardrobeItemsQuery } from '../features/closet/api/wardrobeQueries'
import type { WardrobeComparisonCatalog } from '../features/closet/components/SimilarWardrobeItems'
import { useClosetStore } from '../features/closet/stores/useClosetStore'
import { useOutfitsQuery } from '../features/lookbook/api/lookbookQueries'
import { useLookbookStore } from '../features/lookbook/stores/useLookbookStore'
import { useUiStore } from '../stores/useUiStore'
import type { GarmentSizeInput } from '../features/closet/utils/garmentSize'
import { RecentWearReminderDialog } from '../features/plan/components/RecentWearReminderDialog'
import { PreviewCreditDialog } from '../features/lookbook/components/PreviewCreditDialog'
import { getAccessToken } from '../lib/auth'
import { useWardrobeImageAnalysis } from '../features/closet/hooks/useWardrobeImageAnalysis'

export function GlobalUi() {
  const { pathname } = useLocation()
  const candidates = useUiStore((state) => state.classificationQueue)
  const candidate = candidates[0]
  const analyzingCount = useWardrobeImageAnalysis((state) => state.analyzingCount)
  const [batchMode, setBatchMode] = useState(false)
  if (!batchMode && (candidates.length > 1 || candidate?.isBatch)) setBatchMode(true)
  if (batchMode && candidates.length === 0 && analyzingCount === 0) setBatchMode(false)
  const wardrobeItems = useClosetStore((state) => state.items)
  const mergeItems = useClosetStore((state) => state.mergeItems)
  const hydrateItems = useClosetStore((state) => state.hydrateItems)
  const pushToast = useUiStore((state) => state.pushToast)
  // 플래너·코디 작성과 옷 추가 비교에 전체 옷장 목록을 조회한다.
  const needsCatalog = pathname.startsWith('/plan') || pathname === '/lookbook/new'
  const wardrobeItemsQuery = useWardrobeItemsQuery(needsCatalog || batchMode || Boolean(candidate))
  const outfitsQuery = useOutfitsQuery(needsCatalog)
  const hydrateOutfits = useLookbookStore((state) => state.hydrateOutfits)
  const saveWardrobeItem = useSaveWardrobeItemMutation()

  // 이전 조회 결과가 캐시에 있어도 재조회가 끝나야 전체 목록의 비교 결과를 표시한다.
  let wardrobeComparison: WardrobeComparisonCatalog
  if (
    wardrobeItemsQuery.isPaused ||
    (wardrobeItemsQuery.isError && !wardrobeItemsQuery.isFetching)
  ) {
    wardrobeComparison = {
      status: 'error',
      retry: () => {
        void wardrobeItemsQuery.refetch()
      },
    }
  } else if (wardrobeItemsQuery.isSuccess && !wardrobeItemsQuery.isFetching) {
    wardrobeComparison = { status: 'ready', items: wardrobeItemsQuery.data }
  } else {
    wardrobeComparison = { status: 'loading' }
  }

  useEffect(() => {
    if ((needsCatalog || candidate) && wardrobeItemsQuery.data) hydrateItems(wardrobeItemsQuery.data)
  }, [candidate, needsCatalog, hydrateItems, wardrobeItemsQuery.data])

  useEffect(() => {
    if (needsCatalog && outfitsQuery.data) hydrateOutfits(outfitsQuery.data)
  }, [needsCatalog, hydrateOutfits, outfitsQuery.data])

  const handleConfirm = async (
    itemId: string,
    result: {
      name: string
      brandName: string | null
      storageLocation: string | null
      category: ClothingCategory
      additionalCategories: ClothingCategory[]
      subcategory: string
      colorName: string
      colorDetailName: string | null
      colorHex: string
      colorMode: ColorMode | null
      fashionAttributes: FashionItemAttributes
      seasons: Season[]
      tags: string[]
    } & GarmentSizeInput,
  ) => {
    const candidate = useUiStore.getState().classificationQueue.find((entry) => entry.itemId === itemId)
    if (!candidate) return
    const token = getAccessToken()

    try {
      const item = await saveWardrobeItem.mutateAsync({
        candidate,
        input: result,
      })
      if (getAccessToken() !== token) throw new Error('로그인 상태가 바뀌었어요.')
      mergeItems([item])
      pushToast('옷장에 추가했어요.', 'success')
    } catch (error) {
      if (getAccessToken() !== token) throw error
      pushToast(
        error instanceof Error ? error.message : '옷장 저장에 실패했어요.',
        'error',
      )
      throw error
    }
  }

  return (
    <>
      {batchMode && <WardrobeBatchRegistrationDialog candidates={candidates} wardrobeItems={wardrobeItems} wardrobeComparison={wardrobeComparison} />}
      {candidate && !batchMode && (
        <ClassificationConfirmModal
          key={candidate.itemId}
          candidate={candidate}
          wardrobeItems={wardrobeItems}
          wardrobeComparison={wardrobeComparison}
          onConfirm={handleConfirm}
        />
      )}
      <RecentWearReminderDialog />
      <PreviewCreditDialog />
      <OutfitPreviewJobDialog />
      <ToastViewport />
    </>
  )
}
