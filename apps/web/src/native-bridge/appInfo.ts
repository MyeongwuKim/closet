import type {
  NativeAppInfo,
  NativePermissionStatus,
} from './types'

export function getNativeAppInfo(): Promise<NativeAppInfo | null> {
  return window.ClosetNative?.getAppInfo() ?? Promise.resolve(null)
}

export function openNativeAppSettings(): Promise<void> {
  return window.ClosetNative?.openAppSettings() ?? Promise.resolve()
}

export function requestNativePermission(
  permission: 'notifications' | 'location',
): Promise<NativePermissionStatus | null> {
  return (
    window.ClosetNative?.requestPermission(permission) ?? Promise.resolve(null)
  )
}
