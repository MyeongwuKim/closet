import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { ClothingCategory, ColorMode, Season } from '@closet/types'
import { ClassificationConfirmModal } from './ClassificationConfirmModal'
import { ToastViewport } from './ToastViewport'
import { useSaveWardrobeItemMutation } from '../features/closet/api/saveWardrobeItem'
import { useWardrobeItemsQuery } from '../features/closet/api/wardrobeQueries'
import { useClosetStore } from '../features/closet/stores/useClosetStore'
import { useOutfitsQuery } from '../features/lookbook/api/lookbookQueries'
import { useLookbookStore } from '../features/lookbook/stores/useLookbookStore'
import { useUiStore } from '../stores/useUiStore'
import type { GarmentSizeInput } from '../features/closet/utils/garmentSize'
import { RecentWearReminderDialog } from '../features/plan/components/RecentWearReminderDialog'

export function GlobalUi() {
  const { pathname } = useLocation()
  const candidate = useUiStore((state) => state.classificationQueue[0])
  const wardrobeItems = useClosetStore((state) => state.items)
  const addItems = useClosetStore((state) => state.addItems)
  const hydrateItems = useClosetStore((state) => state.hydrateItems)
  const pushToast = useUiStore((state) => state.pushToast)
  // Only the planner/composer need the full catalog for their editing controls.
  const needsCatalog = pathname.startsWith('/plan') || pathname === '/lookbook/new'
  const wardrobeItemsQuery = useWardrobeItemsQuery(needsCatalog || Boolean(candidate))
  const outfitsQuery = useOutfitsQuery(needsCatalog)
  const hydrateOutfits = useLookbookStore((state) => state.hydrateOutfits)
  const saveWardrobeItem = useSaveWardrobeItemMutation()

  useEffect(() => {
    if ((needsCatalog || candidate) && wardrobeItemsQuery.data) hydrateItems(wardrobeItemsQuery.data)
  }, [candidate, needsCatalog, hydrateItems, wardrobeItemsQuery.data])

  useEffect(() => {
    if (needsCatalog && outfitsQuery.data) hydrateOutfits(outfitsQuery.data)
  }, [needsCatalog, hydrateOutfits, outfitsQuery.data])

  const handleConfirm = async (
    _itemId: string,
    result: {
      name: string
      category: ClothingCategory
      additionalCategories: ClothingCategory[]
      subcategory: string
      colorName: string
      colorDetailName: string | null
      colorHex: string
      colorMode: ColorMode | null
      seasons: Season[]
      tags: string[]
    } & GarmentSizeInput,
  ) => {
    if (!candidate) return

    try {
      const item = await saveWardrobeItem.mutateAsync({
        candidate,
        input: result,
      })
      addItems([item])
      pushToast('옷장에 추가했습니다.', 'success')
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : '옷장 저장에 실패했습니다.',
        'error',
      )
      throw error
    }
  }

  return (
    <>
      {candidate && (
        <ClassificationConfirmModal
          key={candidate.itemId}
          candidate={candidate}
          wardrobeItems={wardrobeItems}
          onConfirm={handleConfirm}
        />
      )}
      <RecentWearReminderDialog />
      <ToastViewport />
    </>
  )
}
