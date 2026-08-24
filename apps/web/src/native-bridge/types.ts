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
