import type { ClothingClassificationResult } from '@closet/types'
import { getAccessToken } from '../../../lib/auth'
import {
  GraphqlRequestError,
  graphqlRequest,
} from '../../../lib/graphql'

export interface ClothingAnalysisResult extends ClothingClassificationResult {
  cutoutImageBase64: string | null
  cutoutMimeType: string | null
}

export interface WardrobeImageCutout {
  imageBase64: string
  mimeType: string
}

interface ImageAnalysisRequest {
  accessToken: string
  signal: AbortSignal
}

export class ClothingAnalysisError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ClothingAnalysisError'
    this.code = code
  }
}

/** 파일을 읽는 중 취소되거나 계정이 바뀌면 사진을 서버로 보내지 않는다. */
async function readAnalysisImage(file: File, { accessToken, signal }: ImageAnalysisRequest) {
  signal.throwIfAborted()
  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })
  signal.throwIfAborted()
  if (accessToken !== getAccessToken()) {
    throw new ClothingAnalysisError('로그인 상태가 바뀌었어요.', 'UNAUTHENTICATED')
  }
  return imageBase64
}

/** 선택한 옷의 분류 결과와 준비된 컷아웃을 읽는다. */
export async function classifyClothing(
  file: File,
  request: ImageAnalysisRequest,
): Promise<ClothingAnalysisResult> {
  const imageBase64 = await readAnalysisImage(file, request)
  try {
    const payload = await graphqlRequest<
      { classifyWardrobeImage: ClothingAnalysisResult },
      {
        input: {
          imageBase64: string
          mimeType: string
          filename: string
        }
      }
    >(
      `
        mutation ClassifyWardrobeImage($input: ClassifyWardrobeImageInput!) {
          classifyWardrobeImage(input: $input) {
            category
            categoryLabel
            subcategory
            subcategoryLabel
            suggestedName
            colorName
            colorDetailName
            colorHex
            colorRgb
            colorMode
            fashionAttributes {
              layerRole silhouette pattern material texture warmth formality confidence
              ribbedCuffs ribbedHem ribbedNeckline
              necklineStyle frontOpeningStyle pocketStyle
              bottomLegShape bottomWaistStyle bottomFrontPleats
            }
            confidence
            model
            cutoutImageBase64
            cutoutMimeType
            candidates {
              category
              subcategory
              label
              score
            }
          }
        }
      `,
      {
        input: {
          imageBase64,
          mimeType: file.type,
          filename: file.name,
        },
      },
      request.signal,
    )
    return payload.classifyWardrobeImage
  } catch (error) {
    if (error instanceof GraphqlRequestError) {
      throw new ClothingAnalysisError(error.message, error.code)
    }
    throw new ClothingAnalysisError(
      error instanceof Error
        ? error.message
        : '이미지 분석을 완료하지 못했습니다.',
    )
  }
}

/** 분류 실패 또는 응답의 컷아웃 누락 시 같은 사진의 배경 제거를 요청하고 PNG base64를 돌려준다. */
export async function removeClothingBackground(file: File, request: ImageAnalysisRequest): Promise<WardrobeImageCutout> {
  const imageBase64 = await readAnalysisImage(file, request)
  try {
    const payload = await graphqlRequest<
      { removeWardrobeImageBackground: WardrobeImageCutout },
      { input: { imageBase64: string; mimeType: string; filename: string } }
    >(
      `
        mutation RemoveWardrobeImageBackground($input: ClassifyWardrobeImageInput!) {
          removeWardrobeImageBackground(input: $input) { imageBase64 mimeType }
        }
      `,
      { input: { imageBase64, mimeType: file.type, filename: file.name } },
      request.signal,
    )
    return payload.removeWardrobeImageBackground
  } catch (error) {
    if (error instanceof GraphqlRequestError) {
      throw new ClothingAnalysisError(error.message, error.code)
    }
    throw new ClothingAnalysisError('사진 배경을 제거하지 못했습니다. 사진을 다시 추가해 주세요.')
  }
}
