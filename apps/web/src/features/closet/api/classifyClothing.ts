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

export function useClassifyClothingMutation() {
  return useMutation({
    mutationKey: clothingAnalysisMutationKey,
    mutationFn: classifyClothing,
  })
}
