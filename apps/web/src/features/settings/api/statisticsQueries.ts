import { useQuery } from '@tanstack/react-query'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'

export interface StatisticsBucket { key: string; label: string; count: number; color: string | null }
export interface WardrobeStatistics {
  totalItems: number
  totalOutfits: number
  wearRecordCount: number
  unwornCount: number
  unwornOutfitCount: number
  throughDate: string
  categories: StatisticsBucket[]
  colors: StatisticsBucket[]
  wornStyles: StatisticsBucket[]
  mostWorn: Array<{ id: string; name: string; wearCount: number; imageUrl: string | null }>
  mostWornOutfits: Array<{ id: string; name: string; wearCount: number; imageUrl: string | null; itemImageUrls: string[] }>
}

export function useWardrobeStatisticsQuery() {
  return useQuery({
    queryKey: queryKeys.wardrobe.statistics,
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<{ wardrobeStatistics: WardrobeStatistics }>(`
        query WardrobeStatistics {
          wardrobeStatistics {
            totalItems totalOutfits wearRecordCount unwornCount unwornOutfitCount throughDate
            categories { key label count color }
            colors { key label count color }
            wornStyles { key label count color }
            mostWorn { id name wearCount imageUrl }
            mostWornOutfits { id name wearCount imageUrl itemImageUrls }
          }
        }`, undefined, signal)
      return data.wardrobeStatistics
    },
  })
}
