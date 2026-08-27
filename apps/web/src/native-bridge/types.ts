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
  openExternalUrl: (url: string) => Promise<void>
  setAuthSession: (accessToken: string | null) => Promise<void>
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
