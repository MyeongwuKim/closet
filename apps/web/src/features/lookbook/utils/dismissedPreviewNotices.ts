const PREFIX = 'closet:dismissed-preview-notices:v1:'
const RETENTION_MS = 24 * 60 * 60 * 1000

function readDismissedNotices(viewerId: string, now: number) {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(`${PREFIX}${viewerId}`) ?? 'null')
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value).filter((entry): entry is [string, number] => {
        const dismissedAt = entry[1]
        return typeof dismissedAt === 'number' && dismissedAt <= now && now - dismissedAt < RETENTION_MS
      })
      return new Map(entries)
    }
  } catch {
    // 기록이 손상되거나 저장소에 접근할 수 없으면 서버와 현재 화면의 상태를 사용한다.
  }
  return new Map<string, number>()
}

/** 웹뷰를 다시 열었을 때 이 계정에서 이미 닫은 작업 안내인지 확인한다. */
export function wasPreviewNoticeDismissed(viewerId: string, jobId: string) {
  return readDismissedNotices(viewerId, Date.now()).has(jobId)
}

/** 작업 목록의 보관 기간 동안 닫은 작업 번호와 시각을 기기에 저장한다. */
export function rememberDismissedPreviewNotices(viewerId: string, jobIds: string[]) {
  const now = Date.now()
  try {
    const notices = readDismissedNotices(viewerId, now)
    for (const id of jobIds) notices.set(id, now)
    window.localStorage.setItem(`${PREFIX}${viewerId}`, JSON.stringify(Object.fromEntries(notices)))
  } catch {
    // 저장소를 사용할 수 없을 때는 현재 화면의 닫기 상태와 서버 확인을 사용한다.
  }
}
