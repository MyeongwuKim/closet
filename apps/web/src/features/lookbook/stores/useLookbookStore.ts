import { create } from 'zustand'
import type { SavedOutfit } from '../types'

interface LookbookState {
  outfits: SavedOutfit[]
  addOutfit: (outfit: SavedOutfit) => void
  removeOutfit: (outfitId: string) => void
  hydrateOutfits: (outfits: SavedOutfit[]) => void
}

export const useLookbookStore = create<LookbookState>((set) => ({
  outfits: [],
  addOutfit: (outfit) =>
    set((state) => ({
      outfits: [
        outfit,
        ...state.outfits.filter(
          (currentOutfit) => currentOutfit.id !== outfit.id,
        ),
      ],
    })),
  removeOutfit: (outfitId) =>
    set((state) => ({
      outfits: state.outfits.filter((outfit) => outfit.id !== outfitId),
    })),
  hydrateOutfits: (outfits) => set({ outfits }),
}))
