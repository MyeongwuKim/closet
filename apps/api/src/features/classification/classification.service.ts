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
  /**
   * 옷 분류가 실패해도 수동 입력에 사용할 투명 PNG를 따로 만든다.
   * 배경 제거가 실패하면 한 번 더 시도하고, 두 번 모두 실패하면 원본 등록을 막을 수 있도록 오류를 돌려준다.
   */
  async createCutout(input: ClassifyWardrobeImageInput) {
    const image = decodeImage(input)
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const cutout = await removeImageBackground(image, input.mimeType)
        return { imageBase64: cutout.base64, mimeType: cutout.mimeType }
      } catch {
        if (attempt === 1) {
          throw new ServiceError(
            '사진의 배경을 제거하지 못했어요. 사진을 다시 추가해 주세요.',
            'BACKGROUND_REMOVAL_FAILED',
          )
        }
      }
    }
    throw new ServiceError('사진의 배경을 제거하지 못했어요.', 'BACKGROUND_REMOVAL_FAILED')
  },

  /**
   * 옷 분류와 배경 제거를 함께 실행하고 둘 다 끝난 뒤 분류 결과를 반환한다.
   * 분류가 실패하면 오류를 전파하며, 배경 제거만 실패하면 컷아웃 필드를 null로 돌려 별도 재요청을 허용한다.
   */
  async classify(input: ClassifyWardrobeImageInput) {
    const image = decodeImage(input)

    // 분류가 먼저 실패해도 배경 제거 작업이 끝난 뒤 오류를 전달해 같은 모델을 겹쳐 실행하지 않는다.
    const [classificationResult, cutoutResult] = await Promise.allSettled([
      classifyWardrobeImageWithOpenAi(image, input.mimeType),
      removeImageBackground(image, input.mimeType),
    ])
    if (classificationResult.status === 'rejected') throw classificationResult.reason
    const cutout = cutoutResult.status === 'fulfilled' ? cutoutResult.value : null

    return {
      ...classificationResult.value,
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
