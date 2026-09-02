/**
 * 용도:
 * 옷장 이미지의 형식과 크기를 확인하고 옷 분류·배경 제거·사이즈표 분석을 연결한다.
 *
 * 요청 흐름:
 * 이미지를 검증한 뒤 옷 분류 AI가 상품 사진과 사람 착용 사진을 구분하고,
 * 등록 가능한 상품 사진에는 분류 결과와 배경 제거 이미지를 함께 반환한다.
 */
import type { ClothingCategory } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import { removeImageBackground } from './backgroundRemover.js'
import { analyzeGarmentSizeChartWithOpenAi } from './openAiGarmentSizeAnalyzer.js'
import { classifyWardrobeImageWithOpenAi } from './openAiWardrobeClassifier.js'

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export interface ClassifyWardrobeImageInput {
  imageBase64: string
  mimeType: string
  filename?: string
}

export interface AnalyzeGarmentSizeChartInput
  extends ClassifyWardrobeImageInput {
  category: ClothingCategory
}

function decodeImage(input: ClassifyWardrobeImageInput) {
  if (!SUPPORTED_IMAGE_TYPES.has(input.mimeType)) {
    throw new ServiceError(
      'JPEG, PNG, WEBP 이미지만 분석할 수 있습니다.',
      'INVALID_IMAGE_TYPE',
    )
  }

  const base64Payload = input.imageBase64.includes(',')
    ? input.imageBase64.slice(input.imageBase64.indexOf(',') + 1)
    : input.imageBase64
  const image = Buffer.from(base64Payload, 'base64')

  if (image.byteLength === 0 || image.byteLength > MAX_IMAGE_SIZE) {
    throw new ServiceError(
      '이미지는 10MB 이하로 업로드해주세요.',
      'INVALID_IMAGE_SIZE',
    )
  }

  return image
}

export const classificationService = {
  async classify(input: ClassifyWardrobeImageInput) {
    const image = decodeImage(input)

    const [classification, cutout] = await Promise.all([
      classifyWardrobeImageWithOpenAi(image, input.mimeType),
      removeImageBackground(image, input.mimeType).catch(() => null),
    ])

    return {
      ...classification,
      cutoutImageBase64: cutout?.base64 ?? null,
      cutoutMimeType: cutout?.mimeType ?? null,
    }
  },
  async analyzeSizeChart(input: AnalyzeGarmentSizeChartInput) {
    const image = decodeImage(input)
    return analyzeGarmentSizeChartWithOpenAi(
      image,
      input.mimeType,
      input.category,
    )
  },
}
