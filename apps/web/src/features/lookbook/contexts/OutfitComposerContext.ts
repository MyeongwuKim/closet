import { createContext, useContext } from 'react'
import type {
  ClothingCategory,
  OutfitPreview,
  Season,
  WardrobeItem,
} from '@closet/types'
import type { OutfitLayer } from '../types'

export type OutfitComposerStep =
  | 'start'
  | 'category'
  | 'items'
  | 'save'
  | 'complete'

export interface OutfitPreviewState {
  isOpen: boolean
  status: 'idle' | 'loading' | 'success' | 'error'
  imageUrl: string | null
  imageBase64: string | null
  mimeType: OutfitPreview['mimeType'] | null
  model: string | null
  errorMessage: string | null
}

export interface OutfitComposerState {
  layers: OutfitLayer[]
  targetCategory: ClothingCategory | null
  step: OutfitComposerStep
  returnStep: Extract<OutfitComposerStep, 'category' | 'items'>
  preview: OutfitPreviewState
}

export type OutfitComposerAction =
  | { type: 'HYDRATE'; layers: OutfitLayer[] }
  | { type: 'ADD_ITEM'; layer: OutfitLayer }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'SELECT_CATEGORY'; category: ClothingCategory }
  | { type: 'OPEN_CATEGORY_PICKER' }
  | { type: 'OPEN_SAVE' }
  | { type: 'OPEN_PREVIEW' }
  | {
      type: 'PREVIEW_SUCCESS'
      imageUrl: string
      imageBase64: string
      mimeType: OutfitPreview['mimeType']
      model: string
    }
  | { type: 'PREVIEW_ERROR'; message: string }
  | { type: 'CLOSE_PREVIEW' }
  | { type: 'GO_BACK' }
  | { type: 'RESET' }

function createPreviewState(): OutfitPreviewState {
  return {
    isOpen: false,
    status: 'idle',
    imageUrl: null,
    imageBase64: null,
    mimeType: null,
    model: null,
    errorMessage: null,
  }
}

export function createOutfitComposerState(
  layers: OutfitLayer[],
): OutfitComposerState {
  return {
    layers,
    targetCategory: null,
    step: layers.length > 0 ? 'category' : 'start',
    returnStep: 'category',
    preview: createPreviewState(),
  }
}

export function outfitComposerReducer(
  state: OutfitComposerState,
  action: OutfitComposerAction,
): OutfitComposerState {
  switch (action.type) {
    case 'HYDRATE':
      return createOutfitComposerState(action.layers)
    case 'ADD_ITEM':
      return {
        ...state,
        layers: [...state.layers, action.layer],
        targetCategory: null,
        step: 'category',
        preview: createPreviewState(),
      }
    case 'REMOVE_ITEM': {
      const layers = state.layers.filter(
        (layer) => layer.wardrobeItemId !== action.itemId,
      )
      return {
        ...state,
        layers,
        targetCategory: null,
        step: layers.length > 0 ? 'category' : 'start',
        preview: createPreviewState(),
      }
    }
    case 'SELECT_CATEGORY':
      return {
        ...state,
        targetCategory: action.category,
        step: 'items',
      }
    case 'OPEN_CATEGORY_PICKER':
      return {
        ...state,
        targetCategory: null,
        step: state.layers.length > 0 ? 'category' : 'start',
      }
    case 'OPEN_SAVE':
      return {
        ...state,
        returnStep: state.step === 'items' ? 'items' : 'category',
        step: 'save',
      }
    case 'OPEN_PREVIEW':
      return {
        ...state,
        preview: {
          isOpen: true,
          status: 'loading',
          imageUrl: null,
          imageBase64: null,
          mimeType: null,
          model: null,
          errorMessage: null,
        },
      }
    case 'PREVIEW_SUCCESS':
      return {
        ...state,
        preview: {
          isOpen: state.preview.isOpen,
          status: 'success',
          imageUrl: action.imageUrl,
          imageBase64: action.imageBase64,
          mimeType: action.mimeType,
          model: action.model,
          errorMessage: null,
        },
      }
    case 'PREVIEW_ERROR':
      return {
        ...state,
        preview: {
          isOpen: state.preview.isOpen,
          status: 'error',
          imageUrl: null,
          imageBase64: null,
          mimeType: null,
          model: null,
          errorMessage: action.message,
        },
      }
    case 'CLOSE_PREVIEW':
      return {
        ...state,
        preview: { ...state.preview, isOpen: false },
      }
    case 'GO_BACK':
      if (state.preview.isOpen) {
        return {
          ...state,
          preview: { ...state.preview, isOpen: false },
        }
      }
      if (state.step === 'save') {
        return { ...state, step: state.returnStep }
      }
      if (state.step === 'items') {
        return { ...state, targetCategory: null, step: 'category' }
      }
      if (state.step === 'category') {
        const layers = state.layers.slice(0, -1)
        return {
          ...state,
          layers,
          targetCategory: null,
          step: layers.length > 0 ? 'category' : 'start',
        }
      }
      return state
    case 'RESET':
      return createOutfitComposerState([])
  }
}

export interface OutfitComposerSession {
  items: WardrobeItem[]
  selectedIds: string[]
  selectedItems: WardrobeItem[]
  targetCategory: ClothingCategory | null
  targetOptions: ClothingCategory[]
  recommendedCategory: ClothingCategory | null
  step: Exclude<OutfitComposerStep, 'save'>
  isSaveOpen: boolean
  hasPreviousStep: boolean
  preview: OutfitPreviewState
  toggleItem: (item: WardrobeItem) => void
  selectTargetCategory: (category: ClothingCategory) => void
  goBackStep: () => void
  reset: () => void
  generatePreview: () => void
  addPreviewToLookbook: () => void
  closePreview: () => void
  outfitName: string
  outfitStyle: string
  outfitSeasons: Season[]
  styleOptions: Array<{ label: string; value: string }>
  includesPreview: boolean
  isSaving: boolean
  setOutfitName: (name: string) => void
  setOutfitStyle: (style: string) => void
  setOutfitSeasons: (seasons: Season[]) => void
  saveOutfit: () => void
  closeSave: () => void
}

export const OutfitComposerContext =
  createContext<OutfitComposerSession | null>(null)

export function useOutfitComposer() {
  const session = useContext(OutfitComposerContext)

  if (!session) {
    throw new Error(
      'useOutfitComposer must be used inside OutfitComposerContext.Provider',
    )
  }

  return session
}
