import { create } from 'zustand'
import type { WardrobeItem } from '@closet/types'

interface ClosetState {
  items: WardrobeItem[]
  addItems: (items: WardrobeItem[]) => void
  hydrateItems: (items: WardrobeItem[]) => void
  updateItem: (itemId: WardrobeItem['id'], updates: Partial<WardrobeItem>) => void
  disposeUploadedImages: () => void
}

export const useClosetStore = create<ClosetState>((set, get) => ({
  items: [],
  addItems: (items) =>
    set((state) => ({
      items: [...items, ...state.items],
    })),
  hydrateItems: (items) => set({ items }),
  updateItem: (itemId, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    })),
  disposeUploadedImages: () => {
    get().items.forEach((item) => {
      if (item.imageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.imageUrl)
      }
      if (item.originalImageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.originalImageUrl)
      }
    })
  },
}))
