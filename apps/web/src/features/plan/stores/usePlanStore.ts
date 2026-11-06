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
  /** 다른 주로 이동할 때만 빈 날짜를 준비한다. 같은 주를 다시 열면 이미 조회한 코디를 유지한다. */
  setWeek: (weekStartsOn) =>
    set((state) =>
      state.entries[0]?.date === weekStartsOn
        ? state
        : { entries: createEmptyWeeklyPlan(weekStartsOn) },
    ),
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
              wornAt: null,
              wearFeeling: null,
              plannerOnly: undefined,
              previewImageAssetId: undefined,
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
              outfitItems: outfit.outfitItems,
              outfitId: outfit.id,
              wornAt: entry.outfitId === outfit.id ? entry.wornAt : null,
              wearFeeling: entry.outfitId === outfit.id && entry.wornAt ? entry.wearFeeling : null,
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
              outfitItems: undefined,
              outfitId: undefined,
              wornAt: null,
              wearFeeling: null,
              plannerOnly: undefined,
              previewImageAssetId: undefined,
              previewImageUrl: undefined,
            }
          : entry,
      ),
    })),
}))
