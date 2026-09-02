import type { NativeCaptureWardrobePhotoResult } from './types'

export function captureWardrobePhoto(): Promise<NativeCaptureWardrobePhotoResult> {
  const capture = window.ClosetNative?.captureWardrobePhoto

  if (!capture) {
    return Promise.reject(
      new Error('현재 앱에서는 카메라 기능을 사용할 수 없습니다.'),
    )
  }

  return capture()
}
