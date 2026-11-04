import { create } from 'zustand'
import type { WardrobeItem } from '@closet/types'

interface ClosetState {
  /** 새 선택·편집용 활성 옷만 보관한다. 저장 코디의 삭제 옷 정보는 각 코디에 둔다. */
  items: WardrobeItem[]
  addItems: (items: WardrobeItem[]) => void
  hydrateItems: (items: WardrobeItem[]) => void
  mergeItems: (items: WardrobeItem[]) => void
  updateItem: (itemId: WardrobeItem['id'], updates: Partial<WardrobeItem>) => void
  /** 보관 삭제한 옷을 선택·편집용 로컬 목록에서 제거한다. 저장한 코디의 관계 데이터는 별도로 유지한다. */
  removeItem: (itemId: WardrobeItem['id']) => void
  disposeUploadedImages: () => void
}

export const useClosetStore = create<ClosetState>((set, get) => ({
  items: [],
  addItems: (items) =>
    set((state) => ({
      items: [...items, ...state.items].filter((item) => !item.archivedAt),
    })),
  hydrateItems: (items) => set({ items: items.filter((item) => !item.archivedAt) }),
  /** 같은 ID는 새 응답으로 갱신하고 삭제 상태인 항목은 선택 목록에서 제거한다. */
  mergeItems: (items) => set((state) => ({
    items: [...new Map([...state.items, ...items].map((item) => [item.id, item])).values()].filter((item) => !item.archivedAt),
  })),
  updateItem: (itemId, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ).filter((item) => !item.archivedAt),
    })),
  removeItem: (itemId) => set((state) => ({
    items: state.items.filter((item) => item.id !== itemId),
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
