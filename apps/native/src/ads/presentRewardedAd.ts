export type RewardedAdResult = { status: 'earned' | 'cancelled' } | { status: 'unavailable'; message: string }

interface RewardedAdDriver {
  onLoaded: (callback: () => void) => () => void
  onEarned: (callback: () => void) => () => void
  onClosed: (callback: () => void) => () => void
  onError: (callback: () => void) => () => void
  load: () => void
  show: () => Promise<void>
}

/**
 * 광고 로드·표시·보상·닫힘을 하나의 결과로 연결한다. 끝까지 보지 않고 닫으면 cancelled다.
 * 보상 이벤트 뒤 광고가 닫힐 때 결과를 반환하고, 모든 종료 경로에서 리스너·타이머를 해제한다.
 */
export function presentRewardedAd(ad: RewardedAdDriver, { loadTimeoutMs = 45_000, totalTimeoutMs = 6 * 60_000 } = {}): Promise<RewardedAdResult> {
  return new Promise((resolve) => {
    let settled = false
    let earned = false
    let loaded = false
    const unsubscribers: (() => void)[] = []
    const finish = (result: RewardedAdResult) => {
      if (settled) return
      settled = true
      clearTimeout(loadTimeout)
      clearTimeout(totalTimeout)
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      resolve(result)
    }
    const fail = () => finish({ status: 'unavailable', message: '광고를 불러오지 못했어요. 생성권은 차감되지 않았습니다.' })
    const loadTimeout = setTimeout(fail, loadTimeoutMs)
    const totalTimeout = setTimeout(() => finish(earned ? { status: 'earned' } : { status: 'unavailable', message: '광고 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.' }), totalTimeoutMs)
    unsubscribers.push(ad.onLoaded(() => {
      if (settled || loaded) return
      loaded = true
      clearTimeout(loadTimeout)
      void ad.show().catch(fail)
    }), ad.onEarned(() => { earned = true }), ad.onClosed(() => finish({ status: earned ? 'earned' : 'cancelled' })), ad.onError(fail))
    try { ad.load() } catch { fail() }
  })
}
