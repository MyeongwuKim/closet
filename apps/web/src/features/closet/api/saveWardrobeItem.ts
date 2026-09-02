import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  ClothingCategory,
  ColorMode,
  FashionItemAttributes,
  Season,
  WardrobeItem,
} from '@closet/types'
import type { ClassificationCandidate } from '../../../stores/useUiStore'
import { graphqlRequest } from '../../../lib/graphql'
import { queryKeys } from '../../../lib/queryKeys'

interface ImageAssetPayload {
  id: string
  deliveryUrl: string | null
}

interface PreparedUploadPayload {
  asset: ImageAssetPayload
  uploadUrl: string
  uploadFilename: string
}

interface WardrobeItemPayload {
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
  displayImageAsset: ImageAssetPayload | null
}

export interface SaveWardrobeItemInput {
  name: string
  category: ClothingCategory
  additionalCategories: ClothingCategory[]
  subcategory: string
  colorName: string
  colorDetailName?: string | null
  colorHex: string
  colorMode?: ColorMode | null
  seasons: Season[]
  tags: string[]
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

export interface SaveWardrobeItemVariables {
  candidate: ClassificationCandidate
  input: SaveWardrobeItemInput
}

export class WardrobeSaveError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'WardrobeSaveError'
    this.code = code
  }
}

async function prepareUpload(
  blob: Blob,
  kind: 'wardrobeOriginal' | 'wardrobeCutout',
  originalFilename: string,
) {
  const data = await graphqlRequest<{
    prepareImageUpload: PreparedUploadPayload
  }>(
    `
      mutation PrepareImageUpload($input: PrepareImageUploadInput!) {
        prepareImageUpload(input: $input) {
          uploadUrl
          uploadFilename
          asset { id deliveryUrl }
        }
      }
    `,
    {
      input: {
        kind,
        originalFilename,
        mimeType: blob.type,
      },
    },
  )

  return data.prepareImageUpload
}

async function uploadToCloudflare(
  blob: Blob,
  prepared: PreparedUploadPayload,
) {
  const form = new FormData()
  form.append('file', blob, prepared.uploadFilename)
  const response = await fetch(prepared.uploadUrl, {
    method: 'POST',
    body: form,
  })

  if (!response.ok) {
    throw new WardrobeSaveError(
      'Cloudflare 이미지 업로드에 실패했습니다.',
      'CLOUDFLARE_UPLOAD_FAILED',
    )
  }

  const data = await graphqlRequest<{ confirmImageUpload: ImageAssetPayload }>(
    `
      mutation ConfirmImageUpload($assetId: ID!) {
        confirmImageUpload(assetId: $assetId) { id deliveryUrl }
      }
    `,
    { assetId: prepared.asset.id },
  )

  return data.confirmImageUpload
}

async function uploadImage(
  imageUrl: string,
  kind: 'wardrobeOriginal' | 'wardrobeCutout',
  originalFilename: string,
) {
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new WardrobeSaveError('저장할 이미지를 읽지 못했습니다.')
  }

  const blob = await imageResponse.blob()
  const prepared = await prepareUpload(blob, kind, originalFilename)
  return uploadToCloudflare(blob, prepared)
}

export async function saveWardrobeItem(
  candidate: ClassificationCandidate,
  input: SaveWardrobeItemInput,
): Promise<WardrobeItem> {
  const originalFilename =
    candidate.originalFilename ?? `${input.name.replaceAll(' ', '_')}.png`
  const hasSeparateOriginal = Boolean(candidate.originalImageUrl)
  const displayAsset = await uploadImage(
    candidate.imageUrl,
    hasSeparateOriginal ? 'wardrobeCutout' : 'wardrobeOriginal',
    originalFilename,
  )

  const data = await graphqlRequest<{ createWardrobeItem: WardrobeItemPayload }>(
    `
      mutation CreateWardrobeItem($input: CreateWardrobeItemInput!) {
        createWardrobeItem(input: $input) {
          id name createdAt category additionalCategories subcategory colorName colorDetailName
          colorHex colorMode seasons tags
          fashionAttributes {
            layerRole silhouette pattern material texture warmth formality confidence
            ribbedCuffs ribbedHem ribbedNeckline
          }
          sizeLabel shoulderWidthCm chestWidthCm sleeveLengthCm
          totalLengthCm waistWidthCm hipWidthCm inseamCm
          thighWidthCm riseCm hemWidthCm
          classificationStatus wearCount lastWornAt
          displayImageAsset { id deliveryUrl }
        }
      }
    `,
    {
      input: {
        ...input,
        displayImageAssetId: displayAsset.id,
        classificationStatus: 'classified',
        classificationConfidence: candidate.confidence,
        classificationModel: candidate.model,
        fashionAttributes: candidate.fashionAttributes,
      },
    },
  )
  const item = data.createWardrobeItem

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
    imageUrl: item.displayImageAsset?.deliveryUrl ?? candidate.imageUrl,
    lastWornAt: item.lastWornAt ?? undefined,
    wearCount: item.wearCount,
  }
}

export function useSaveWardrobeItemMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ candidate, input }: SaveWardrobeItemVariables) =>
      saveWardrobeItem(candidate, input),
    onSuccess: (item) => {
      queryClient.setQueryData<WardrobeItem[]>(
        queryKeys.wardrobe.list(),
        (currentItems = []) => [
          item,
          ...currentItems.filter((currentItem) => currentItem.id !== item.id),
        ],
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.wardrobe.all })
    },
  })
}
