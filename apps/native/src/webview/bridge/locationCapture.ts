/**
 * 용도:
 * 기기의 현재 위치를 날씨 조회에 필요한 최소 좌표 형태로 정리한다.
 *
 * 동작 방식:
 * 위치 서비스와 전경 권한을 확인한 뒤 최근 좌표를 우선 사용하고,
 * 사용할 수 없을 때만 새 좌표를 조회해 상태와 함께 반환한다.
 */

interface LocationPermissionResult {
  granted: boolean
  canAskAgain: boolean
  status: string
}

interface LocationPoint {
  coords: {
    latitude: number
    longitude: number
    accuracy: number | null
  }
  timestamp: number
}

interface CurrentLocationDependencies {
  hasServicesEnabled: () => Promise<boolean>
  getPermission: () => Promise<LocationPermissionResult>
  requestPermission: () => Promise<LocationPermissionResult>
  getLastKnownPosition: () => Promise<LocationPoint | null>
  getCurrentPosition: () => Promise<LocationPoint>
}

export type NativeCurrentLocationResult =
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

function toAvailableLocation(
  location: LocationPoint,
): NativeCurrentLocationResult {
  return {
    status: 'available',
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  }
}

export async function captureCurrentLocation(
  dependencies: CurrentLocationDependencies,
): Promise<NativeCurrentLocationResult> {
  try {
    if (!(await dependencies.hasServicesEnabled())) {
      return { status: 'services-disabled' }
    }

    let permission = await dependencies.getPermission()
    if (!permission.granted && permission.status === 'undetermined') {
      permission = await dependencies.requestPermission()
    }
    if (!permission.granted) {
      return {
        status: 'permission-denied',
        canAskAgain: permission.canAskAgain,
      }
    }

    const cachedLocation = await dependencies.getLastKnownPosition()
    if (cachedLocation) return toAvailableLocation(cachedLocation)

    return toAvailableLocation(await dependencies.getCurrentPosition())
  } catch (error) {
    return {
      status: 'error',
      code:
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : undefined,
      message:
        error instanceof Error
          ? error.message
          : '현재 위치를 확인하지 못했어요.',
    }
  }
}
