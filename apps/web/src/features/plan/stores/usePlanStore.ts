import { create } from 'zustand'
import type { SavedOutfit } from '../../lookbook/types'
import {
  createEmptyWeeklyPlan,
  getCurrentWeekStart,
  type PlanEntry,
} from '../data/weeklyPlan'

interface PlanState {
  entries: PlanEntry[]
  setWeek: (weekStartsOn: string) => void
  hydrateEntries: (entries: PlanEntry[]) => void
  setEntryItems: (date: string, itemIds: string[]) => void
  assignOutfit: (date: string, outfit: SavedOutfit) => void
  clearOutfit: (date: string) => void
}

export const usePlanStore = create<PlanState>((set) => ({
  entries: createEmptyWeeklyPlan(getCurrentWeekStart()),
  setWeek: (weekStartsOn) =>
    set({ entries: createEmptyWeeklyPlan(weekStartsOn) }),
  hydrateEntries: (entries) =>
    set((state) => {
      const remoteByDate = new Map(entries.map((entry) => [entry.date, entry]))
      return {
        entries: state.entries.map(
          (entry) => remoteByDate.get(entry.date) ?? entry,
        ),
      }
    }),
  setEntryItems: (date, itemIds) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.date === date
          ? {
              ...entry,
              title: itemIds.length > 0 ? '직접 고른 코디' : '',
              itemIds: [...new Set(itemIds)],
              outfitId: undefined,
              plannerOnly: undefined,
              previewImageUrl: undefined,
            }
          : entry,
      ),
    })),
  assignOutfit: (date, outfit) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.date === date
          ? {
              ...entry,
              title: outfit.name,
              itemIds: outfit.layers.map((layer) => layer.wardrobeItemId),
              outfitId: outfit.id,
              plannerOnly: false,
              previewImageUrl: outfit.previewImageUrl,
            }
          : entry,
      ),
    })),
  clearOutfit: (date) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.date === date
          ? {
              ...entry,
              title: '',
              itemIds: [],
              outfitId: undefined,
              plannerOnly: undefined,
              previewImageUrl: undefined,
            }
          : entry,
      ),
    })),
}))
