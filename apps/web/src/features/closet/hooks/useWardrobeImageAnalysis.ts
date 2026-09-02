import { useIsMutating } from '@tanstack/react-query'
import { useUiStore } from '../../../stores/useUiStore'
import {
  ClothingAnalysisError,
  clothingAnalysisMutationKey,
  useClassifyClothingMutation,
} from '../api/classifyClothing'
import {
  MAX_CLOTHING_IMAGE_SIZE,
  SUPPORTED_CLOTHING_IMAGE_TYPES,
} from '../constants'

const rejectedImageCodes = new Set([
  'PERSON_DETECTED',
  'FASHION_ITEM_NOT_DETECTED',
  'MULTIPLE_FASHION_ITEMS_DETECTED',
  'UNCLEAR_FASHION_IMAGE',
])

function createImageObjectUrl(base64: string, mimeType: string) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}

export function useWardrobeImageAnalysis() {
  const enqueueClassification = useUiStore(
    (state) => state.enqueueClassification,
  )
  const pushToast = useUiStore((state) => state.pushToast)
  const classifyClothing = useClassifyClothingMutation()
  const analyzingCount = useIsMutating({
    mutationKey: clothingAnalysisMutationKey,
  })

  const analyzeImages = (files: File[]) => {
    if (files.length === 0) return false

    const validFiles = files.filter(
      (file) =>
        SUPPORTED_CLOTHING_IMAGE_TYPES.some((type) => type === file.type) &&
        file.size <= MAX_CLOTHING_IMAGE_SIZE,
    )

    if (validFiles.length === 0) {
      pushToast('10MB 이하의 JPEG, PNG, WEBP만 추가할 수 있습니다.', 'error')
      return false
    }

    const createdAt = Date.now()
    const pendingUploads = validFiles.map((file, index) => ({
      id: `upload-${createdAt}-${index}`,
      name: '새 옷',
      imageUrl: URL.createObjectURL(file),
    }))

    pushToast('AI가 옷 사진을 살펴보고 있어요 👀', 'info')

    if (validFiles.length !== files.length) {
      pushToast('일부 파일은 형식 또는 10MB 제한 때문에 제외했습니다.', 'error')
    }

    validFiles.forEach((file, index) => {
      const item = pendingUploads[index]

      void classifyClothing
        .mutateAsync(file)
        .then((classification) => {
          const cutoutImageUrl =
            classification.cutoutImageBase64 && classification.cutoutMimeType
              ? createImageObjectUrl(
                  classification.cutoutImageBase64,
                  classification.cutoutMimeType,
                )
              : null

          if (!cutoutImageUrl) {
            pushToast(
              `${item.name}의 배경을 제거하지 못해 원본으로 표시합니다.`,
              'error',
            )
          }

          enqueueClassification({
            itemId: item.id,
            imageUrl: cutoutImageUrl ?? item.imageUrl,
            originalImageUrl: cutoutImageUrl ? item.imageUrl : undefined,
            originalFilename: file.name,
            itemName:
              classification.suggestedName.trim() ||
              [classification.colorName, classification.subcategoryLabel]
                .map((value) => value.trim())
                .filter(Boolean)
                .join(' ') ||
              '새 옷',
            category: classification.category,
            subcategory: classification.subcategoryLabel,
            colorName: classification.colorName,
            colorDetailName: classification.colorDetailName,
            colorHex: classification.colorHex,
            colorRgb: classification.colorRgb,
            colorMode: classification.colorMode,
            fashionAttributes: classification.fashionAttributes ?? null,
            confidence: classification.confidence,
            model: classification.model,
            candidates: classification.candidates,
            analysisFailed: false,
          })
        })
        .catch((error: unknown) => {
          if (
            error instanceof ClothingAnalysisError &&
            error.code &&
            rejectedImageCodes.has(error.code)
          ) {
            URL.revokeObjectURL(item.imageUrl)
            pushToast(error.message, 'error')
            return
          }

          const message =
            error instanceof Error
              ? error.message
              : 'AI 이미지 분석에 실패했습니다.'

          pushToast(message, 'error')
          enqueueClassification({
            itemId: item.id,
            imageUrl: item.imageUrl,
            originalFilename: file.name,
            itemName: item.name,
            category: null,
            subcategory: '',
            colorName: '',
            colorDetailName: '',
            colorHex: '#d9d5cc',
            colorRgb: [217, 213, 204],
            colorMode: null,
            fashionAttributes: null,
            confidence: null,
            model: null,
            candidates: [],
            analysisFailed: true,
          })
        })
    })

    return true
  }

  return { analyzeImages, analyzingCount }
}
