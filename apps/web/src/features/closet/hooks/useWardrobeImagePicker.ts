import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  captureWardrobePhoto,
  isNativeWebViewRuntime,
} from '../../../native-bridge'
import { createFileFromNativeWardrobePhoto } from '../utils/nativeWardrobePhoto'

export type WardrobeImagePickerStep =
  | 'closed'
  | 'source'
  | 'capturing'
  | 'review'

export interface CapturedWardrobePhoto {
  file: File
  previewUrl: string
}

interface UseWardrobeImagePickerOptions {
  /** 플래너에서 첫 옷 등록으로 이동했을 때만 사진 추가창부터 보여준다. */
  initiallyOpen?: boolean
  onImagesSelected: (files: File[]) => boolean | void
  onError: (message: string) => void
}

/** 옷장 사진 추가의 실행 환경과 선택 단계를 관리한다. 웹은 파일 선택·드롭 창을, 앱은 촬영·앨범 창을 사용하며 허용된 사진은 onImagesSelected의 분석 흐름에 전달한다. */
export function useWardrobeImagePicker({
  initiallyOpen = false,
  onImagesSelected,
  onError,
}: UseWardrobeImagePickerOptions) {
  const isNativeApp = isNativeWebViewRuntime()
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const capturedPhotoRef = useRef<CapturedWardrobePhoto | null>(null)
  // 앨범을 여는 동안 추가 버튼의 중복 요청을 막고, 화면 이동 시 사진 응답을 폐기한다.
  const albumRequestRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)
  const [pickerStep, setPickerStep] =
    useState<WardrobeImagePickerStep>(initiallyOpen ? 'source' : 'closed')
  const [capturedPhoto, setCapturedPhoto] =
    useState<CapturedWardrobePhoto | null>(null)

  const restoreAddButtonFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      const opener = openerRef.current
      if (opener?.isConnected && !opener.disabled) opener.focus()
      else addButtonRef.current?.focus()
    })
  }, [])

  const clearCapturedPhoto = () => {
    const currentPhoto = capturedPhotoRef.current
    if (currentPhoto) URL.revokeObjectURL(currentPhoto.previewUrl)

    capturedPhotoRef.current = null
    setCapturedPhoto(null)
  }

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      albumRequestRef.current?.abort()
      albumRequestRef.current = null
      const currentPhoto = capturedPhotoRef.current
      if (currentPhoto) URL.revokeObjectURL(currentPhoto.previewUrl)
    }
  }, [])

  useEffect(() => {
    const albumInput = albumInputRef.current
    const cameraInput = cameraInputRef.current
    if (!albumInput || !cameraInput) return

    const handleCameraCancel = () => setPickerStep('source')
    const handleAlbumCancel = () => {
      if (isNativeApp) restoreAddButtonFocus()
    }
    albumInput.addEventListener('cancel', handleAlbumCancel)
    cameraInput.addEventListener('cancel', handleCameraCancel)
    return () => {
      albumInput.removeEventListener('cancel', handleAlbumCancel)
      cameraInput.removeEventListener('cancel', handleCameraCancel)
    }
  }, [isNativeApp, restoreAddButtonFocus])

  const showCapturedPhoto = (file: File) => {
    clearCapturedPhoto()
    const nextPhoto = {
      file,
      previewUrl: URL.createObjectURL(file),
    }
    capturedPhotoRef.current = nextPhoto
    setCapturedPhoto(nextPhoto)
    setPickerStep('review')
  }

  const captureWithNativeBridge = async () => {
    setPickerStep('capturing')

    try {
      const result = await captureWardrobePhoto()
      if (!isMountedRef.current) return

      if (result.status === 'cancelled') {
        setPickerStep('source')
        return
      }

      if (result.status === 'permission-denied') {
        onError(
          result.canAskAgain
            ? '사진 촬영을 사용하려면 카메라 접근을 허용해주세요.'
            : '설정에서 카메라 권한을 허용해주세요.',
        )
        setPickerStep('source')
        return
      }

      if (result.status === 'error') {
        onError(result.message || '카메라로 사진을 촬영하지 못했어요.')
        setPickerStep('source')
        return
      }

      showCapturedPhoto(createFileFromNativeWardrobePhoto(result.asset))
    } catch (error) {
      if (!isMountedRef.current) return

      onError(
        error instanceof Error
          ? error.message
          : '카메라를 열지 못했어요.',
      )
      setPickerStep('source')
    }
  }

  const startCameraCapture = () => {
    if (isNativeApp) {
      void captureWithNativeBridge()
      return
    }

    cameraInputRef.current?.click()
  }

  /** 클릭한 추가 버튼을 기억해 사진 추가창을 닫은 뒤 키보드 포커스를 돌려준다. */
  const openPicker = (opener = addButtonRef.current) => {
    if (albumRequestRef.current) return
    openerRef.current = opener
    setPickerStep('source')
  }

  const closePicker = () => {
    clearCapturedPhoto()
    setPickerStep('closed')
    restoreAddButtonFocus()
  }

  /** 선택·드롭한 파일이 분석 흐름에 받아들여지면 추가창을 닫는다. 빈 선택이나 모두 허용되지 않은 파일이면 현재 창을 유지한다. */
  const acceptImages = (files: File[]) => {
    if (files.length === 0 || onImagesSelected(files) === false) return false
    setPickerStep('closed')
    restoreAddButtonFocus()
    return true
  }

  /** 앱에서 시스템 앨범을 열고 선택한 사진 묶음을 기존 분석 흐름에 전달한다. */
  const chooseAlbum = async () => {
    if (albumRequestRef.current) return

    if (isNativeApp) setPickerStep('closed')
    const selectPhotos = isNativeApp ? window.ClosetNative?.selectWardrobePhotos : undefined
    if (!selectPhotos) {
      albumInputRef.current?.click()
      return
    }

    const request = new AbortController()
    albumRequestRef.current = request
    const files: File[] = []
    let accepted = false

    try {
      const result = await selectPhotos((photo) => {
        files.push(createFileFromNativeWardrobePhoto(photo))
      }, request.signal)
      if (request.signal.aborted || result.status === 'cancelled') return

      if (files.length === 0) {
        onError('선택한 사진을 추가하지 못했어요. 10MB 이하의 사진으로 다시 시도해주세요.')
        return
      }
      if (result.skippedCount > 0) {
        onError(`사진 ${result.skippedCount}장을 읽지 못해 제외했어요.`)
      }
      accepted = acceptImages(files)
    } catch {
      if (!request.signal.aborted) onError('앨범을 열거나 사진을 불러오지 못했어요.')
    } finally {
      if (albumRequestRef.current === request) {
        albumRequestRef.current = null
        if (!accepted) restoreAddButtonFocus()
      }
    }
  }

  const handleAlbumChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    const accepted = acceptImages(files)
    if (isNativeApp && !accepted) restoreAddButtonFocus()
  }

  const handleCameraChange = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (!file) {
      setPickerStep('source')
      return
    }

    showCapturedPhoto(file)
  }

  const retakePhoto = () => {
    clearCapturedPhoto()
    setPickerStep('source')
    startCameraCapture()
  }

  const useCapturedPhoto = () => {
    const file = capturedPhotoRef.current?.file
    if (!file) return

    const wasAccepted = onImagesSelected([file])
    if (wasAccepted === false) return

    clearCapturedPhoto()
    setPickerStep('closed')
    restoreAddButtonFocus()
  }

  return {
    isNativeApp,
    addButtonRef,
    albumInputRef,
    cameraInputRef,
    capturedPhoto,
    pickerStep,
    openPicker,
    closePicker,
    chooseAlbum,
    acceptImages,
    startCameraCapture,
    handleAlbumChange,
    handleCameraChange,
    retakePhoto,
    useCapturedPhoto,
  }
}
