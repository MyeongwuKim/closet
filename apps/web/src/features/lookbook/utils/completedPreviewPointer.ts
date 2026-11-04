import { clearPendingPreview, readPendingPreview } from './pendingPreviewRequest'

const PREFIX = 'closet:completed-preview:v1:'
const CHANGE_EVENT = 'closet:completed-preview-changed'

/** 완료 이미지의 재조회에 필요한 번호만 보관한다. 이미지 URL·본문·계정 토큰은 저장하지 않는다. */
export interface CompletedPreviewPointer {
  /** 이전 생성 작업이 없는 이미지도 asset 번호로 복원할 수 있다. */
  jobId?: string
  assetId: string
  recordedAt: number
  jobCreatedAt?: string
  /** 영속 조합 조회에서 받은 이미지 생성 시각. 작업 생성 시각과 구분해 저장한다. */
  createdAt?: string
}

function getStorage() {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}

/** 계정·정규화된 옷 조합별 기존 요청 키를 완료 포인터 전용 저장 공간으로 구분한다. */
function storageKey(requestKey: string) { return `${PREFIX}${requestKey}` }

/** 손상·미래 시각의 완료 포인터는 복원하지 않는다. 정상 포인터는 기간으로 만료시키지 않고 서버의 이미지 상태를 확인한다. */
export function parseCompletedPreviewPointer(snapshot: string | null, now = Date.now()): CompletedPreviewPointer | null {
  try {
    const value: unknown = JSON.parse(snapshot ?? 'null')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const pointer = value as Partial<CompletedPreviewPointer>
    if ((pointer.jobId !== undefined && pointer.jobId !== null && (typeof pointer.jobId !== 'string' || !pointer.jobId)) || typeof pointer.assetId !== 'string' || !pointer.assetId
      || typeof pointer.recordedAt !== 'number' || !Number.isFinite(pointer.recordedAt)
      || pointer.recordedAt > now
      || (pointer.jobCreatedAt !== undefined && (typeof pointer.jobCreatedAt !== 'string' || !Number.isFinite(Date.parse(pointer.jobCreatedAt))))
      || (pointer.createdAt !== undefined && (typeof pointer.createdAt !== 'string' || !Number.isFinite(Date.parse(pointer.createdAt))))) return null
    return { ...(pointer.jobId ? { jobId: pointer.jobId } : {}), assetId: pointer.assetId, recordedAt: pointer.recordedAt, ...(pointer.jobCreatedAt ? { jobCreatedAt: pointer.jobCreatedAt } : {}), ...(pointer.createdAt ? { createdAt: pointer.createdAt } : {}) }
  } catch { return null }
}

/** React 구독에서 변경 여부를 비교할 원본 문자열을 읽는다. */
export function getCompletedPreviewSnapshot(requestKey: string, storage: Storage | null = getStorage()) {
  try { return storage?.getItem(storageKey(requestKey)) ?? null } catch { return null }
}

/** 완료 포인터를 읽고 사용할 수 없는 이전 기록은 해당 키에서만 정리한다. */
export function readCompletedPreviewPointer(requestKey: string, storage: Storage | null = getStorage(), now = Date.now()) {
  const snapshot = getCompletedPreviewSnapshot(requestKey, storage)
  const pointer = parseCompletedPreviewPointer(snapshot, now)
  if (snapshot && !pointer) clearCompletedPreviewPointer(requestKey, storage)
  return pointer
}

/** 서버가 확인한 완료 번호를 저장한다. 같은 완료 결과를 다시 읽어도 보관 시작 시각은 연장하지 않는다. */
export function writeCompletedPreviewPointer(requestKey: string, pointer: CompletedPreviewPointer, storage: Storage | null = getStorage()) {
  if (!storage) return
  try {
    const previous = readCompletedPreviewPointer(requestKey, storage)
    const jobId = pointer.jobId ?? (previous && previous.assetId === pointer.assetId ? previous.jobId : undefined)
    const value = { ...(jobId ? { jobId } : {}), assetId: pointer.assetId, recordedAt: previous && previous.assetId === pointer.assetId ? previous.recordedAt : pointer.recordedAt, ...(pointer.jobCreatedAt ? { jobCreatedAt: pointer.jobCreatedAt } : {}), ...(pointer.createdAt ? { createdAt: pointer.createdAt } : {}) }
    const serialized = JSON.stringify(value)
    if (serialized === getCompletedPreviewSnapshot(requestKey, storage)) return
    storage.setItem(storageKey(requestKey), serialized)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch { /* 저장소를 쓸 수 없어도 현재 생성 결과와 서버 복원은 유지한다. */ }
}

/** 만료·삭제·소유권 거절 또는 새 작업 접수 시 해당 조합의 완료 포인터만 지운다. */
export function clearCompletedPreviewPointer(requestKey: string, storage: Storage | null = getStorage()) {
  if (!storage) return
  try {
    if (storage.getItem(storageKey(requestKey)) === null) return
    storage.removeItem(storageKey(requestKey))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch { /* 서버의 이미지 보관 상태가 최종 판단 기준이다. */ }
}

/** 완료 결과를 확인했거나 서버가 폐기를 확정했을 때 같은 작업 번호의 pending만 정리한다. 새 작업·접수 번호만 있는 요청은 보존한다. */
export function clearCompletedPendingPreview(requestKey: string, jobId: string | null | undefined, storage: Storage | null = getStorage()) {
  if (jobId && readPendingPreview(requestKey, storage)?.jobId === jobId) clearPendingPreview(requestKey, storage)
}

/** 같은 화면·다른 탭에서 완료 포인터가 바뀌면 현재 조합의 보기 상태를 다시 읽는다. */
export function subscribeCompletedPreview(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => { window.removeEventListener(CHANGE_EVENT, listener); window.removeEventListener('storage', listener) }
}

/** 일시 통신 오류는 보존하고, 서버가 결과 부재·만료·접근 거절을 확정한 경우만 포인터를 폐기한다. */
export function isCompletedPreviewUnavailable(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null
  return typeof code === 'string' && ['AI_JOB_NOT_FOUND', 'OUTFIT_PREVIEW_NOT_FOUND', 'OUTFIT_PREVIEW_EXPIRED', 'FORBIDDEN', 'UNAUTHENTICATED'].includes(code)
}
