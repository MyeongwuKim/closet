import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ClothingCategory,
  ColorMode,
  FashionItemAttributes,
  Season,
  WardrobeItem,
} from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import { useClosetStore } from '../stores/useClosetStore'

export interface WardrobeItemPayload {
  id: string
  name: string
  createdAt: string
  category: ClothingCategory | null
  additionalCategories: ClothingCategory[]
  subcategory: string | null
  colorName: string | null
  colorDetailName: string | null
  colorHex: string | null
  colorMode: ColorMode | null
  fashionAttributes: FashionItemAttributes | null
  seasons: Season[]
  tags: string[] | null
  sizeLabel: string | null
  shoulderWidthCm: number | null
  chestWidthCm: number | null
  sleeveLengthCm: number | null
  totalLengthCm: number | null
  waistWidthCm: number | null
  hipWidthCm: number | null
  inseamCm: number | null
  thighWidthCm: number | null
  riseCm: number | null
  hemWidthCm: number | null
  classificationStatus: WardrobeItem['classificationStatus']
  wearCount: number
  lastWornAt: string | null
  displayImageAsset: { deliveryUrl: string | null } | null
  originalImageAsset: { deliveryUrl: string | null } | null
}

export function toWardrobeItem(item: WardrobeItemPayload): WardrobeItem {
  return {
    id: item.id,
    name: item.name,
    createdAt: item.createdAt,
    category: item.category,
    additionalCategories: item.additionalCategories,
    subcategory: item.subcategory ?? undefined,
    colorName: item.colorName ?? '',
    colorDetailName: item.colorDetailName ?? undefined,
    colorHex: item.colorHex ?? '#d9d5cc',
    colorMode: item.colorMode ?? undefined,
    fashionAttributes: item.fashionAttributes ?? undefined,
    seasons: item.seasons,
    tags: item.tags ?? [],
    sizeLabel: item.sizeLabel ?? undefined,
    shoulderWidthCm: item.shoulderWidthCm ?? undefined,
    chestWidthCm: item.chestWidthCm ?? undefined,
    sleeveLengthCm: item.sleeveLengthCm ?? undefined,
    totalLengthCm: item.totalLengthCm ?? undefined,
    waistWidthCm: item.waistWidthCm ?? undefined,
    hipWidthCm: item.hipWidthCm ?? undefined,
    inseamCm: item.inseamCm ?? undefined,
    thighWidthCm: item.thighWidthCm ?? undefined,
    riseCm: item.riseCm ?? undefined,
    hemWidthCm: item.hemWidthCm ?? undefined,
    classificationStatus: item.classificationStatus,
    wearCount: item.wearCount,
    lastWornAt: item.lastWornAt ?? undefined,
    imageUrl: item.displayImageAsset?.deliveryUrl ?? undefined,
    originalImageUrl: item.originalImageAsset?.deliveryUrl ?? undefined,
  }
}

export function useWardrobeItemsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.wardrobe.list(),
    enabled,
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<{ wardrobeItems: WardrobeItemPayload[] }>(
        `
          query WardrobeItems {
            wardrobeItems {
              id name createdAt category additionalCategories subcategory colorName colorDetailName
              colorHex colorMode seasons tags
              fashionAttributes {
                layerRole silhouette pattern material texture warmth formality confidence
                ribbedCuffs ribbedHem ribbedNeckline
                necklineStyle frontOpeningStyle pocketStyle
                bottomLegShape bottomWaistStyle bottomFrontPleats
              }
              sizeLabel shoulderWidthCm chestWidthCm sleeveLengthCm
              totalLengthCm waistWidthCm hipWidthCm inseamCm
              thighWidthCm riseCm hemWidthCm
              classificationStatus wearCount lastWornAt
              displayImageAsset { deliveryUrl }
              originalImageAsset { deliveryUrl }
            }
          }
        `,
        undefined,
        signal,
      )
      return data.wardrobeItems.map(toWardrobeItem)
    },
  })
}

export interface UpdateWardrobeItemVariables {
  id: string
  input: {
    name?: string
    category?: ClothingCategory
    additionalCategories?: ClothingCategory[]
    subcategory?: string
    colorName?: string
    colorDetailName?: string | null
    colorHex?: string
    colorMode?: ColorMode | null
    seasons?: Season[]
    tags?: string[]
    sizeLabel?: string | null
    shoulderWidthCm?: number | null
    chestWidthCm?: number | null
    sleeveLengthCm?: number | null
    totalLengthCm?: number | null
    waistWidthCm?: number | null
    hipWidthCm?: number | null
    inseamCm?: number | null
    thighWidthCm?: number | null
    riseCm?: number | null
    hemWidthCm?: number | null
  }
}

export const wardrobeItemFields = `
  id name createdAt category additionalCategories subcategory colorName colorDetailName
  colorHex colorMode seasons tags
  fashionAttributes {
    layerRole silhouette pattern material texture warmth formality confidence
    ribbedCuffs ribbedHem ribbedNeckline
    necklineStyle frontOpeningStyle pocketStyle
    bottomLegShape bottomWaistStyle bottomFrontPleats
  }
  sizeLabel shoulderWidthCm chestWidthCm sleeveLengthCm
  totalLengthCm waistWidthCm hipWidthCm inseamCm
  thighWidthCm riseCm hemWidthCm
  classificationStatus wearCount lastWornAt
  displayImageAsset { deliveryUrl }
  originalImageAsset { deliveryUrl }
`

export function useUpdateWardrobeItemMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, input }: UpdateWardrobeItemVariables) => {
      const data = await graphqlRequest<
        { updateWardrobeItem: WardrobeItemPayload },
        UpdateWardrobeItemVariables
      >(
        `
          mutation UpdateWardrobeItem($id: ID!, $input: UpdateWardrobeItemInput!) {
            updateWardrobeItem(id: $id, input: $input) {
              ${wardrobeItemFields}
            }
          }
        `,
        { id, input },
      )
      return toWardrobeItem(data.updateWardrobeItem)
    },
    onSuccess: (updatedItem) => {
      useClosetStore.getState().mergeItems([updatedItem])
      queryClient.setQueryData(['wardrobe', 'detail', updatedItem.id], updatedItem)
      queryClient.setQueryData<WardrobeItem[]>(
        queryKeys.wardrobe.list(),
        (currentItems = []) =>
          currentItems.map((item) =>
            item.id === updatedItem.id ? updatedItem : item,
          ),
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.wardrobe.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.outfits.all })
    },
  })
}

export function useArchiveWardrobeItemMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const data = await graphqlRequest<
        { archiveWardrobeItem: { id: string } },
        { id: string }
      >(
        `
          mutation ArchiveWardrobeItem($id: ID!) {
            archiveWardrobeItem(id: $id) { id }
          }
        `,
        { id },
      )
      return data.archiveWardrobeItem.id
    },
    onSuccess: (archivedItemId) => {
      queryClient.setQueryData<WardrobeItem[]>(
        queryKeys.wardrobe.list(),
        (currentItems = []) =>
          currentItems.filter((item) => item.id !== archivedItemId),
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.wardrobe.all })
    },
  })
}
