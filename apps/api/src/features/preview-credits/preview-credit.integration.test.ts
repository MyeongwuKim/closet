import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import test from 'node:test'
import { prisma } from '../../lib/prisma.js'
import { ensureAiStorage, aiTransaction } from '../../lib/ai/ai-storage.js'
import { previewJobRepository } from '../outfit/preview-job.repository.js'
import { previewCreditRepository, reservePreviewCredit } from './preview-credit.repository.js'
import { previewCreditService } from './preview-credit.service.js'
import { getPreviewCreditDay, TEST_REWARDED_AD_UNIT } from './preview-credit-policy.js'
import { withRecommendationCredit } from './recommendation-credit.service.js'
import { recommendationCreditRepository } from './recommendation-credit.repository.js'
import { outfitRecommendationService } from '../outfit/outfit-recommendation.service.js'
import { aiExecutor, createAiExecutor } from '../../lib/ai/ai-execution.js'

test('MongoDB 공통 AI 사용권·시간 충전·광고 보상 통합 검증', { skip: !process.env.AI_INTEGRATION_DATABASE }, async (t) => {
  await ensureAiStorage()
  const previousMode = process.env.ADMOB_REWARD_MODE
  process.env.ADMOB_REWARD_MODE = 'test'
  t.after(async () => { if (previousMode === undefined) delete process.env.ADMOB_REWARD_MODE; else process.env.ADMOB_REWARD_MODE = previousMode; await prisma.$disconnect() })
  const user = () => randomBytes(12).toString('hex')
  const itemIdsByUser = new Map<string, string[]>()
  const enqueue = async (userId: string, requestId = randomUUID(), fingerprint = 'same-input') => {
    let itemIds = itemIdsByUser.get(userId)
    if (!itemIds) {
      const items = await Promise.all([
        prisma.wardrobeItem.create({ data: { userId, name: '사용권 검사 상의', category: 'top', classificationStatus: 'classified' } }),
        prisma.wardrobeItem.create({ data: { userId, name: '사용권 검사 하의', category: 'bottom', classificationStatus: 'classified' } }),
      ])
      itemIds = items.map((item) => item.id)
      itemIdsByUser.set(userId, itemIds)
    }
    return previewJobRepository.enqueue({ id: requestId, userId, requestKey: requestId, inputKey: fingerprint, fingerprint, selectedItemIds: itemIds, style: null })
  }
  t.after(() => prisma.wardrobeItem.deleteMany({ where: { id: { in: [...itemIdsByUser.values()].flat() } } }))
  const emptyWallet = (userId: string) => prisma.aiCreditWallet.create({ data: { userId, balance: 0, refillStartedAt: new Date() } })

  await t.test('추천과 이미지의 동시 예약을 합쳐 5개까지만 사용한다', async () => {
    const userId = user()
    const results = await Promise.allSettled(Array.from({ length: 6 }, (_, index) => aiTransaction((tx) => reservePreviewCredit(tx, userId, new Date(), index % 2 ? 'preview' : 'recommendation'))))
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 5)
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 0)
    assert.equal((await previewCreditRepository.balance(userId, 'recommendation')).totalRemaining, 0)
    await assert.rejects(aiTransaction((tx) => reservePreviewCredit(tx, userId)), { code: 'PREVIEW_CREDITS_EXHAUSTED' })
    await assert.rejects(aiTransaction((tx) => reservePreviewCredit(tx, userId, new Date(), 'recommendation')), { code: 'RECOMMENDATION_CREDITS_EXHAUSTED' })
  })

  await t.test('같은 이미지 작업 재전송은 추가 차감하지 않고 실패 반환은 한 번만 반영한다', async () => {
    const userId = user()
    const job = await enqueue(userId)
    assert.equal((await enqueue(userId)).id, job.id)
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 4)
    await prisma.aiPreviewJob.update({ where: { id: job.id }, data: { status: 'processing', leaseToken: 'lease' } })
    const failed = { id: job.id, leaseToken: 'lease' }
    assert.equal((await previewJobRepository.fail(failed, 'failed', 'fixture', 'fixture')).count, 1)
    assert.equal((await previewJobRepository.fail(failed, 'failed', 'fixture', 'fixture')).count, 0)
    assert.equal((await previewCreditRepository.balance(userId, 'recommendation')).totalRemaining, 5)
  })

  await t.test('추천 1회와 룩북 1회는 같은 지갑에서 2개를 차감하며 완료 결과 조회는 추가 차감하지 않는다', async () => {
    const userId = user()
    await withRecommendationCredit(userId, 'first', async () => ({ headline: '추천' }))
    const job = await enqueue(userId)
    await prisma.aiPreviewJob.update({ where: { id: job.id }, data: { status: 'processing', leaseToken: 'lease' } })
    await previewJobRepository.complete({ id: job.id, leaseToken: 'lease' }, randomBytes(12).toString('hex'), 'fixture')
    assert.equal((await prisma.aiPreviewJob.findUniqueOrThrow({ where: { id: job.id } })).creditState, 'consumed')
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 3)
    assert.equal((await previewCreditRepository.balance(userId, 'recommendation')).totalRemaining, 3)
    assert.equal((await previewJobRepository.findOwned(userId, job.id))?.status, 'completed')
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 3)
  })

  await t.test('컬러·옷장 추천은 1개만 쓰고 잔액 0개에서도 같은 결과를 재사용하며 변경한 입력은 차감한다', async (t) => {
    const userId = user()
    await prisma.user.create({ data: { id: userId } })
    // 세 역할의 팔레트를 확인하는 입력은 단색임을 명시한다. 색 구성 미확인은 포인트를 확정하지 않는다.
    const top = await prisma.wardrobeItem.create({ data: { userId, name: '테스트 상의', category: 'top', classificationStatus: 'classified', colorName: '네이비', colorHex: '#15203B', colorMode: 'solid' } })
    const bottom = await prisma.wardrobeItem.create({ data: { userId, name: '테스트 하의', category: 'bottom', classificationStatus: 'classified', colorName: '그레이', colorHex: '#808080', colorMode: 'solid' } })
    await prisma.aiCreditWallet.create({ data: { userId, balance: 1, refillStartedAt: new Date() } })
    const previousKey = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'fixture-key'
    t.after(() => { if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey })
    t.mock.method(aiExecutor, 'run', createAiExecutor().run)
    const ai = t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
      const body = JSON.parse(String(options.body))
      const prompt = JSON.parse(body.input.find((message: { role: string }) => message.role === 'user').content)
      const grounded = prompt.groundedRecommendation
      return Response.json({ output_text: JSON.stringify({
        ...grounded,
        recommendedColors: grounded.recommendedColors.map(({ name, role, reason }: { name: string; role: string; reason: string }) => ({ name, role, reason })),
        candidates: grounded.candidates.slice(0, 5),
      }) })
    })
    const input = { selectedItemIds: [top.id], targetCategory: 'bottom' as const }
    const first = await outfitRecommendationService.recommend(userId, { ...input, mode: 'colors' })
    assert.equal(first.recommendedColors.length, 3)
    assert.equal(first.candidates[0]?.item.id, bottom.id)
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 0)
    await prisma.wardrobeItem.update({ where: { id: bottom.id }, data: { wearCount: 3 } })
    const reopened = await outfitRecommendationService.recommend(userId, { ...input, mode: 'items' })
    assert.equal(reopened.recommendedColors.length, 3)
    assert.equal(reopened.candidates[0]?.item.wearCount, 3)
    assert.ok(reopened.candidates[0]?.item.createdAt instanceof Date)
    assert.equal(ai.mock.callCount(), 1)
    assert.equal(await prisma.recommendationCreditUse.count({ where: { userId, state: 'consumed' } }), 1)
    await prisma.wardrobeItem.update({ where: { id: top.id }, data: { colorHex: '#000000' } })
    await assert.rejects(outfitRecommendationService.recommend(userId, input), { code: 'RECOMMENDATION_CREDITS_EXHAUSTED' })
    assert.equal(ai.mock.callCount(), 1)
    const ad = await previewCreditService.startReward(userId, 'recommendation')
    await previewCreditService.completeTestReward(userId, ad.id)
    await outfitRecommendationService.recommend(userId, input)
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 0)
    assert.equal(ai.mock.callCount(), 2)
  })

  await t.test('다른 기능에서 광고 번호를 받아도 같은 미완료 보상을 확인하며 지급은 한 번이다', async () => {
    const userId = user()
    await emptyWallet(userId)
    const first = await previewCreditService.startReward(userId)
    assert.equal((await previewCreditService.startReward(userId, 'recommendation')).id, first.id)
    await previewCreditService.markWatched(userId, first.id)
    assert.equal((await previewCreditRepository.balance(userId, 'recommendation')).pendingRewardSessionId, first.id)
    await Promise.all([previewCreditService.completeTestReward(userId, first.id), previewCreditService.completeTestReward(userId, first.id)])
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 1)
    assert.equal((await previewCreditRepository.balance(userId, 'recommendation')).totalRemaining, 1)
    await assert.rejects(previewCreditService.rewardSession(user(), first.id), { code: 'PREVIEW_REWARD_NOT_FOUND' })
  })

  await t.test('광고 보상은 하루 2회를 넘어도 받을 수 있고 다른 세션에서 같은 거래를 재사용하지 못한다', async () => {
    const userId = user()
    await emptyWallet(userId)
    const first = await previewCreditService.startReward(userId)
    const transactionId = randomUUID()
    const grant = (sessionId: string) => previewCreditRepository.grantReward({ sessionId, transactionId, mode: 'test', adUnitId: TEST_REWARDED_AD_UNIT, eventAt: new Date() })
    await grant(first.id)
    const second = await previewCreditService.startReward(userId, 'recommendation')
    await assert.rejects(grant(second.id), { code: 'INVALID_AD_REWARD' })
    await previewCreditService.completeTestReward(userId, second.id)
    const third = await previewCreditService.startReward(userId)
    await previewCreditService.completeTestReward(userId, third.id)
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 3)
    assert.equal((await previewCreditRepository.balance(userId)).adRewardsRemaining, null)
  })

  await t.test('같은 추천 입력 조회는 재사용하고 광고로 받은 사용권도 룩북에 쓸 수 있다', async () => {
    const userId = user()
    let calls = 0
    const recommend = (variation: number) => withRecommendationCredit(userId, { variation }, async () => ({ headline: `추천 ${++calls}` }))
    for (let index = 0; index < 5; index++) await recommend(index)
    assert.deepEqual(await recommend(0), { headline: '추천 1' })
    assert.equal(calls, 5)
    await assert.rejects(recommend(5), { code: 'RECOMMENDATION_CREDITS_EXHAUSTED' })
    const ad = await previewCreditService.startReward(userId, 'recommendation')
    await previewCreditService.completeTestReward(userId, ad.id)
    const job = await enqueue(userId)
    assert.equal(job.creditSource, 'wallet')
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 0)
  })

  await t.test('추천 실패·만료는 원래 예약을 한 번 반환하고 늦은 완료는 새 예약을 바꾸지 않는다', async () => {
    const userId = user()
    assert.equal(await withRecommendationCredit(userId, 'failed', async () => null), null)
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 5)
    const old = await recommendationCreditRepository.reserve(userId, 'expired')
    await prisma.recommendationCreditUse.update({ where: { id: old.id }, data: { leaseUntil: new Date(0) } })
    const next = await recommendationCreditRepository.reserve(userId, 'expired')
    assert.notEqual(next.token, old.token)
    assert.equal(await recommendationCreditRepository.settle(userId, old.id, old.token, '"late"'), false)
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 4)
    await recommendationCreditRepository.settle(userId, next.id, next.token, null)
    await recommendationCreditRepository.settle(userId, next.id, next.token, null)
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 5)
  })

  await t.test('서버의 경과 시간만으로 충전하고 최대 5개에서는 충전을 멈춘다', async () => {
    const userId = user()
    const first = await previewCreditRepository.balance(userId)
    assert.equal(first.capacity, 5)
    assert.equal(first.totalRemaining, 5)
    assert.equal(first.nextRefillAt, null)
    await prisma.aiCreditWallet.update({ where: { userId }, data: { balance: 0, refillStartedAt: new Date(Date.now() - 90 * 60_000) } })
    const replenished = await previewCreditRepository.balance(userId)
    assert.equal(replenished.totalRemaining, 1)
    assert.ok(Date.parse(replenished.nextRefillAt!) > Date.now() + 29 * 60_000)
    assert.ok(Date.parse(replenished.nextRefillAt!) < Date.now() + 31 * 60_000)
    assert.equal((await previewCreditRepository.balance(userId, 'recommendation')).totalRemaining, 1)
    await prisma.aiCreditWallet.update({ where: { userId }, data: { refillStartedAt: new Date(Date.now() - 24 * 60 * 60_000) } })
    const full = await previewCreditRepository.balance(userId)
    assert.equal(full.totalRemaining, 5)
    assert.equal(full.nextRefillAt, null)
    assert.equal((await prisma.aiCreditWallet.findUniqueOrThrow({ where: { userId } })).refillStartedAt, null)
  })

  await t.test('광고 보상은 최대 5개를 넘지 않고 가득 차면 추가 광고를 시작하지 않는다', async () => {
    const userId = user()
    await prisma.aiCreditWallet.create({ data: { userId, balance: 4, refillStartedAt: new Date() } })
    const session = await previewCreditService.startReward(userId)
    await Promise.all([previewCreditService.completeTestReward(userId, session.id), previewCreditService.completeTestReward(userId, session.id)])
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 5)
    await assert.rejects(previewCreditService.startReward(userId), { code: 'AI_CREDITS_FULL' })
  })

  await t.test('정책 전환 전 추천 예약의 실패 반환은 이전 날짜에 반영한다', async () => {
    const userId = user()
    const day = getPreviewCreditDay(userId, new Date(), 'recommendation')
    await prisma.previewCreditDay.create({ data: { id: day.id, userId, day: day.day, freeUsed: 1, expiresAt: new Date(Date.now() + 86_400_000) } })
    const use = await prisma.recommendationCreditUse.create({ data: { id: randomUUID(), userId, creditDayId: day.id, creditSource: 'free', state: 'reserved', token: 'old-token', leaseUntil: new Date(Date.now() + 60_000), expiresAt: new Date(Date.now() + 86_400_000) } })
    await recommendationCreditRepository.settle(userId, use.id, use.token, null)
    assert.equal((await prisma.previewCreditDay.findUniqueOrThrow({ where: { id: day.id } })).freeUsed, 0)
    assert.equal((await previewCreditRepository.balance(userId)).totalRemaining, 5)
  })
})
