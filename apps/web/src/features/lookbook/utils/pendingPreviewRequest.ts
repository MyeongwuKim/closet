const PREFIX = 'closet:pending-preview:v1:'
const RETENTION_MS = 24 * 60 * 60 * 1000
const CHANGE_EVENT = 'closet:pending-preview-changed'

function getStorage() {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

interface PendingPreviewRequest { requestId: string; jobId?: string; createdAt: number }

/** 같은 화면·다른 탭에서 요청 복원 정보가 바뀌면 생성 버튼의 진행 상태를 다시 읽게 한다. */
export function subscribePendingPreview(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

/** React 외부 저장소 구독에서 값이 바뀌었는지 비교할 원본 문자열을 읽는다. */
export function getPendingPreviewSnapshot(key: string) {
  try { return getStorage()?.getItem(key) ?? null } catch { return null }
}

/** 사용자와 옷 조합·스타일별 재전송 키를 보관한다. 이미지나 로그인 토큰은 저장하지 않는다. */
export function previewRequestKey(viewerId: string, itemIds: string[], style?: string) {
  return `${PREFIX}${viewerId}:${encodeURIComponent(JSON.stringify([[...new Set(itemIds)].sort(), style?.trim() || null]))}`
}

/** 앱이 닫히기 전의 요청 번호를 복원한다. 만료·손상된 기록은 재사용하지 않는다. */
export function readPendingPreview(key: string, storage: Storage | null = getStorage(), now = Date.now()): PendingPreviewRequest | null {
  if (!storage) return null
  try {
    const value = JSON.parse(storage.getItem(key) ?? 'null') as PendingPreviewRequest | null
    if (value && typeof value.requestId === 'string' && typeof value.createdAt === 'number' && now - value.createdAt < RETENTION_MS && now >= value.createdAt && (value.jobId === undefined || typeof value.jobId === 'string')) return value
    storage.removeItem(key)
  } catch { /* 저장소가 제한되면 서버의 작업 목록으로 복원한다. */ }
  return null
}

/** 서버 전송 전에 요청 번호를 기록하고 접수 후에는 작업 ID를 덧붙인다. 저장 실패는 생성 작업을 막지 않는다. */
export function writePendingPreview(key: string, value: PendingPreviewRequest, storage: Storage | null = getStorage()) {
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(value))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch { /* 서버 작업은 계속 진행한다. */ }
}

/** 완료·실패가 확정된 요청의 재전송 키를 지워 사용자의 다음 만들기를 새 요청으로 처리한다. */
export function clearPendingPreview(key: string, storage: Storage | null = getStorage()) {
  if (!storage) return
  try {
    storage.removeItem(key)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch { /* 서버의 작업 목록에서 계속 확인할 수 있다. */ }
}
