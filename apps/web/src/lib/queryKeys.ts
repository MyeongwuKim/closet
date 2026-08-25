import type { OutfitStyle } from '../constants/styleOptions'
import type { ClosetFilter } from '../features/closet/constants'
import type { ClothingCategory, Season } from '@closet/types'

export const queryKeys = {
  me: ['me'] as const,
  wardrobe: {
    all: ['wardrobe'] as const,
    list: (filter?: { category?: ClosetFilter; subcategory?: string }) =>
      ['wardrobe', 'list', filter ?? {}] as const,
  },
  outfits: {
    all: ['outfits'] as const,
    list: (filter?: { style?: OutfitStyle; wardrobeItemIds?: string[] }) =>
      ['outfits', 'list', filter ?? {}] as const,
    recommendation: (
      selectedItemIds: string[],
      targetCategory: ClothingCategory | null,
    ) =>
      [
        'outfits',
        'recommendation',
        'v3',
        { selectedItemIds, targetCategory },
      ] as const,
  },
  planner: {
    all: ['planner'] as const,
    todayRecommendation: (
      viewerId: string,
      date: string,
      season: Season,
      style: OutfitStyle,
      variation: number,
      excludedOuterItemIds: string[],
    ) =>
      [
        'planner',
        'today-recommendation',
        'v5',
        viewerId,
        date,
        season,
        style,
        variation,
        excludedOuterItemIds,
      ] as const,
    week: (weekStartsOn: string) =>
      ['planner', 'week', weekStartsOn] as const,
    entries: (from: string, to: string) =>
      ['planner', 'entries', from, to] as const,
    outfitWearHistory: (outfitIds: string[]) =>
      ['planner', 'outfit-wear-history', outfitIds] as const,
  },
}
