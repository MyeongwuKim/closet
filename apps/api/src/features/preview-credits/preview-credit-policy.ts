import type { AiCreditKind } from '@closet/types'
import { aiInputKey } from '../../lib/ai/ai-execution.js'

export const TEST_REWARDED_AD_UNIT = 'ca-app-pub-3940256099942544/1712485313'

/** 개발 서버에서만 광고 없이 사용권을 채우는 테스트 기능을 허용한다. */
export function canRefillTestAiCredits() {
  return process.env.NODE_ENV !== 'production'
}

/** 추천 결과 캐시·이전 예약 반환에 쓰는 한국 시간 날짜 키를 계산한다. 공통 지갑의 시간 충전은 이 날짜와 무관하다. */
export function getPreviewCreditDay(userId: string, now = new Date(), kind: AiCreditKind = 'preview') {
  const kst = now.getTime() + 9 * 60 * 60_000
  const day = new Date(kst).toISOString().slice(0, 10)
  const resetsAt = new Date((Math.floor(kst / 86_400_000) + 1) * 86_400_000 - 9 * 60 * 60_000)
  return { id: aiInputKey([kind === 'preview' ? 'preview-credit' : 'recommendation-credit', userId, day]), day, resetsAt }
}

/** 로컬은 테스트 광고를 기본으로 사용한다. 운영 서버는 명시적인 실제 광고 설정이 없으면 보상을 비활성화한다. */
export function getPreviewRewardConfig() {
  const configured = process.env.ADMOB_REWARD_MODE ?? (process.env.NODE_ENV === 'production' ? 'disabled' : 'test')
  if (configured === 'test' && process.env.NODE_ENV !== 'production') return { mode: 'test' as const, adUnitId: TEST_REWARDED_AD_UNIT }
  const adUnitId = process.env.ADMOB_REWARDED_AD_UNIT_ID?.trim()
  if (configured === 'production' && adUnitId && /^ca-app-pub-\d{16}\/\d{10}$/.test(adUnitId) && !adUnitId.startsWith('ca-app-pub-3940256099942544/')) {
    return { mode: 'production' as const, adUnitId }
  }
  return { mode: 'disabled' as const, adUnitId: '' }
}

