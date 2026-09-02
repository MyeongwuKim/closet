import type {
  NativeAppInfoRequest,
  NativeAuthSessionRequest,
  NativeBridgeReadyMessage,
  NativeBridgeRequest,
  NativeCancelGraphqlRequest,
  NativeCaptureWardrobePhotoRequest,
  NativeCurrentLocationRequest,
  NativeGraphqlRequest,
  NativeOpenAppSettingsRequest,
  NativeOpenExternalUrlRequest,
  NativeRequestPermissionRequest,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function hasRequestId(value: Record<string, unknown>) {
  return typeof value.id === 'string' && value.id.length > 0
}

export function isNativeBridgeReadyMessage(
  value: unknown,
): value is NativeBridgeReadyMessage {
  return isRecord(value) && value.type === 'closet:native-bridge-ready'
}

export function isNativeAppInfoRequest(
  value: unknown,
): value is NativeAppInfoRequest {
  return (
    isRecord(value) &&
    value.type === 'closet:native-app-info' &&
    hasRequestId(value)
  )
}

export function isNativeOpenExternalUrlRequest(
  value: unknown,
): value is NativeOpenExternalUrlRequest {
  return (
    isRecord(value) &&
    value.type === 'closet:native-open-external-url' &&
    hasRequestId(value) &&
    typeof value.url === 'string' &&
    value.url.length > 0
  )
}

export function isNativeOpenAppSettingsRequest(
  value: unknown,
): value is NativeOpenAppSettingsRequest {
  return (
    isRecord(value) &&
    value.type === 'closet:native-open-app-settings' &&
    hasRequestId(value)
  )
}

export function isNativeRequestPermissionRequest(
  value: unknown,
): value is NativeRequestPermissionRequest {
  return (
    isRecord(value) &&
    value.type === 'closet:native-request-permission' &&
    hasRequestId(value) &&
    (value.permission === 'notifications' || value.permission === 'location')
  )
}

export function isNativeCurrentLocationRequest(
  value: unknown,
): value is NativeCurrentLocationRequest {
  return (
    isRecord(value) &&
    value.type === 'closet:native-current-location' &&
    hasRequestId(value)
  )
}

export function isNativeCaptureWardrobePhotoRequest(
  value: unknown,
): value is NativeCaptureWardrobePhotoRequest {
  return (
    isRecord(value) &&
    value.type === 'closet:native-capture-wardrobe-photo' &&
    hasRequestId(value)
  )
}

export function isNativeAuthSessionRequest(
  value: unknown,
): value is NativeAuthSessionRequest {
  return (
    isRecord(value) &&
    value.type === 'closet:native-auth-session' &&
    hasRequestId(value) &&
    (typeof value.accessToken === 'string' || value.accessToken === null)
  )
}

export function parseNativeBridgeRequest(
  rawMessage: string,
): NativeBridgeRequest | null {
  try {
    const value: unknown = JSON.parse(rawMessage)

    if (isNativeBridgeReadyMessage(value)) return value
    if (isNativeAppInfoRequest(value)) return value
    if (isNativeOpenAppSettingsRequest(value)) return value
    if (isNativeRequestPermissionRequest(value)) return value
    if (isNativeCurrentLocationRequest(value)) return value
    if (isNativeCaptureWardrobePhotoRequest(value)) return value
    if (isNativeOpenExternalUrlRequest(value)) return value
    if (isNativeAuthSessionRequest(value)) return value
    if (isNativeGraphqlRequest(value)) return value
    if (isNativeCancelGraphqlRequest(value)) return value

    return null
  } catch {
    return null
  }
}

export function isNativeGraphqlRequest(value: unknown): value is NativeGraphqlRequest {
  return (
    isRecord(value) &&
    value.type === 'closet:native-graphql' &&
    hasRequestId(value) &&
    typeof value.query === 'string' &&
    value.query.trim().length > 0 &&
    (value.variables === undefined ||
      (isRecord(value.variables) && !Array.isArray(value.variables)))
  )
}

export function isNativeCancelGraphqlRequest(
  value: unknown,
): value is NativeCancelGraphqlRequest {
  return (
    isRecord(value) &&
    value.type === 'closet:native-cancel-graphql' &&
    hasRequestId(value)
  )
}
