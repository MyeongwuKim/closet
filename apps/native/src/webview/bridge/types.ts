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

export type NativeBridgeRequest =
  | NativeBridgeReadyMessage
  | NativeAppInfoRequest
  | NativeOpenAppSettingsRequest
  | NativeRequestPermissionRequest
  | NativeOpenExternalUrlRequest
  | NativeAuthSessionRequest

export type NativeBridgeResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
