import { useEffect } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { ClothingCategory, Season, WardrobeItem } from '@closet/types'
import { graphqlRequest } from './graphql'
import { toWardrobeItem, wardrobeItemFields, type WardrobeItemPayload } from '../features/closet/api/wardrobeQueries'
import { toSavedOutfit, type OutfitPayload } from '../features/lookbook/api/lookbookQueries'
import { useClosetStore } from '../features/closet/stores/useClosetStore'
import { useLookbookStore } from '../features/lookbook/stores/useLookbookStore'

export interface CatalogPage<T> { items: T[]; totalCount: number; hasNextPage: boolean; nextCursor: string | null }
interface CommonFilters { season?: Season | null; color?: string | null; search?: string; sort?: 'latest' | 'oldest' }
export interface WardrobeFilters extends CommonFilters { category?: ClothingCategory | null; subcategory?: string | null; tag?: string | null }
export interface OutfitFilters extends CommonFilters { style?: string; wardrobeItemIds?: string[] }
const pageFields = 'totalCount hasNextPage nextCursor'

export function useInfiniteWardrobeQuery(filter: WardrobeFilters) {
  const query = useInfiniteQuery({
    queryKey: ['wardrobe', 'pages', filter],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const data = await graphqlRequest<{ wardrobePage: CatalogPage<WardrobeItemPayload> }>(`
        query WardrobePage($input: WardrobePageInput) {
          wardrobePage(input: $input) { ${pageFields} items { ${wardrobeItemFields} } }
        }`, { input: { ...filter, limit: 20, cursor: pageParam } }, signal)
      return { ...data.wardrobePage, items: data.wardrobePage.items.map(toWardrobeItem) }
    },
    getNextPageParam: (page) => page.hasNextPage ? page.nextCursor : undefined,
  })
  useEffect(() => {
    if (query.data) useClosetStore.getState().mergeItems(query.data.pages.flatMap((page) => page.items))
  }, [query.data])
  return query
}

export function useInfiniteOutfitsQuery(filter: OutfitFilters) {
  const query = useInfiniteQuery({
    queryKey: ['outfits', 'pages', filter],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const data = await graphqlRequest<{ outfitPage: CatalogPage<OutfitPayload> }>(`
        query OutfitPage($input: OutfitPageInput) {
          outfitPage(input: $input) { ${pageFields} items {
            id name style seasons createdAt
            items { wardrobeItemId layerOrder wardrobeItem { ${wardrobeItemFields} } }
            generations { status imageAsset { deliveryUrl } }
          } }
        }`, { input: { ...filter, limit: 20, cursor: pageParam } }, signal)
      return {
        ...data.outfitPage, items: data.outfitPage.items.map(toSavedOutfit),
        wardrobeItems: data.outfitPage.items.flatMap((outfit) => outfit.items.flatMap(
          (item) => item.wardrobeItem ? [toWardrobeItem(item.wardrobeItem)] : [],
        )),
      }
    },
    getNextPageParam: (page) => page.hasNextPage ? page.nextCursor : undefined,
  })
  useEffect(() => {
    if (!query.data) return
    useLookbookStore.getState().mergeOutfits(query.data.pages.flatMap((page) => page.items))
    useClosetStore.getState().mergeItems(query.data.pages.flatMap((page) => page.wardrobeItems))
  }, [query.data])
  return query
}

export function useWardrobeFilterOptions(category: ClothingCategory | null, subcategory: string | null) {
  return useQuery({
    queryKey: ['wardrobe', 'filters', category, subcategory],
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<{ wardrobeFilterOptions: {
        totalCount: number; categories: ClothingCategory[]; subcategories: string[];
        tags: string[]; colors: Array<{ name: string; hex: string }>;
      } }>(`query WardrobeFilterOptions($category: ClothingCategory, $subcategory: String) {
        wardrobeFilterOptions(category: $category, subcategory: $subcategory) {
          totalCount categories subcategories tags colors { name hex }
        }
      }`, { category, subcategory }, signal)
      return data.wardrobeFilterOptions
    },
  })
}

export function useOutfitFilterOptions() {
  return useQuery({
    queryKey: ['outfits', 'filters'],
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<{ outfitFilterOptions: {
        totalCount: number; styles: string[]; colors: Array<{ name: string; hex: string }>;
      } }>(`query OutfitFilterOptions { outfitFilterOptions { totalCount styles colors { name hex } } }`, undefined, signal)
      return data.outfitFilterOptions
    },
  })
}

export function useWardrobeItemQuery(id?: string) {
  const query = useQuery({
    queryKey: ['wardrobe', 'detail', id],
    enabled: Boolean(id),
    initialData: () => useClosetStore.getState().items.find((item) => item.id === id),
    initialDataUpdatedAt: 0,
    queryFn: async ({ signal }): Promise<WardrobeItem> => {
      const data = await graphqlRequest<{ wardrobeItem: WardrobeItemPayload }>(`
        query WardrobeItem($id: ID!) { wardrobeItem(id: $id) { ${wardrobeItemFields} } }
      `, { id }, signal)
      return toWardrobeItem(data.wardrobeItem)
    },
  })
  useEffect(() => {
    if (query.data) useClosetStore.getState().mergeItems([query.data])
  }, [query.data])
  return query
}

export function useOutfitQuery(id?: string) {
  const query = useQuery({
    queryKey: ['outfits', 'detail', id],
    enabled: Boolean(id),
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<{ outfit: OutfitPayload }>(`
        query Outfit($id: ID!) {
          outfit(id: $id) {
            id name style seasons createdAt
            items { wardrobeItemId layerOrder wardrobeItem { ${wardrobeItemFields} } }
            generations { status imageAsset { deliveryUrl } }
          }
        }`, { id }, signal)
      return {
        outfit: toSavedOutfit(data.outfit),
        wardrobeItems: data.outfit.items.flatMap((item) => item.wardrobeItem ? [toWardrobeItem(item.wardrobeItem)] : []),
      }
    },
  })
  useEffect(() => {
    if (!query.data) return
    useLookbookStore.getState().mergeOutfits([query.data.outfit])
    useClosetStore.getState().mergeItems(query.data.wardrobeItems)
  }, [query.data])
  return query
}
