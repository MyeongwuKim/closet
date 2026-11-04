import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  Season,
  StoredOutfitPreview,
} from '@closet/types'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'
import {
  toWardrobeItem,
  wardrobeItemFields,
  type WardrobeItemPayload,
} from '../../closet/api/wardrobeQueries'
import type { SavedOutfit } from '../types'
import { toOutfitPreviewImageInput, type OutfitPreviewImageInput } from '../utils/outfitPreviewInput'
import { invalidateCompletedOutfitPreviews } from '../utils/completedPreviewCache'
import { isCompletedPreviewUnavailable } from '../utils/completedPreviewPointer'
import { removeCachedOutfitPreviewAsset } from '../utils/outfitPreviewCache'
import { removeRecommendationPreviewAsset } from '../../plan/utils/recommendationPreviewCache'

export interface OutfitPayload {
  id: string
  name: string
  style: string
  seasons: Season[]
  createdAt: string
  items: Array<{
    wardrobeItemId: string
    layerOrder: number
    wardrobeItem?: WardrobeItemPayload
  }>
  generations: Array<{
    status: 'queued' | 'processing' | 'completed' | 'failed'
    imageAsset: { deliveryUrl: string | null } | null
  }>
}

export interface CreateOutfitVariables {
  name: string
  style: string
  seasons: Season[]
  items: Array<{
    wardrobeItemId: string
    layerOrder: number
  }>
  previewImage?: OutfitPreviewImageInput
  previewImageAssetId?: string
}

export type UpdateOutfitVariables = Pick<
  CreateOutfitVariables,
  'name' | 'style' | 'seasons' | 'items' | 'previewImage'
> & { id: string }

/** 조회·저장 응답의 옷 관계를 코디에 보관해 활성 옷장 조회가 삭제 옷의 사진을 덮어쓰지 않게 한다. */
export function toSavedOutfit(outfit: OutfitPayload): SavedOutfit {
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
    outfitItems: outfit.items.flatMap((item) => item.wardrobeItem ? [toWardrobeItem(item.wardrobeItem)] : []),
    previewImageUrl: previewImageUrl ?? undefined,
  }
}

export function useOutfitsQuery(enabled = true, filter?: { style?: string; wardrobeItemIds?: string[] }) {
  return useQuery({
    queryKey: queryKeys.outfits.list(filter),
    enabled,
    queryFn: async ({ signal }) => {
      const data = await graphqlRequest<{ outfits: OutfitPayload[] }>(
        `
          query Outfits($style: String, $wardrobeItemIds: [ID!]) {
            outfits(style: $style, wardrobeItemIds: $wardrobeItemIds) {
              id name style seasons createdAt
              items { wardrobeItemId layerOrder wardrobeItem { ${wardrobeItemFields} } }
              generations { status imageAsset { deliveryUrl } }
            }
          }
        `,
        filter,
        signal,
      )
      return data.outfits.map(toSavedOutfit)
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
              items { wardrobeItemId layerOrder wardrobeItem { ${wardrobeItemFields} } }
              generations { status imageAsset { deliveryUrl } }
            }
          }
        `,
        { input: { ...input, previewImage: toOutfitPreviewImageInput(input.previewImage) } },
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.wardrobe.all })
      void invalidateCompletedOutfitPreviews(queryClient)
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
              items { wardrobeItemId layerOrder wardrobeItem { ${wardrobeItemFields} } }
              generations { status imageAsset { deliveryUrl } }
            }
          }
        `,
        { id, input: { ...input, previewImage: toOutfitPreviewImageInput(input.previewImage) } },
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.wardrobe.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.planner.all })
      void invalidateCompletedOutfitPreviews(queryClient)
    },
  })
}

export function useDeleteOutfitMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await graphqlRequest<{ deleteOutfit: boolean }, { id: string }>(
        `
          mutation DeleteOutfit($id: ID!) {
            deleteOutfit(id: $id)
          }
        `,
        { id },
      )
      return id
    },
    onSuccess: (deletedOutfitId) => {
      queryClient.setQueryData<SavedOutfit[]>(
        queryKeys.outfits.list(),
        (currentOutfits = []) =>
          currentOutfits.filter((outfit) => outfit.id !== deletedOutfitId),
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.outfits.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.wardrobe.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.planner.all })
      void invalidateCompletedOutfitPreviews(queryClient)
    },
  })
}

/** 각 화면의 이미지 생성을 재연결 가능한 서버 작업에 맡긴다. */
export { useGenerateOutfitPreviewJobMutation as useGenerateOutfitPreviewMutation } from './previewJobQueries'

export function useOutfitPreviewAssetQuery(assetId?: string | null) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.outfits.previewAsset(assetId ?? ''),
    enabled: Boolean(assetId),
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: (failures, error) => failures < 1 && !isCompletedPreviewUnavailable(error),
    queryFn: async ({ signal }) => {
      const viewerId = client.getQueryData<{ id: string }>(queryKeys.me)?.id
      try {
        const data = await graphqlRequest<
          { outfitPreviewAsset: StoredOutfitPreview },
          { id: string }
        >(
          `
            query OutfitPreviewAsset($id: ID!) {
              outfitPreviewAsset(id: $id) {
                assetId imageUrl mimeType model
              }
            }
          `,
          { id: assetId! }, signal,
        )
        return data.outfitPreviewAsset
      } catch (error) {
        if (isCompletedPreviewUnavailable(error)) {
          client.setQueryData(queryKeys.outfits.previewAsset(assetId!), null)
          if (viewerId) {
            removeCachedOutfitPreviewAsset(viewerId, assetId!)
            removeRecommendationPreviewAsset(viewerId, assetId!)
          }
        }
        throw error
      }
    },
  })
  // 알림 경로로 다시 열 때도 서버 확인 전·삭제 확정 뒤의 이전 URL을 화면에 복원하지 않는다.
  return { ...query, data: query.isFetching || (query.isError && isCompletedPreviewUnavailable(query.error)) ? undefined : query.data }
}
