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
const uploadedImages = new WeakMap<ClassificationCandidate, { token: string | null; asset: ImageAssetPayload }>()

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
      'Cloudflare 이미지 업로드에 실패했습니다.',
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
    throw new WardrobeSaveError('저장할 이미지를 읽지 못했습니다.')
  }

  const blob = await imageResponse.blob()
  const prepared = await prepareUpload(blob, kind, originalFilename, session)
  return uploadToCloudflare(blob, prepared, session)
}

/**
 * 확인된 옷 후보의 투명 PNG 한 장을 wardrobeCutout 자산으로 업로드한 뒤 옷장 아이템을 생성한다.
 * originalImageUrl 표식이 없으면 업로드 전에 거절하며, 원본 사진은 이 저장 요청에서 전송하지 않는다.
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
      '사진의 배경 제거가 끝나지 않았어요. 사진을 다시 추가해 주세요.',
      'WARDROBE_CUTOUT_REQUIRED',
    )
  }
  const originalFilename =
    candidate.originalFilename ?? `${input.name.replaceAll(' ', '_')}.png`
  const uploaded = uploadedImages.get(candidate)
  const displayAsset = uploaded?.token === session.token ? uploaded.asset : await uploadImage(
    candidate.imageUrl,
    'wardrobeCutout',
    originalFilename,
    session,
  )
  assertSaveSession(session)
  uploadedImages.set(candidate, { token: session.token, asset: displayAsset })

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
      // 영속 URL로 교체한 표시 이미지와 저장에 쓰지 않는 원본의 임시 URL을 해제한다.
      if (variables.candidate.imageUrl.startsWith('blob:') && item.imageUrl !== variables.candidate.imageUrl) URL.revokeObjectURL(variables.candidate.imageUrl)
      if (variables.candidate.originalImageUrl?.startsWith('blob:')) URL.revokeObjectURL(variables.candidate.originalImageUrl)
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
