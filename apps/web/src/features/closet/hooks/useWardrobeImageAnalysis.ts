import { useIsMutating } from '@tanstack/react-query'
import { useUiStore } from '../../../stores/useUiStore'
import {
  ClothingAnalysisError,
  clothingAnalysisMutationKey,
  useClassifyClothingMutation,
  useRemoveClothingBackgroundMutation,
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

/** 서버가 돌려준 컷아웃 바이트를 확인 모달에서 읽을 수 있는 임시 URL로 바꾼다. */
function createImageObjectUrl(base64: string, mimeType: string) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}

/**
 * 옷장에 추가한 사진을 분류하고, 투명 컷아웃이 준비된 후보만 확인 모달의 대기열에 넣는다.
 * 분류만 실패하면 컷아웃을 별도로 받아 수동 입력을 유지하고, 배경 제거까지 실패하면 원본 URL을 해제한 뒤 등록을 중단한다.
 * analyzingCount는 진행 중인 분류·배경 제거 mutation의 수이며, 실제 저장은 이 훅에서 수행하지 않는다.
 */
export function useWardrobeImageAnalysis() {
  const enqueueClassification = useUiStore(
    (state) => state.enqueueClassification,
  )
  const pushToast = useUiStore((state) => state.pushToast)
  const classifyClothing = useClassifyClothingMutation()
  const removeBackground = useRemoveClothingBackgroundMutation()
  const analyzingCount = useIsMutating({
    mutationKey: clothingAnalysisMutationKey,
  })

  /**
   * 형식·크기 조건에 맞는 파일마다 비동기 분석을 시작한다.
   * 반환값 true는 분석 요청을 시작했다는 뜻이며, 컷아웃 생성이나 옷장 저장 완료를 뜻하지 않는다.
   */
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
      let cutoutImageUrl: string | null = null

      // 분류 실패와 배경 제거 실패를 분리해, 컷아웃이 준비되면 기존 수동 입력을 유지한다.
      void (async () => {
        let classification: Awaited<ReturnType<typeof classifyClothing.mutateAsync>> | null = null
        let classificationError: unknown = null
        try {
          classification = await classifyClothing.mutateAsync(file)
        } catch (error) {
          if (
            error instanceof ClothingAnalysisError &&
            error.code &&
            rejectedImageCodes.has(error.code)
          ) {
            URL.revokeObjectURL(item.imageUrl)
            pushToast(error.message, 'error')
            return
          }
          classificationError = error
        }

        try {
          if (classification?.cutoutImageBase64 && classification.cutoutMimeType) {
            cutoutImageUrl = createImageObjectUrl(
              classification.cutoutImageBase64,
              classification.cutoutMimeType,
            )
          } else {
            const cutout = await removeBackground.mutateAsync(file)
            cutoutImageUrl = createImageObjectUrl(cutout.imageBase64, cutout.mimeType)
          }
        } catch {
          URL.revokeObjectURL(item.imageUrl)
          pushToast('사진의 배경을 제거하지 못했어요. 사진을 다시 추가해 주세요.', 'error')
          return
        }

        if (!classification) {
          pushToast(
            classificationError instanceof Error
              ? classificationError.message
              : 'AI 분석에 실패했습니다. 옷 정보를 직접 입력해 주세요.',
            'error',
          )
          enqueueClassification({
            itemId: item.id,
            imageUrl: cutoutImageUrl,
            originalImageUrl: item.imageUrl,
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
          return
        }

        enqueueClassification({
          itemId: item.id,
          imageUrl: cutoutImageUrl,
          originalImageUrl: item.imageUrl,
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
      })().catch(() => {
        // 큐에 넣기 전의 예외가 생겨도 임시 이미지 URL을 남기지 않는다.
        URL.revokeObjectURL(item.imageUrl)
        if (cutoutImageUrl) URL.revokeObjectURL(cutoutImageUrl)
        pushToast('사진을 분석하지 못했어요. 사진을 다시 추가해 주세요.', 'error')
      })
    })

    return true
  }

  return { analyzeImages, analyzingCount }
}
