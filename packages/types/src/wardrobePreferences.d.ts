export interface WardrobePreference {
  wearAvoidanceReason?: string | null
  recommendationResumeOn?: string | null
}
export function getKoreaDate(now?: Date): string
export function isWardrobeRecommendationPaused(item: WardrobePreference, date: string): boolean
export function canReuseWardrobeRecommendation(
  items: readonly { id: string }[],
  wardrobe: readonly (WardrobePreference & { id: string; archivedAt?: string | null })[],
  date: string,
  explicitItemIds?: readonly string[],
): boolean
