import type { NativeCaptureWardrobePhotoResult } from './types'

interface CameraPermissionResult {
  granted: boolean
  canAskAgain: boolean
}

interface CameraAsset {
  uri: string
  fileName?: string | null
  width: number
  height: number
}

interface NormalizedCameraAsset {
  base64?: string | null
  fileSize?: number
  width: number
  height: number
}

type CameraLaunchResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: CameraAsset[] }

interface WardrobeCameraAdapter {
  requestPermission: () => Promise<CameraPermissionResult>
  launch: () => Promise<CameraLaunchResult>
  normalize: (asset: CameraAsset) => Promise<NormalizedCameraAsset>
}

function createJpegFilename(fileName?: string | null) {
  const trimmedName = fileName?.trim()
  if (!trimmedName) return `closet-camera-${Date.now()}.jpg`

  const lastDotIndex = trimmedName.lastIndexOf('.')
  const basename =
    lastDotIndex > 0 ? trimmedName.slice(0, lastDotIndex) : trimmedName

  return `${basename}.jpg`
}

function toCameraError(error: unknown): NativeCaptureWardrobePhotoResult {
  const details =
    error && typeof error === 'object'
      ? (error as { code?: unknown; message?: unknown })
      : null

  return {
    status: 'error',
    ...(typeof details?.code === 'string' ? { code: details.code } : {}),
    message:
      typeof details?.message === 'string' && details.message.trim()
        ? details.message
        : '카메라로 사진을 촬영하지 못했어요.',
  }
}

export async function captureWardrobePhoto(
  camera: WardrobeCameraAdapter,
): Promise<NativeCaptureWardrobePhotoResult> {
  try {
    const permission = await camera.requestPermission()
    if (!permission.granted) {
      return {
        status: 'permission-denied',
        canAskAgain: permission.canAskAgain,
      }
    }

    const result = await camera.launch()
    if (result.canceled) return { status: 'cancelled' }

    const sourceAsset = result.assets[0]
    if (!sourceAsset?.uri) {
      return {
        status: 'error',
        code: 'CAMERA_CAPTURE_INVALID_RESULT',
        message: '촬영한 사진을 불러오지 못했어요.',
      }
    }

    const normalizedAsset = await camera.normalize(sourceAsset)
    if (!normalizedAsset.base64) {
      return {
        status: 'error',
        code: 'CAMERA_CAPTURE_INVALID_RESULT',
        message: '촬영한 사진을 불러오지 못했어요.',
      }
    }

    return {
      status: 'captured',
      asset: {
        base64: normalizedAsset.base64,
        mimeType: 'image/jpeg',
        fileName: createJpegFilename(sourceAsset.fileName),
        width: normalizedAsset.width,
        height: normalizedAsset.height,
        ...(normalizedAsset.fileSize === undefined
          ? {}
          : { fileSize: normalizedAsset.fileSize }),
      },
    }
  } catch (error) {
    return toCameraError(error)
  }
}
