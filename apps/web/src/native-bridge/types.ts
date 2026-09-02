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

export interface NativeWardrobePhotoAsset {
  base64: string
  fileName: string
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

export interface ClosetNativeBridge {
  requestGraphql: (
    query: string,
    variables?: object,
    signal?: AbortSignal,
  ) => Promise<{ ok: boolean; status: number; payload: unknown }>
  getAppInfo: () => Promise<NativeAppInfo>
  openAppSettings: () => Promise<void>
  requestPermission: (
    permission: 'notifications' | 'location',
  ) => Promise<NativePermissionStatus>
  getCurrentLocation: () => Promise<CurrentLocationResult>
  openExternalUrl: (url: string) => Promise<void>
  setAuthSession: (accessToken: string | null) => Promise<void>
  captureWardrobePhoto: () => Promise<NativeCaptureWardrobePhotoResult>
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
  }
}
