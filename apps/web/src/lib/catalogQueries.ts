import { useEffect } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { ClothingCategory, Season, WardrobeItem } from '@closet/types'
import { graphqlRequest } from './graphql'
import { toWardrobeItem, wardrobeItemFields, type WardrobeItemPayload } from '../features/closet/api/wardrobeQueries'
import { toSavedOutfit, type OutfitPayload } from '../features/lookbook/api/lookbookQueries'
import { useClosetStore } from '../features/closet/stores/useClosetStore'
import { useLookbookStore } from '../features/lookbook/stores/useLookbookStore'

export interface CatalogPage<T> { items: T[]; totalCount: number; hasNextPage: boolean; nextCursor: string | null }
interface CommonFilters { season?: Season | null; color?: string | null; search?: string; sort?: 'latest' | 'oldest' }
export interface WardrobeFilters extends CommonFilters { category?: ClothingCategory | null; subcategory?: string | null; brandName?: string | null; unbrandedOnly?: boolean; tag?: string | null }
export interface OutfitFilters extends CommonFilters { style?: string; wardrobeItemIds?: string[] }
const pageFields = 'totalCount hasNextPage nextCursor'

/** 옷 목록을 조건별로 조회한다. 새 조건의 조회 중에는 이전 목록을 유지하고, 실제 응답만 옷장 Store에 병합한다. */
export function useInfiniteWardrobeQuery(filter: WardrobeFilters) {
  const query = useInfiniteQuery({
    queryKey: ['wardrobe', 'pages', filter],
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
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
    if (query.data && !query.isPlaceholderData) useClosetStore.getState().mergeItems(query.data.pages.flatMap((page) => page.items))
  }, [query.data, query.isPlaceholderData])
  return query
}

/** 새 코디 조건의 조회 중에도 이전 목록을 유지한다. 임시 목록은 Store에 병합하지 않고 실제 응답만 반영한다. */
export function useInfiniteOutfitsQuery(filter: OutfitFilters) {
  const query = useInfiniteQuery({
    queryKey: ['outfits', 'pages', filter],
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
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
    if (!query.data || query.isPlaceholderData) return
    useLookbookStore.getState().mergeOutfits(query.data.pages.flatMap((page) => page.items))
    useClosetStore.getState().mergeItems(query.data.pages.flatMap((page) => page.wardrobeItems))
  }, [query.data, query.isPlaceholderData])
  return query
}

/** 카테고리별 필터 옵션을 조회한다. 재조회 중에는 직전 옵션을 표시해 옷 개수와 상단 필터가 잠깐 사라지는 것을 막는다. */
export function useWardrobeFilterOptions(category: ClothingCategory | null, subcategory: string | null) {
  return useQuery({
    queryKey: ['wardrobe', 'filters', category, subcategory],
    staleTime: 60_000,
    placeholderData: keepPreviousData,
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
