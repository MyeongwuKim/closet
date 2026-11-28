import type { ClothingClassificationResult } from '@closet/types'
import { getAccessToken } from '../../../lib/auth'
import { readImageDataUrl } from '../../../lib/readImageDataUrl'
import {
  GraphqlRequestError,
  graphqlRequest,
} from '../../../lib/graphql'

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
  const imageBase64 = await readImageDataUrl(file)
  signal.throwIfAborted()
  if (accessToken !== getAccessToken()) {
    throw new ClothingAnalysisError('로그인 상태가 바뀌었어요.', 'UNAUTHENTICATED')
  }
  return imageBase64
}

/** 원본 사진에서 옷 종류와 색상을 분류한다. 서버의 배경 제거는 요청하지 않는다. */
export async function classifyClothing(
  file: File,
  request: ImageAnalysisRequest,
): Promise<ClothingClassificationResult> {
  const imageBase64 = await readAnalysisImage(file, request)
  try {
    const payload = await graphqlRequest<
      { classifyWardrobeImage: ClothingClassificationResult },
      {
        input: {
          imageBase64: string
          mimeType: string
          filename: string
          includeCutout: false
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
          includeCutout: false,
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
        : '이미지 분석을 완료하지 못했어요.',
    )
  }
}
