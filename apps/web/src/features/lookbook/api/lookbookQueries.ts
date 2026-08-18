import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  ClothingCategory,
  OutfitMatchRelation,
  OutfitPreview,
  OutfitRecommendation,
  Season,
} from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import {
  toWardrobeItem,
  wardrobeItemFields,
  type WardrobeItemPayload,
} from '../../closet/api/wardrobeQueries'
import type { SavedOutfit } from '../types'

interface OutfitPayload {
  id: string
  name: string
  style: string
  seasons: Season[]
  createdAt: string
  items: Array<{
    wardrobeItemId: string
    layerOrder: number
  }>
  generations: Array<{
    status: 'queued' | 'processing' | 'completed' | 'failed'
    imageAsset: { deliveryUrl: string | null } | null
  }>
}

interface OutfitRecommendationPayload {
  targetCategory: ClothingCategory
  headline: string
  summary: string
  recommendedColors: Array<{
    name: string
    hex: string
    reason: string
    role: 'safe' | 'harmony' | 'accent'
  }>
  candidates: Array<{
    item: WardrobeItemPayload
    reason: string
    relation: OutfitMatchRelation
  }>
  model: string
  source: OutfitRecommendation['source']
}

export interface CreateOutfitVariables {
  name: string
  style: string
  seasons: Season[]
  items: Array<{
    wardrobeItemId: string
    layerOrder: number
  }>
  previewImage?: {
    imageBase64: string
    mimeType: OutfitPreview['mimeType']
    model: string
  }
}

export type UpdateOutfitVariables = Pick<
  CreateOutfitVariables,
  'name' | 'style' | 'seasons' | 'items' | 'previewImage'
> & { id: string }

function toSavedOutfit(outfit: OutfitPayload): SavedOutfit {
  const previewImageUrl = outfit.generations.find(
    (generation) =>
      generation.status === 'completed' && generation.imageAsset?.deliveryUrl,
  )?.imageAsset?.deliveryUrl

  return {
    id: outfit.id,
    name: outfit.name,
    style: outfit.style,
    seasons: outfit.seasons,
    createdAt: outfit.createdAt,
    layers: outfit.items.map((item) => ({
      wardrobeItemId: item.wardrobeItemId,
      order: item.layerOrder,
    })),
    previewImageUrl: previewImageUrl ?? undefined,
  }
}

export function useOutfitsQuery() {
  return useQuery({
    queryKey: queryKeys.outfits.list(),
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<{ outfits: OutfitPayload[] }>(
        `
          query Outfits {
            outfits {
              id name style seasons createdAt
              items { wardrobeItemId layerOrder }
              generations { status imageAsset { deliveryUrl } }
            }
          }
        `,
        undefined,
        signal,
      )
      return data.outfits.map(toSavedOutfit)
    },
  })
}

export function useOutfitRecommendationQuery(
  selectedItemIds: string[],
  targetCategory: ClothingCategory | null,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.outfits.recommendation(
      selectedItemIds,
      targetCategory,
    ),
    enabled:
      enabled && selectedItemIds.length > 0 && targetCategory !== null,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }): Promise<OutfitRecommendation> => {
      if (!targetCategory) {
        throw new Error('추천받을 옷 종류를 선택해주세요.')
      }

      const data = await graphqlRequest<
        { outfitRecommendation: OutfitRecommendationPayload },
        {
          input: {
            selectedItemIds: string[]
            targetCategory: ClothingCategory
          }
        }
      >(
        `
          query OutfitRecommendation($input: OutfitRecommendationInput!) {
            outfitRecommendation(input: $input) {
              targetCategory headline summary model source
              recommendedColors { name hex reason role }
              candidates {
                reason relation
                item { ${wardrobeItemFields} }
              }
            }
          }
        `,
        { input: { selectedItemIds, targetCategory } },
        signal,
      )
      const recommendation = data.outfitRecommendation
      return {
        ...recommendation,
        candidates: recommendation.candidates.map((candidate) => ({
          ...candidate,
          item: toWardrobeItem(candidate.item),
        })),
      }
    },
  })
}

export function useCreateOutfitMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateOutfitVariables) => {
      const data = await graphqlRequest<
        { createOutfit: OutfitPayload },
        { input: CreateOutfitVariables }
      >(
        `
          mutation CreateOutfit($input: CreateOutfitInput!) {
            createOutfit(input: $input) {
              id name style seasons createdAt
              items { wardrobeItemId layerOrder }
              generations { status imageAsset { deliveryUrl } }
            }
          }
        `,
        { input },
      )
      return toSavedOutfit(data.createOutfit)
    },
    onSuccess: (outfit) => {
      queryClient.setQueryData<SavedOutfit[]>(
        queryKeys.outfits.list(),
        (currentOutfits = []) => [
          outfit,
          ...currentOutfits.filter(
            (currentOutfit) => currentOutfit.id !== outfit.id,
          ),
        ],
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.outfits.all })
    },
  })
}

export function useUpdateOutfitMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateOutfitVariables) => {
      const data = await graphqlRequest<
        { updateOutfit: OutfitPayload },
        { id: string; input: Omit<UpdateOutfitVariables, 'id'> }
      >(
        `
          mutation UpdateOutfit($id: ID!, $input: UpdateOutfitInput!) {
            updateOutfit(id: $id, input: $input) {
              id name style seasons createdAt
              items { wardrobeItemId layerOrder }
              generations { status imageAsset { deliveryUrl } }
            }
          }
        `,
        { id, input },
      )
      return toSavedOutfit(data.updateOutfit)
    },
    onSuccess: (outfit) => {
      queryClient.setQueryData<SavedOutfit[]>(
        queryKeys.outfits.list(),
        (currentOutfits = []) =>
          currentOutfits.map((currentOutfit) =>
            currentOutfit.id === outfit.id ? outfit : currentOutfit,
          ),
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.outfits.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.planner.all })
    },
  })
}

export function useGenerateOutfitPreviewMutation() {
  return useMutation({
    mutationFn: async (selectedItemIds: string[]) => {
      const data = await graphqlRequest<
        { generateOutfitPreview: OutfitPreview },
        { input: { selectedItemIds: string[] } }
      >(
        `
          mutation GenerateOutfitPreview($input: OutfitPreviewInput!) {
            generateOutfitPreview(input: $input) {
              imageBase64 mimeType model
            }
          }
        `,
        { input: { selectedItemIds } },
      )
      return data.generateOutfitPreview
    },
  })
}
