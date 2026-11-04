import { create } from 'zustand'
import type {
  ClothingCategory,
  ClothingClassificationSuggestion,
  ColorMode,
  FashionItemAttributes,
} from '@closet/types'
import type { RecentWearReminderRequest } from '../features/plan/utils/recentWearReminder'

export interface ClassificationCandidate {
  itemId: string
  imageUrl: string
  originalImageUrl?: string
  originalFilename?: string
  itemName: string
  category: ClothingCategory | null
  subcategory: string
  colorName: string
  colorDetailName: string
  colorHex: string
  colorRgb: [number, number, number]
  colorMode: ColorMode | null
  fashionAttributes: FashionItemAttributes | null
  confidence: number | null
  model: string | null
  candidates: ClothingClassificationSuggestion[]
  analysisFailed: boolean
}

interface Toast {
  id: string
  message: string
  variant: 'info' | 'success' | 'error'
  isLeaving: boolean
}

const TOAST_EXIT_DURATION_MS = 260

interface UiState {
  classificationQueue: ClassificationCandidate[]
  toasts: Toast[]
  recentWearConfirmation: RecentWearReminderRequest | null
  recentWearConfirmationOwnerId: string | null
  recentWearConfirmationResolver: ((confirmed: boolean) => void) | null
  enqueueClassification: (candidate: ClassificationCandidate) => void
  /** 저장을 마친 사진만 대기열에서 제거한다. 이미 닫힌 사진의 늦은 응답은 다른 후보에 영향을 주지 않는다. */
  completeClassification: (itemId: string) => void
  /** 지정한 등록 후보의 임시 이미지를 해제하고 대기열에서 제거한다. */
  cancelClassification: (itemId: string) => void
  disposeClassificationImages: () => void
  pushToast: (message: string, variant?: Toast['variant']) => void
  dismissToast: (id: string) => void
  requestRecentWearConfirmation: (
    reminder: RecentWearReminderRequest,
    ownerId: string,
  ) => Promise<boolean>
  cancelRecentWearConfirmation: (ownerId: string) => void
  resolveRecentWearConfirmation: (confirmed: boolean) => void
}

export const useUiStore = create<UiState>((set, get) => ({
  classificationQueue: [],
  toasts: [],
  recentWearConfirmation: null,
  recentWearConfirmationOwnerId: null,
  recentWearConfirmationResolver: null,
  enqueueClassification: (candidate) =>
    set((state) => ({
      classificationQueue: [...state.classificationQueue, candidate],
    })),
  completeClassification: (itemId) =>
    set((state) => ({
      classificationQueue: state.classificationQueue.filter((candidate) => candidate.itemId !== itemId),
    })),
  cancelClassification: (itemId) => {
    const candidate = get().classificationQueue.find((entry) => entry.itemId === itemId)
    if (candidate?.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(candidate.imageUrl)
    }
    if (candidate?.originalImageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(candidate.originalImageUrl)
    }

    set((state) => ({
      classificationQueue: state.classificationQueue.filter((entry) => entry.itemId !== itemId),
    }))
  },
  disposeClassificationImages: () => {
    get().classificationQueue.forEach((candidate) => {
      if (candidate.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(candidate.imageUrl)
      }
      if (candidate.originalImageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(candidate.originalImageUrl)
      }
    })
  },
  pushToast: (message, variant = 'info') => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts, { id, message, variant, isLeaving: false }],
    }))

    window.setTimeout(() => get().dismissToast(id), 3500)
  },
  dismissToast: (id) => {
    const toast = get().toasts.find((item) => item.id === id)
    if (!toast || toast.isLeaving) return

    set((state) => ({
      toasts: state.toasts.map((item) =>
        item.id === id ? { ...item, isLeaving: true } : item,
      ),
    }))

    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((item) => item.id !== id),
      }))
    }, TOAST_EXIT_DURATION_MS)
  },
  requestRecentWearConfirmation: (reminder, ownerId) => {
    if (get().recentWearConfirmationResolver) {
      return Promise.resolve(false)
    }

    return new Promise<boolean>((resolve) => {
      set({
        recentWearConfirmation: reminder,
        recentWearConfirmationOwnerId: ownerId,
        recentWearConfirmationResolver: resolve,
      })
    })
  },
  cancelRecentWearConfirmation: (ownerId) => {
    const state = get()
    if (state.recentWearConfirmationOwnerId !== ownerId) return

    set({
      recentWearConfirmation: null,
      recentWearConfirmationOwnerId: null,
      recentWearConfirmationResolver: null,
    })
    state.recentWearConfirmationResolver?.(false)
  },
  resolveRecentWearConfirmation: (confirmed) => {
    const resolve = get().recentWearConfirmationResolver
    if (!resolve) return

    set({
      recentWearConfirmation: null,
      recentWearConfirmationOwnerId: null,
      recentWearConfirmationResolver: null,
    })
    resolve(confirmed)
  },
}))
