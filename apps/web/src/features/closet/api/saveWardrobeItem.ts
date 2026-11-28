import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getAccessToken } from '../../../lib/auth'
import { advanceOutfitRecommendationRevision } from '../../lookbook/api/outfitRecommendationCache'
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
  brandName: string | null
  storageLocation?: string | null
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
  brandName?: string | null
  storageLocation?: string | null
  category: ClothingCategory
  additionalCategories: ClothingCategory[]
  subcategory: string
  colorName: string
  colorDetailName?: string | null
  colorHex: string
  colorMode?: ColorMode | null
  fashionAttributes: FashionItemAttributes
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
  signal?: AbortSignal
}

export class WardrobeSaveError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'WardrobeSaveError'
    this.code = code
  }
}

interface SaveSession { token: string | null; signal?: AbortSignal }
const uploadedImages = new WeakMap<ClassificationCandidate, {
  token: string | null
  original?: ImageAssetPayload
  cutout?: ImageAssetPayload
}>()

/** 각 업로드 단계와 결과 반영 전에 같은 로그인 세션인지 확인한다. */
function assertSaveSession(session: SaveSession) {
  if (session.signal?.aborted || session.token !== getAccessToken()) {
    throw new WardrobeSaveError('로그인 상태가 바뀌어 등록을 중단했어요.', 'REGISTRATION_SESSION_CHANGED')
  }
}

async function prepareUpload(
  blob: Blob,
  kind: 'wardrobeOriginal' | 'wardrobeCutout',
  originalFilename: string,
  session: SaveSession,
) {
  assertSaveSession(session)
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
    session.signal,
  )

  assertSaveSession(session)
  return data.prepareImageUpload
}

async function uploadToCloudflare(
  blob: Blob,
  prepared: PreparedUploadPayload,
  session: SaveSession,
) {
  assertSaveSession(session)
  const form = new FormData()
  form.append('file', blob, prepared.uploadFilename)
  const response = await fetch(prepared.uploadUrl, {
    method: 'POST',
    body: form,
    signal: session.signal,
  })

  if (!response.ok) {
    throw new WardrobeSaveError(
      '사진을 올리지 못했어요.',
      'CLOUDFLARE_UPLOAD_FAILED',
    )
  }

  assertSaveSession(session)
  const data = await graphqlRequest<{ confirmImageUpload: ImageAssetPayload }>(
    `
      mutation ConfirmImageUpload($assetId: ID!) {
        confirmImageUpload(assetId: $assetId) { id deliveryUrl }
      }
    `,
    { assetId: prepared.asset.id },
    session.signal,
  )

  assertSaveSession(session)
  return data.confirmImageUpload
}

async function uploadImage(
  imageUrl: string,
  kind: 'wardrobeOriginal' | 'wardrobeCutout',
  originalFilename: string,
  session: SaveSession,
) {
  assertSaveSession(session)
  const imageResponse = await fetch(imageUrl, { signal: session.signal })
  if (!imageResponse.ok) {
    throw new WardrobeSaveError('저장할 이미지를 읽지 못했어요.')
  }

  const blob = await imageResponse.blob()
  const prepared = await prepareUpload(blob, kind, originalFilename, session)
  return uploadToCloudflare(blob, prepared, session)
}

/**
 * 원본은 항상 저장하며 누끼를 선택했을 때만 표시용 PNG를 추가로 저장한다.
 * 같은 후보의 저장을 다시 시도하면 업로드를 마친 자산을 재사용한다.
 */
export async function saveWardrobeItem(
  candidate: ClassificationCandidate,
  input: SaveWardrobeItemInput,
  signal?: AbortSignal,
): Promise<WardrobeItem> {
  const session: SaveSession = { token: getAccessToken(), signal }
  assertSaveSession(session)
  if (!candidate.originalImageUrl) {
    throw new WardrobeSaveError(
      '원본 사진을 읽지 못했어요. 사진을 다시 추가해주세요.',
      'WARDROBE_ORIGINAL_REQUIRED',
    )
  }
  const originalFilename =
    candidate.originalFilename ?? `${input.name.replaceAll(' ', '_')}.png`
  let uploaded = uploadedImages.get(candidate)
  if (!uploaded || uploaded.token !== session.token) {
    uploaded = { token: session.token }
    uploadedImages.set(candidate, uploaded)
  }
  const originalAsset = uploaded.original ?? await uploadImage(candidate.originalImageUrl, 'wardrobeOriginal', originalFilename, session)
  assertSaveSession(session)
  uploaded.original = originalAsset

  const hasCutout = candidate.imageUrl !== candidate.originalImageUrl
  const displayAsset = hasCutout
    ? uploaded.cutout ?? await uploadImage(candidate.imageUrl, 'wardrobeCutout', originalFilename, session)
    : originalAsset
  assertSaveSession(session)
  if (hasCutout) uploaded.cutout = displayAsset

  const data = await graphqlRequest<{ createWardrobeItem: WardrobeItemPayload }>(
    `
      mutation CreateWardrobeItem($input: CreateWardrobeItemInput!) {
        createWardrobeItem(input: $input) {
          id name brandName createdAt category additionalCategories subcategory colorName colorDetailName
          colorHex colorMode seasons tags storageLocation
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
          displayImageAsset { id deliveryUrl }
        }
      }
    `,
    {
      input: {
        ...input,
        displayImageAssetId: displayAsset.id,
        originalImageAssetId: originalAsset.id,
        registrationRequestId: candidate.itemId,
        classificationStatus: 'classified',
        classificationConfidence: candidate.confidence,
        classificationModel: candidate.model,
        fashionAttributes: input.fashionAttributes,
      },
    },
    signal,
  )
  assertSaveSession(session)
  const item = data.createWardrobeItem

  return {
    id: item.id,
    name: item.name,
    brandName: item.brandName ?? undefined,
    storageLocation: item.storageLocation ?? null,
    createdAt: item.createdAt,
    category: item.category,
    additionalCategories: item.additionalCategories,
    subcategory: item.subcategory ?? undefined,
    colorName: item.colorName ?? '',
    colorDetailName: item.colorDetailName ?? undefined,
    colorHex: item.colorHex ?? '',
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

/** 일괄 등록은 각 성공 결과를 반영한 뒤 마지막에 조회 무효화를 한 번 수행한다. */
export function invalidateSavedWardrobeQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.wardrobe.all })
  void queryClient.invalidateQueries({ queryKey: ['planner', 'today-recommendation'], refetchType: 'none' })
  void queryClient.invalidateQueries({ queryKey: ['outfits', 'recommendation'], refetchType: 'none' })
}

export function useSaveWardrobeItemMutation(options: { deferInvalidation?: boolean } = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    onMutate: () => ({ token: getAccessToken() }),
    mutationFn: ({ candidate, input, signal }: SaveWardrobeItemVariables) =>
      saveWardrobeItem(candidate, input, signal),
    onSuccess: (item, variables, session) => {
      if (session?.token !== getAccessToken()) return
      // 영속 URL로 교체된 임시 사진은 원본과 표시가 같아도 한 번만 해제한다.
      for (const url of new Set([variables.candidate.imageUrl, variables.candidate.originalImageUrl])) {
        if (url?.startsWith('blob:') && url !== item.imageUrl) URL.revokeObjectURL(url)
      }
      advanceOutfitRecommendationRevision(queryClient)
      queryClient.setQueryData<WardrobeItem[]>(
        queryKeys.wardrobe.list(),
        (currentItems = []) => [
          item,
          ...currentItems.filter((currentItem) => currentItem.id !== item.id),
        ],
      )
      if (!options.deferInvalidation) invalidateSavedWardrobeQueries(queryClient)
    },
  })
}
