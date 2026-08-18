import { create } from 'zustand'
import type {
  ClothingCategory,
  ClothingClassificationSuggestion,
  ColorMode,
} from '@closet/types'

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
  confidence: number | null
  model: string | null
  candidates: ClothingClassificationSuggestion[]
  analysisFailed: boolean
}

interface Toast {
  id: string
  message: string
  variant: 'info' | 'success' | 'error'
}

interface UiState {
  classificationQueue: ClassificationCandidate[]
  toasts: Toast[]
  enqueueClassification: (candidate: ClassificationCandidate) => void
  completeClassification: () => void
  cancelClassification: () => void
  disposeClassificationImages: () => void
  pushToast: (message: string, variant?: Toast['variant']) => void
  dismissToast: (id: string) => void
}

export const useUiStore = create<UiState>((set, get) => ({
  classificationQueue: [],
  toasts: [],
  enqueueClassification: (candidate) =>
    set((state) => ({
      classificationQueue: [...state.classificationQueue, candidate],
    })),
  completeClassification: () =>
    set((state) => ({
      classificationQueue: state.classificationQueue.slice(1),
    })),
  cancelClassification: () => {
    const candidate = get().classificationQueue[0]
    if (candidate?.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(candidate.imageUrl)
    }
    if (candidate?.originalImageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(candidate.originalImageUrl)
    }

    set((state) => ({
      classificationQueue: state.classificationQueue.slice(1),
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
      toasts: [...state.toasts, { id, message, variant }],
    }))

    window.setTimeout(() => get().dismissToast(id), 3500)
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}))
