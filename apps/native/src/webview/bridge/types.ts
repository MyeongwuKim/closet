export type WebViewRef = {
  current: {
    injectJavaScript: (script: string) => void
  } | null
}

export interface NativeBridgeReadyMessage {
  type: 'closet:native-bridge-ready'
}

export interface NativeAppInfoRequest {
  type: 'closet:native-app-info'
  id: string
}

export interface NativeOpenAppSettingsRequest {
  type: 'closet:native-open-app-settings'
  id: string
}

export interface NativeRequestPermissionRequest {
  type: 'closet:native-request-permission'
  id: string
  permission: 'notifications' | 'location'
}

export interface NativeCurrentLocationRequest {
  type: 'closet:native-current-location'
  id: string
}

export interface NativeCaptureWardrobePhotoRequest {
  type: 'closet:native-capture-wardrobe-photo'
  id: string
}

export interface NativeWardrobePhotoAsset {
  base64: string
  mimeType: 'image/jpeg'
  fileName: string
  width: number
  height: number
  fileSize?: number
}

export type NativeCaptureWardrobePhotoResult =
  | { status: 'captured'; asset: NativeWardrobePhotoAsset }
  | { status: 'cancelled' }
  | { status: 'permission-denied'; canAskAgain: boolean }
  | { status: 'error'; code?: string; message: string }

export interface NativeOpenExternalUrlRequest {
  type: 'closet:native-open-external-url'
  id: string
  url: string
}

export interface NativeAuthSessionRequest {
  type: 'closet:native-auth-session'
  id: string
  accessToken: string | null
}

export interface NativeGraphqlRequest {
  type: 'closet:native-graphql'
  id: string
  query: string
  variables?: Record<string, unknown>
}

export interface NativeCancelGraphqlRequest {
  type: 'closet:native-cancel-graphql'
  id: string
}

export type NativeBridgeRequest =
  | NativeBridgeReadyMessage
  | NativeAppInfoRequest
  | NativeOpenAppSettingsRequest
  | NativeRequestPermissionRequest
  | NativeCurrentLocationRequest
  | NativeCaptureWardrobePhotoRequest
  | NativeOpenExternalUrlRequest
  | NativeAuthSessionRequest
  | NativeGraphqlRequest
  | NativeCancelGraphqlRequest

export type NativeBridgeResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
