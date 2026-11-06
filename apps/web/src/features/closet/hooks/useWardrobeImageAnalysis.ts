import { create } from 'zustand'
import { getAccessToken } from '../../../lib/auth'
import { useUiStore } from '../../../stores/useUiStore'
import {
  ClothingAnalysisError,
  classifyClothing,
  removeClothingBackground,
  type ClothingAnalysisResult,
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
  'INVALID_IMAGE_TYPE',
  'INVALID_IMAGE_SIZE',
  'INVALID_IMAGE_DATA',
])

const stopClassificationCodes = new Set([
  ...rejectedImageCodes,
  'AI_BUSY',
  'AI_RATE_LIMITED',
  'UNAUTHENTICATED',
])

interface QueuedPhoto {
  id: string
  file: File
}

interface FailedWardrobePhoto extends QueuedPhoto {
  message: string
}

interface PhotoAnalysisSession {
  accessToken: string
  controller: AbortController
  photos: QueuedPhoto[]
}

interface WardrobeImageAnalysis {
  /** 지금 분석 중이거나 차례를 기다리는 사진 수다. */
  analyzingCount: number
  failedPhotos: FailedWardrobePhoto[]
  analyzeImages: (files: File[]) => boolean
  retryPhoto: (id: string) => void
  dismissPhoto: (id: string) => void
  resetAnalysis: () => void
}

/** 서버의 컷아웃 바이트를 확인 모달에서 읽을 수 있는 임시 URL로 바꾼다. */
function createImageObjectUrl(base64: string, mimeType: string) {
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}

/** 분류와 컷아웃을 한 사진 단위로 처리한다. 분류만 실패하고 컷아웃을 받을 수 있으면 수동 등록으로 이어진다. */
async function analyzePhoto(file: File, session: PhotoAnalysisSession) {
  const { signal } = session.controller
  const request = { signal, accessToken: session.accessToken }
  let classification: ClothingAnalysisResult | null = null
  let classificationError: unknown
  try {
    classification = await classifyClothing(file, request)
  } catch (error) {
    signal.throwIfAborted()
    if (error instanceof ClothingAnalysisError && error.code && stopClassificationCodes.has(error.code)) {
      throw error
    }
    classificationError = error
  }

  let cutout
  try {
    cutout = classification?.cutoutImageBase64 && classification.cutoutMimeType
      ? { imageBase64: classification.cutoutImageBase64, mimeType: classification.cutoutMimeType }
      : await removeClothingBackground(file, request)
  } catch (error) {
    if (error instanceof ClothingAnalysisError && error.code && stopClassificationCodes.has(error.code)) {
      throw error
    }
    throw new Error('사진의 배경을 제거하지 못했어요.', { cause: error })
  }
  return { classification, classificationError, cutout }
}

/**
 * 선택·드롭·촬영으로 들어온 사진을 로그인 세션별로 대기시켜 한 장씩 분석한다.
 * 준비된 사진은 공통 확인 대기열에 넣고, 일시 실패한 파일은 옷장으로 돌아와 다시 시도할 수 있게 보관한다.
 */
export const useWardrobeImageAnalysis = create<WardrobeImageAnalysis>((set, get) => {
  let currentSession: PhotoAnalysisSession | null = null

  const isCurrentSession = (session: PhotoAnalysisSession) => {
    if (session !== currentSession) return false
    if (session.accessToken === getAccessToken()) return true
    get().resetAnalysis()
    return false
  }

  /** 현재 세션에서만 컷아웃을 확인 대기열로 넘긴다. 그 전에 실패하면 임시 URL을 해제한다. */
  async function processPhoto(session: PhotoAnalysisSession, photo: QueuedPhoto) {
    let imageUrl: string | undefined
    let originalImageUrl: string | undefined
    const { enqueueClassification, pushToast } = useUiStore.getState()

    try {
      const { classification, classificationError, cutout } = await analyzePhoto(photo.file, session)
      if (!isCurrentSession(session)) return

      imageUrl = createImageObjectUrl(cutout.imageBase64, cutout.mimeType)
      originalImageUrl = URL.createObjectURL(photo.file)
      const suggestedName = classification?.suggestedName.trim() ||
        [classification?.colorName, classification?.subcategoryLabel]
          .map((value) => value?.trim())
          .filter(Boolean)
          .join(' ')

      enqueueClassification({
        itemId: photo.id,
        imageUrl,
        originalImageUrl,
        originalFilename: photo.file.name,
        itemName: suggestedName || '새 옷',
        category: classification?.category ?? null,
        subcategory: classification?.subcategoryLabel ?? '',
        colorName: classification?.colorName ?? '',
        colorDetailName: classification?.colorDetailName ?? '',
        colorHex: classification?.colorHex ?? '#d9d5cc',
        colorRgb: classification?.colorRgb ?? [217, 213, 204],
        colorMode: classification?.colorMode ?? null,
        fashionAttributes: classification?.fashionAttributes ?? null,
        confidence: classification?.confidence ?? null,
        model: classification?.model ?? null,
        candidates: classification?.candidates ?? [],
        analysisFailed: !classification,
      })

      if (!classification) {
        pushToast(
          classificationError instanceof Error
            ? classificationError.message
            : 'AI 분석에 실패했습니다. 옷 정보를 직접 입력해 주세요.',
          'error',
        )
      }
    } catch (error) {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      if (originalImageUrl) URL.revokeObjectURL(originalImageUrl)
      if (!isCurrentSession(session)) return

      const message = error instanceof Error ? error.message : '사진을 분석하지 못했어요.'
      if (error instanceof ClothingAnalysisError && error.code && rejectedImageCodes.has(error.code)) {
        pushToast(`${photo.file.name}: ${message}`, 'error')
        return
      }

      set((state) => ({ failedPhotos: [...state.failedPhotos, { ...photo, message }] }))
    }
  }

  /** 여러 번 사진을 추가해도 같은 배열 뒤에 붙인다. 사진의 컷아웃 처리까지 끝난 뒤 다음 사진을 요청한다. */
  function queuePhotos(photos: QueuedPhoto[]) {
    const accessToken = getAccessToken()
    if (!accessToken) return false
    if (currentSession?.accessToken !== accessToken) {
      if (currentSession) get().resetAnalysis()
      currentSession = { accessToken, controller: new AbortController(), photos: [] }
    }

    const session = currentSession
    const isProcessing = session.photos.length > 0
    session.photos.push(...photos)
    set({ analyzingCount: session.photos.length })
    if (!isProcessing) {
      void (async () => {
        while (session.photos.length > 0 && isCurrentSession(session)) {
          await processPhoto(session, session.photos[0])
          session.photos.shift()
          if (isCurrentSession(session)) set({ analyzingCount: session.photos.length })
        }
      })()
    }
    return true
  }

  return {
    analyzingCount: 0,
    failedPhotos: [],
    /** 크기와 형식이 허용된 파일을 대기열에 넣으면 true를 반환한다. 등록 확인과 저장은 이후 별도 단계다. */
    analyzeImages: (files) => {
      if (files.length === 0) return false

      const validFiles = files.filter(
        (file) => SUPPORTED_CLOTHING_IMAGE_TYPES.some((type) => type === file.type) &&
          file.size <= MAX_CLOTHING_IMAGE_SIZE,
      )
      const { pushToast } = useUiStore.getState()
      if (validFiles.length === 0) {
        pushToast('10MB 이하의 JPEG, PNG, WEBP만 추가할 수 있습니다.', 'error')
        return false
      }
      if (validFiles.length !== files.length) {
        pushToast('일부 파일은 형식 또는 10MB 제한 때문에 제외했습니다.', 'error')
      }

      return queuePhotos(validFiles.map((file) => ({ id: crypto.randomUUID(), file })))
    },
    /** 실패 목록의 원본을 그대로 다시 대기열에 넣는다. 성공한 사진과 다른 실패 사진은 건드리지 않는다. */
    retryPhoto: (id) => {
      if (!currentSession || !isCurrentSession(currentSession)) return
      const photo = get().failedPhotos.find((entry) => entry.id === id)
      if (!photo) return

      get().dismissPhoto(id)
      queuePhotos([{ id, file: photo.file }])
    },
    dismissPhoto: (id) => set((state) => ({
      failedPhotos: state.failedPhotos.filter((photo) => photo.id !== id),
    })),
    /** 로그아웃·계정 변경 시 진행 중 요청을 중단하고 대기 중이거나 실패한 원본을 비운다. */
    resetAnalysis: () => {
      if (currentSession) {
        currentSession.photos.length = 0
        currentSession.controller.abort()
      }
      currentSession = null
      set({ analyzingCount: 0, failedPhotos: [] })
      useUiStore.getState().disposeClassificationImages()
    },
  }
})
