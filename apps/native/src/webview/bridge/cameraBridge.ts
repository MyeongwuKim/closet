import * as ImagePicker from 'expo-image-picker'
import {
  ImageManipulator,
  SaveFormat,
} from 'expo-image-manipulator'
import { captureWardrobePhoto } from './cameraCapture'
import { postNativeBridgeResponse } from './responses'
import type {
  NativeCaptureWardrobePhotoRequest,
  WebViewRef,
} from './types'

const MAX_CAMERA_IMAGE_DIMENSION = 2048

function getResizeSize(width: number, height: number) {
  if (
    width <= MAX_CAMERA_IMAGE_DIMENSION &&
    height <= MAX_CAMERA_IMAGE_DIMENSION
  ) {
    return null
  }

  return width >= height
    ? { width: MAX_CAMERA_IMAGE_DIMENSION, height: null }
    : { width: null, height: MAX_CAMERA_IMAGE_DIMENSION }
}

function getBase64ByteLength(base64: string) {
  const paddingLength = base64.endsWith('==')
    ? 2
    : base64.endsWith('=')
      ? 1
      : 0

  return Math.floor((base64.length * 3) / 4) - paddingLength
}

async function normalizeCameraImage(asset: ImagePicker.ImagePickerAsset) {
  const context = ImageManipulator.manipulate(asset.uri)
  const resizeSize = getResizeSize(asset.width, asset.height)
  if (resizeSize) context.resize(resizeSize)

  const renderedImage = await context.renderAsync()
  const normalizedImage = await renderedImage.saveAsync({
    base64: true,
    compress: 0.82,
    format: SaveFormat.JPEG,
  })

  return {
    base64: normalizedImage.base64,
    width: normalizedImage.width,
    height: normalizedImage.height,
    ...(normalizedImage.base64
      ? { fileSize: getBase64ByteLength(normalizedImage.base64) }
      : {}),
  }
}

export async function handleNativeCaptureWardrobePhoto(
  request: NativeCaptureWardrobePhotoRequest,
  webViewRef: WebViewRef,
) {
  const result = await captureWardrobePhoto({
    // Permission is intentionally requested only after the WebView asks to shoot.
    requestPermission: () => ImagePicker.requestCameraPermissionsAsync(),
    launch: () =>
      ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        cameraType: ImagePicker.CameraType.back,
        allowsEditing: false,
        base64: false,
        exif: false,
        quality: 1,
      }),
    normalize: normalizeCameraImage,
  })

  // launchCameraAsync keeps the image in app cache. Nothing writes it to the album.
  postNativeBridgeResponse(webViewRef, request.id, {
    ok: true,
    data: result,
  })
}
