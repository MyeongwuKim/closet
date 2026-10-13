import { createContext, useContext } from 'react'
import type {
  OutfitPreview,
  Season,
  WardrobeItem,
} from '@closet/types'
import type { OutfitLayer } from '../types'
import type { OutfitSelectionCategory } from '../utils/outfitSelection'

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
  assetId: string | null
  compositionKey: string | null
  mimeType: OutfitPreview['mimeType'] | null
  model: string | null
  errorMessage: string | null
}

export interface OutfitComposerState {
  layers: OutfitLayer[]
  originItemIds: string[]
  compositionRevision: number
  /** 다음에 고를 종류. bag은 가방 전용 선택 단계이며 서버의 옷 분류에는 추가하지 않는다. */
  targetCategory: OutfitSelectionCategory | null
  step: OutfitComposerStep
  returnStep: Extract<OutfitComposerStep, 'category' | 'items'>
  preview: OutfitPreviewState
}

export type OutfitComposerAction =
  | { type: 'HYDRATE'; layers: OutfitLayer[]; originItemIds: string[] }
  | { type: 'ADD_ITEM'; layer: OutfitLayer }
  | { type: 'REMOVE_ITEM'; itemId: string }
  /** oldItemId의 기존 칸을 newItemId로 교체하고 다음 종류 선택 단계로 돌아간다. 미리보기는 초기화한다. */
  | {
      type: 'REPLACE_ITEM'
      oldItemId: string
      newItemId: string
    }
  | { type: 'SELECT_CATEGORY'; category: OutfitSelectionCategory }
  | { type: 'OPEN_CATEGORY_PICKER' }
  | { type: 'OPEN_SAVE' }
  | { type: 'OPEN_PREVIEW' }
  | { type: 'REOPEN_PREVIEW' }
  /** 스타일을 처음 지정할 때 이미 만든 AI 이미지의 조합 키만 바꾸고 이미지 데이터는 유지한다. */
  | {
      type: 'REKEY_PREVIEW'
      previousCompositionKey: string
      compositionKey: string
    }
  | {
      type: 'PREVIEW_SUCCESS'
      imageUrl: string
      imageBase64?: string | null
      assetId?: string | null
      compositionKey?: string | null
      mimeType: OutfitPreview['mimeType']
      model: string
      open?: boolean
    }
  | { type: 'PREVIEW_ERROR'; message: string; open?: boolean }
  | { type: 'CLOSE_PREVIEW' }
  | { type: 'INVALIDATE_PREVIEW' }
  | { type: 'GO_BACK' }
  | { type: 'RESET' }

function createPreviewState(): OutfitPreviewState {
  return {
    isOpen: false,
    status: 'idle',
    imageUrl: null,
    imageBase64: null,
    assetId: null,
    compositionKey: null,
    mimeType: null,
    model: null,
    errorMessage: null,
  }
}

export function createOutfitComposerState(
  layers: OutfitLayer[],
  originItemIds: readonly string[] = [],
): OutfitComposerState {
  return {
    layers,
    originItemIds: [...originItemIds],
    compositionRevision: 0,
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
    case 'HYDRATE': {
      const hydratedState = createOutfitComposerState(
        action.layers,
        action.originItemIds,
      )
      return { ...hydratedState, preview: state.preview }
    }
    case 'ADD_ITEM':
      return {
        ...state,
        layers: [...state.layers, action.layer],
        compositionRevision: state.compositionRevision + 1,
        targetCategory: null,
        step: 'category',
        preview: createPreviewState(),
      }
    case 'REMOVE_ITEM': {
      const layers = state.layers.filter(
        (layer) => layer.wardrobeItemId !== action.itemId,
      )
      const removedOriginItem = state.originItemIds.includes(action.itemId)
      return {
        ...state,
        layers,
        compositionRevision: state.compositionRevision + 1,
        originItemIds: removedOriginItem ? [] : state.originItemIds,
        targetCategory: null,
        step: layers.length > 0 ? 'category' : 'start',
        preview: createPreviewState(),
      }
    }
    case 'REPLACE_ITEM': {
      if (
        action.oldItemId === action.newItemId ||
        !state.layers.some((layer) => layer.wardrobeItemId === action.oldItemId) ||
        state.layers.some((layer) => layer.wardrobeItemId === action.newItemId)
      ) {
        return state
      }

      // 기존 layer의 위치와 order를 보존해 교체 전후의 조합 순서를 유지한다.
      const layers = state.layers.map((layer) =>
        layer.wardrobeItemId === action.oldItemId
          ? { ...layer, wardrobeItemId: action.newItemId }
          : layer,
      )

      return {
        ...state,
        layers,
        compositionRevision: state.compositionRevision + 1,
        originItemIds: state.originItemIds.includes(action.oldItemId)
          ? []
          : state.originItemIds,
        targetCategory: null,
        step: 'category',
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
          assetId: null,
          compositionKey: null,
          mimeType: null,
          model: null,
          errorMessage: null,
        },
      }
    case 'REOPEN_PREVIEW':
      if (state.preview.status !== 'success' || !state.preview.imageUrl) {
        return state
      }
      return {
        ...state,
        preview: { ...state.preview, isOpen: true },
      }
    case 'REKEY_PREVIEW':
      if (
        state.preview.status !== 'success' ||
        state.preview.compositionKey !== action.previousCompositionKey
      ) {
        return state
      }
      return {
        ...state,
        preview: { ...state.preview, compositionKey: action.compositionKey },
      }
    case 'PREVIEW_SUCCESS':
      return {
        ...state,
        preview: {
          isOpen: action.open ?? state.preview.isOpen,
          status: 'success',
          imageUrl: action.imageUrl,
          imageBase64: action.imageBase64 ?? null,
          assetId: action.assetId ?? null,
          compositionKey: action.compositionKey ?? null,
          mimeType: action.mimeType,
          model: action.model,
          errorMessage: null,
        },
      }
    case 'PREVIEW_ERROR':
      return {
        ...state,
        preview: {
          isOpen: action.open ?? state.preview.isOpen,
          status: 'error',
          imageUrl: null,
          imageBase64: null,
          assetId: null,
          compositionKey: null,
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
    case 'INVALIDATE_PREVIEW':
      return { ...state, preview: createPreviewState() }
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
          compositionRevision: state.compositionRevision + 1,
          targetCategory: null,
          step: layers.length > 0 ? 'category' : 'start',
          preview: createPreviewState(),
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
  targetCategory: OutfitSelectionCategory | null
  targetOptions: OutfitSelectionCategory[]
  /** 채운 칸의 아이템을 바꾸는 중이면 기존 아이템 ID, 새 칸에 추가할 때는 null. */
  replacementItemId: string | null
  recommendedCategory: OutfitSelectionCategory | null
  step: Exclude<OutfitComposerStep, 'save'>
  isSaveOpen: boolean
  preview: OutfitPreviewState
  toggleItem: (item: WardrobeItem) => void
  /** 보드 아래 선택 목록에서 지정한 아이템을 제거한다. 교체 후보를 고르는 동작과 구분한다. */
  removeItem: (item: WardrobeItem) => void
  selectTargetCategory: (category: OutfitSelectionCategory) => void
  /** 선택된 itemId를 교체 대상으로 두고 category 옷장 후보를 연다. */
  selectReplacementItem: (itemId: string, category: OutfitSelectionCategory) => void
  goBackStep: () => void
  /** 저장 전 편집 화면을 닫도록 요청한다. 선택한 옷이 있으면 종료 확인을 먼저 보여준다. */
  requestClose: () => void
  reset: () => void
  generatePreview: (forceNew?: boolean) => void
  addPreviewToLookbook: () => void
  closePreview: () => void
  outfitName: string
  outfitStyle: string
  outfitSeasons: Season[]
  styleOptions: Array<{ label: string; value: string }>
  includesPreview: boolean
  /** 최근 착용 확인부터 실제 저장 요청까지 중복 저장과 닫기를 막는 상태. */
  isSaving: boolean
  /** 실제 코디 저장 요청이 진행 중일 때 true. 착용 기록 확인 중에는 false다. */
  isPersisting: boolean
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
