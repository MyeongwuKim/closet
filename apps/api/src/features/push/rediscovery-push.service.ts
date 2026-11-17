import { wardrobeRediscoveryService } from '../wardrobe/wardrobe-rediscovery.service.js'
import { pushService } from './push.service.js'
import { rediscoveryPushRepository as repository } from './rediscovery-push.repository.js'
import { isRediscoveryPushHour, nextRediscoveryMorning, REDISCOVERY_PUSH_INTERVAL_MS } from './rediscovery-push.rules.js'

/**
 * 별도 동의 계정에 현재 계절의 재발견 후보가 있을 때만 주 1회 푸시를 보낸다.
 * 선점 후 실제 발송이 실패하면 중복 수신을 피하려고 주간 간격을 유지한다. 목록 조회는 노출 확인이나 AI 실행이 아니다.
 */
export async function sendDueRediscoveryPushes(now = new Date()) {
  if (!isRediscoveryPushHour(now)) return 0
  const accounts = await repository.findDue(now)
  let sent = 0
  for (const { userId } of accounts) {
    const reservedUntil = new Date(now.getTime() + REDISCOVERY_PUSH_INTERVAL_MS)
    if (!await repository.claim(userId, now, reservedUntil)) continue
    try {
      const rediscovery = await wardrobeRediscoveryService.get(userId)
      if (!rediscovery.items.length) {
        await repository.retryTomorrow(userId, reservedUntil, nextRediscoveryMorning(now))
        continue
      }
      if (!await repository.isCurrent(userId, reservedUntil)) continue
      if (await pushService.sendRediscovery(userId)) sent++
      else await repository.retryTomorrow(userId, reservedUntil, nextRediscoveryMorning(now))
    } catch {
      console.warn('[rediscovery-push] reminder failed')
    }
  }
  return sent
}

/** 서버 시작·매분에 발송 대상을 확인하며 종료할 때 진행 중인 검사·전송을 기다린다. */
export function startRediscoveryPushWorker() {
  let running: Promise<unknown> | null = null
  let stopped = false
  const tick = () => {
    if (stopped || running) return
    running = sendDueRediscoveryPushes().catch(() => console.warn('[rediscovery-push] check failed')).finally(() => { running = null })
  }
  const timer = setInterval(tick, 60_000)
  timer.unref()
  tick()
  return async () => { stopped = true; clearInterval(timer); await running }
}
