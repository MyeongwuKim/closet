import { create } from 'zustand'
import type { SavedOutfit } from '../types'

interface LookbookState {
  outfits: SavedOutfit[]
  addOutfit: (outfit: SavedOutfit) => void
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
  hydrateOutfits: (outfits) => set({ outfits }),
}))
