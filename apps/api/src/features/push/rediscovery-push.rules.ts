const DAY_MS = 86_400_000
/** 한 계정에 잠든 옷 푸시를 다시 보내기까지의 최소 간격. */
export const REDISCOVERY_PUSH_INTERVAL_MS = 7 * DAY_MS

/** 한국 시간 다음 오전 9시. 동의 직후 즉시 발송하지 않고 다음 아침부터 후보를 검사한다. */
export function nextRediscoveryMorning(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
}

/** 늦게 시작한 서버도 한국 시간 오전 9시부터 오후 8시 전까지만 리마인드를 발송한다. */
export function isRediscoveryPushHour(now: Date) {
  return now.getUTCHours() < 11
}
