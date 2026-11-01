import type { AiCreditKind } from '@closet/types'
import type { PreviewRewardSession } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { getPreviewRewardConfig } from './preview-credit-policy.js'
import { previewCreditRepository } from './preview-credit.repository.js'

/** 계정 ID·보관 기한은 숨기고 광고 표시에 필요한 서버 발급 번호와 상태만 전달한다. */
export function toRewardSession(session: PreviewRewardSession) {
  return { id: session.id, mode: session.mode, adUnitId: session.adUnitId, status: session.status,
    watchedAt: session.watchedAt?.toISOString() ?? null, validUntil: session.validUntil.toISOString() }
}

/** 광고 세션의 소유권과 로컬 테스트 허용 여부를 확인하고 생성권 저장소에 위임한다. */
export const previewCreditService = {
  balance: previewCreditRepository.balance,
  async startReward(userId: string, kind: AiCreditKind = 'preview') { return toRewardSession(await previewCreditRepository.startReward(userId, kind)) },
  async rewardSession(userId: string, id: string) { return toRewardSession(await previewCreditRepository.rewardSession(userId, id)) },
  async markWatched(userId: string, id: string) { return toRewardSession(await previewCreditRepository.markWatched(userId, id)) },
  /** Google 테스트 광고는 실제 SSV가 없으므로 로컬 서버에서만 앱의 완료 이벤트를 받아 지급한다. 운영에서는 항상 거절한다. */
  async completeTestReward(userId: string, id: string) {
    const config = getPreviewRewardConfig()
    if (config.mode !== 'test' || process.env.NODE_ENV === 'production') throw new ServiceError('테스트 광고 보상은 개발 환경에서만 사용할 수 있어요.', 'TEST_REWARD_DISABLED')
    const session = await previewCreditRepository.rewardSession(userId, id)
    return toRewardSession(await previewCreditRepository.grantReward({ sessionId: session.id, mode: 'test', adUnitId: config.adUnitId, transactionId: `test-${session.id}`, eventAt: new Date() }))
  },
}
