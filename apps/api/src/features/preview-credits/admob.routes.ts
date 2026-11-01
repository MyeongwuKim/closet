import type { FastifyInstance } from 'fastify'
import { ServiceError } from '../../graphql/errors.js'
import { getPreviewRewardConfig } from './preview-credit-policy.js'
import { previewCreditRepository } from './preview-credit.repository.js'
import { verifyAdmobReward } from './admob-verification.js'

/** Google이 호출하는 공개 검증 주소다. 로그인 토큰 대신 원본 URL 서명·광고 단위·서버 발급 번호를 검증한다. */
export async function registerAdmobRoutes(app: FastifyInstance) {
  app.get('/ads/admob/reward', async (request, reply) => {
    const config = getPreviewRewardConfig()
    if (config.mode !== 'production') return reply.code(503).send({ error: 'REWARDS_DISABLED' })
    try {
      const reward = await verifyAdmobReward(request.raw.url ?? '')
      if (reward.adUnitId !== config.adUnitId && reward.adUnitId !== config.adUnitId.split('/')[1]) throw new ServiceError('등록되지 않은 광고입니다.', 'INVALID_AD_REWARD')
      await previewCreditRepository.grantReward({ ...reward, adUnitId: config.adUnitId })
      return { ok: true }
    } catch (error) {
      if (error instanceof ServiceError) return reply.code(400).send({ error: error.code })
      request.log.warn('광고 검증 저장소 또는 공개키 조회 실패')
      return reply.code(503).send({ error: 'REWARD_VERIFICATION_UNAVAILABLE' })
    }
  })
}
