import { useMutation } from '@tanstack/react-query'
import type { ClothingClassificationResult } from '@closet/types'
import {
  GraphqlRequestError,
  graphqlRequest,
} from '../../../lib/graphql'

export const clothingAnalysisMutationKey = [
  'wardrobe',
  'image-analysis',
] as const

export interface ClothingAnalysisResult extends ClothingClassificationResult {
  cutoutImageBase64: string | null
  cutoutMimeType: string | null
}

export interface WardrobeImageCutout {
  imageBase64: string
  mimeType: string
}

export class ClothingAnalysisError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ClothingAnalysisError'
    this.code = code
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'))
    reader.readAsDataURL(file)
  })
}

export async function classifyClothing(
  file: File,
): Promise<ClothingAnalysisResult> {
  const imageBase64 = await readFileAsDataUrl(file)
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
export async function removeClothingBackground(file: File): Promise<WardrobeImageCutout> {
  const imageBase64 = await readFileAsDataUrl(file)
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
    )
    return payload.removeWardrobeImageBackground
  } catch (error) {
    if (error instanceof GraphqlRequestError) {
      throw new ClothingAnalysisError(error.message, error.code)
    }
    throw new ClothingAnalysisError('사진 배경을 제거하지 못했습니다. 사진을 다시 추가해 주세요.')
  }
}

/** 별도 컷아웃 요청을 분류와 같은 분석 대기 상태에 포함한다. */
export function useRemoveClothingBackgroundMutation() {
  return useMutation({
    mutationKey: clothingAnalysisMutationKey,
    mutationFn: removeClothingBackground,
  })
}

export function useClassifyClothingMutation() {
  return useMutation({
    mutationKey: clothingAnalysisMutationKey,
    mutationFn: classifyClothing,
  })
}
