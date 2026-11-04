import type { ClosetFilter } from '../features/closet/constants'
import type { ClothingCategory, Season, TodayOutfitColorScheme } from '@closet/types'
import { OUTFIT_COLOR_RULES_VERSION } from '@closet/types/outfit-colors'

export const queryKeys = {
  me: ['me'] as const,
  wardrobe: {
    all: ['wardrobe'] as const,
    statistics: ['wardrobe', 'statistics'] as const,
    rediscovery: (viewerId: string | null, day: string) => ['wardrobe', 'rediscovery', viewerId, day] as const,
    brandOptions: ['wardrobe', 'brand-options'] as const,
    list: (filter?: { category?: ClosetFilter; subcategory?: string }) =>
      ['wardrobe', 'list', filter ?? {}] as const,
  },
  outfits: {
    all: ['outfits'] as const,
    previewAsset: (assetId: string) =>
      ['outfits', 'preview-asset', assetId] as const,
    list: (filter?: { style?: string; wardrobeItemIds?: string[] }) =>
      ['outfits', 'list', filter ?? {}] as const,
    recommendation: (
      viewerId: string | null,
      selectedItemIds: string[],
      targetCategory: ClothingCategory | null,
    ) =>
      [
        'outfits',
        'recommendation',
        OUTFIT_COLOR_RULES_VERSION,
        viewerId,
        { selectedItemIds, targetCategory },
      ] as const,
  },
  planner: {
    all: ['planner'] as const,
    todayRecommendation: (
      viewerId: string,
      date: string,
      season: Season,
      colorScheme: TodayOutfitColorScheme,
      variation: number,
      excludedOuterItemIds: string[],
      baseItemId?: string,
      weatherKey?: string,
      thermalContextRevision?: string,
    ) =>
      [
        'planner',
        'today-recommendation',
        OUTFIT_COLOR_RULES_VERSION,
        viewerId,
        date,
        season,
        colorScheme,
        variation,
        excludedOuterItemIds,
        baseItemId ?? null,
        weatherKey ?? null,
        ...(thermalContextRevision === undefined ? [] : [thermalContextRevision]),
      ] as const,
    thermalContext: (viewerId: string, date: string, meanTemperatureC: number | null) =>
      ['planner', 'thermal-context', viewerId, date, meanTemperatureC] as const,
    week: (weekStartsOn: string) =>
      ['planner', 'week', weekStartsOn] as const,
    entries: (from: string, to: string) =>
      ['planner', 'entries', from, to] as const,
    outfitWearHistory: (outfitIds: string[]) =>
      ['planner', 'outfit-wear-history', outfitIds] as const,
  },
  weather: {
    forecast: (
      date: string,
      coordinates: { latitude: number; longitude: number } | null,
    ) => [
      'weather',
      'forecast',
      date,
      coordinates?.latitude.toFixed(3) ?? null,
      coordinates?.longitude.toFixed(3) ?? null,
    ] as const,
  },
}
