import { useEffect } from 'react'
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

export function GlobalUi() {
  const candidate = useUiStore((state) => state.classificationQueue[0])
  const addItems = useClosetStore((state) => state.addItems)
  const hydrateItems = useClosetStore((state) => state.hydrateItems)
  const pushToast = useUiStore((state) => state.pushToast)
  const wardrobeItemsQuery = useWardrobeItemsQuery()
  const outfitsQuery = useOutfitsQuery()
  const hydrateOutfits = useLookbookStore((state) => state.hydrateOutfits)
  const saveWardrobeItem = useSaveWardrobeItemMutation()

  useEffect(() => {
    if (wardrobeItemsQuery.data) hydrateItems(wardrobeItemsQuery.data)
  }, [hydrateItems, wardrobeItemsQuery.data])

  useEffect(() => {
    if (outfitsQuery.data) hydrateOutfits(outfitsQuery.data)
  }, [hydrateOutfits, outfitsQuery.data])

  const handleConfirm = async (
    _itemId: string,
    result: {
      name: string
      category: ClothingCategory
      subcategory: string
      colorName: string
      colorDetailName: string | null
      colorHex: string
      colorMode: ColorMode | null
      seasons: Season[]
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
          onConfirm={handleConfirm}
        />
      )}
      <ToastViewport />
    </>
  )
}
