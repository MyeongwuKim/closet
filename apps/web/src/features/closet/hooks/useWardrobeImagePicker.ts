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

export function useWardrobeImagePicker({
  onImagesSelected,
  onError,
}: UseWardrobeImagePickerOptions) {
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
    albumInput.addEventListener('cancel', restoreAddButtonFocus)
    cameraInput.addEventListener('cancel', handleCameraCancel)
    return () => {
      albumInput.removeEventListener('cancel', restoreAddButtonFocus)
      cameraInput.removeEventListener('cancel', handleCameraCancel)
    }
  }, [restoreAddButtonFocus])

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
    if (isNativeWebViewRuntime()) {
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

  const chooseAlbum = () => {
    setPickerStep('closed')
    albumInputRef.current?.click()
  }

  const handleAlbumChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    onImagesSelected(files)
    restoreAddButtonFocus()
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
    addButtonRef,
    albumInputRef,
    cameraInputRef,
    capturedPhoto,
    pickerStep,
    openPicker,
    closePicker,
    chooseAlbum,
    startCameraCapture,
    handleAlbumChange,
    handleCameraChange,
    retakePhoto,
    useCapturedPhoto,
  }
}
