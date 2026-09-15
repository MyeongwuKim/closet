/**
 * 용도:
 * 코디 만들기에서 생성한 임시 AI 룩북을 아이템 조합별로 잠시 보관한다.
 *
 * 동작 방식:
 * 사용자, 스타일, 아이템 ID로 키를 만들고 서버 이미지 ID와 URL만
 * 브라우저 저장소에 최대 1시간·최근 10개까지 유지한다.
 */
import type { StoredOutfitPreview } from '@closet/types'

const STORAGE_PREFIX = 'outfit-preview-cache:v1:'
const CACHE_RETENTION_MS = 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 10

interface CachedOutfitPreview {
  compositionKey: string
  cachedAt: number
  preview: StoredOutfitPreview
}

function getBrowserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function getStorageKey(viewerId: string) {
  return `${STORAGE_PREFIX}${viewerId}`
}

function readEntries(viewerId: string, storage: Storage) {
  try {
    const parsed = JSON.parse(storage.getItem(getStorageKey(viewerId)) ?? '[]')
    return Array.isArray(parsed) ? (parsed as CachedOutfitPreview[]) : []
  } catch {
    storage.removeItem(getStorageKey(viewerId))
    return []
  }
}

function writeEntries(
  viewerId: string,
  entries: CachedOutfitPreview[],
  storage: Storage,
) {
  if (entries.length === 0) {
    storage.removeItem(getStorageKey(viewerId))
    return
  }
  storage.setItem(getStorageKey(viewerId), JSON.stringify(entries))
}

export function getOutfitPreviewCompositionKey(
  itemIds: string[],
  style: string,
) {
  return `${style}:${[...new Set(itemIds)].sort().join('|')}`
}

export function readCachedOutfitPreview(
  viewerId: string,
  compositionKey: string,
  options: { storage?: Storage | null; now?: number } = {},
) {
  const storage = options.storage ?? getBrowserStorage()
  if (!storage) return undefined

  const now = options.now ?? Date.now()
  const activeEntries = readEntries(viewerId, storage).filter(
    (entry) => now - entry.cachedAt < CACHE_RETENTION_MS,
  )
  writeEntries(viewerId, activeEntries, storage)
  return activeEntries.find(
    (entry) => entry.compositionKey === compositionKey,
  )?.preview
}

export function cacheOutfitPreview(
  viewerId: string,
  compositionKey: string,
  preview: StoredOutfitPreview,
  options: { storage?: Storage | null; now?: number } = {},
) {
  const storage = options.storage ?? getBrowserStorage()
  if (!storage) return

  const now = options.now ?? Date.now()
  const entries = readEntries(viewerId, storage)
    .filter(
      (entry) =>
        now - entry.cachedAt < CACHE_RETENTION_MS &&
        entry.compositionKey !== compositionKey,
    )
    .slice(-(MAX_CACHE_ENTRIES - 1))
  entries.push({ compositionKey, cachedAt: now, preview })
  writeEntries(viewerId, entries, storage)
}
