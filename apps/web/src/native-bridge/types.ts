export type NativePermissionStatus =
  | 'granted'
  | 'limited'
  | 'denied'
  | 'undetermined'
  | 'unavailable'

export interface NativeAppInfo {
  platform: string
  osVersion: string
  appVersion: string | null
  buildVersion: string | null
  permissions: {
    notifications: NativePermissionStatus
    photos: NativePermissionStatus
    camera: NativePermissionStatus
    location: NativePermissionStatus
  }
  capabilities: string[]
}

export interface NativeWardrobePhotoFile {
  base64: string
  fileName: string
  mimeType: string
}

export interface NativeWardrobePhotoAsset extends NativeWardrobePhotoFile {
  mimeType: 'image/jpeg'
  width: number
  height: number
  fileSize?: number
}

export type NativeCaptureWardrobePhotoResult =
  | { status: 'captured'; asset: NativeWardrobePhotoAsset }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; canAskAgain: boolean }
  | { status: 'error'; code?: string; message: string }

type NativeSelectWardrobePhotosResult =
  | { status: 'selected'; skippedCount: number }
  | { status: 'cancelled' }

export type CurrentLocationResult =
  | {
      status: 'available'
      latitude: number
      longitude: number
      accuracy: number | null
      timestamp: number
    }
  | { status: 'permission-denied'; canAskAgain: boolean }
  | { status: 'services-disabled' }
  | { status: 'error'; code?: string; message: string }

type NativeGraphqlTransport = (
  query: string,
  variables?: object,
  signal?: AbortSignal,
) => Promise<{ ok: boolean; status: number; payload: unknown }>

export interface ClosetNativeBridge {
  showRewardedAd?: (sessionId: string) => Promise<{ status: 'earned' | 'cancelled' | 'unavailable'; sessionId: string; message?: string }>
  openAdPrivacyOptions?: () => Promise<void>
  requestGraphql: NativeGraphqlTransport
  /** 지원하는 iOS 빌드가 룩북 접수의 HTTP 응답까지 백그라운드 실행 시간을 확보한다. */
  requestPreviewStart?: NativeGraphqlTransport
  getAppInfo: () => Promise<NativeAppInfo>
  openAppSettings: () => Promise<void>
  requestPermission: (
    permission: 'notifications' | 'location',
  ) => Promise<NativePermissionStatus>
  getCurrentLocation: () => Promise<CurrentLocationResult>
  openExternalUrl: (url: string) => Promise<void>
  setAuthSession: (accessToken: string | null) => Promise<void>
  captureWardrobePhoto: () => Promise<NativeCaptureWardrobePhotoResult>
  /** 시스템 앨범에서 선택한 사진을 한 장씩 받고, 취소 또는 선택 완료를 반환한다. */
  selectWardrobePhotos?: (
    onPhoto: (photo: NativeWardrobePhotoFile) => void,
    signal?: AbortSignal,
  ) => Promise<NativeSelectWardrobePhotosResult>
  removeWardrobePhotoBackground?: (imageBase64: string, signal?: AbortSignal) => Promise<{ imageBase64: string }>
}

export interface ClosetRuntimeConfig {
  isNativeWebView?: boolean
  routerMode?: 'browser' | 'hash'
  webBundleVersion?: string
}

declare global {
  interface Window {
    ClosetNative?: ClosetNativeBridge
    ClosetRuntimeConfig?: ClosetRuntimeConfig
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
  }
}
