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
  onImagesSelected: (files: File[]) => boolean | void
  onError: (message: string) => void
}

/** 옷장 사진 추가의 실행 환경과 선택 단계를 관리한다. 웹은 파일 선택·드롭 창을, 앱은 촬영·앨범 창을 사용하며 허용된 사진은 onImagesSelected의 분석 흐름에 전달한다. */
export function useWardrobeImagePicker({
  onImagesSelected,
  onError,
}: UseWardrobeImagePickerOptions) {
  const isNativeApp = isNativeWebViewRuntime()
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const capturedPhotoRef = useRef<CapturedWardrobePhoto | null>(null)
  const isMountedRef = useRef(true)
  const [pickerStep, setPickerStep] =
    useState<WardrobeImagePickerStep>('closed')
  const [capturedPhoto, setCapturedPhoto] =
    useState<CapturedWardrobePhoto | null>(null)

  const restoreAddButtonFocus = useCallback(() => {
    window.requestAnimationFrame(() => addButtonRef.current?.focus())
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
        onError(result.message || '카메라로 사진을 촬영하지 못했습니다.')
        setPickerStep('source')
        return
      }

      showCapturedPhoto(createFileFromNativeWardrobePhoto(result.asset))
    } catch (error) {
      if (!isMountedRef.current) return

      onError(
        error instanceof Error
          ? error.message
          : '카메라를 열지 못했습니다.',
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

  const openPicker = () => setPickerStep('source')

  const closePicker = () => {
    clearCapturedPhoto()
    setPickerStep('closed')
    restoreAddButtonFocus()
  }

  /** 앱에서는 기존 창을 닫고 앨범을 연다. 웹에서는 파일 선택을 취소하거나 검증에 실패해도 드롭 창을 유지한다. */
  const chooseAlbum = () => {
    if (isNativeApp) setPickerStep('closed')
    albumInputRef.current?.click()
  }

  /** 선택·드롭한 파일이 분석 흐름에 받아들여지면 추가창을 닫는다. 빈 선택이나 모두 허용되지 않은 파일이면 현재 창을 유지한다. */
  const acceptImages = (files: File[]) => {
    if (files.length === 0 || onImagesSelected(files) === false) return false
    setPickerStep('closed')
    restoreAddButtonFocus()
    return true
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
