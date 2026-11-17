import { prisma } from '../../lib/prisma.js'
import { randomUUID } from 'node:crypto'
import { aiTransaction, touchAiMutex } from '../../lib/ai/ai-storage.js'
import { aiInputKey, type AiKind } from '../../lib/ai/ai-execution.js'

const aiKinds: AiKind[] = ['classification', 'size-chart', 'cutout', 'recommendation', 'today-recommendation', 'preview']

export const accountDeletionRepository = {
  /**
   * 인증된 본인의 모든 세션·설정·옷·코디·일정·AI 작업·사용권을 자식부터 같은 트랜잭션에서 삭제한다.
   * 원격 파일 번호는 계정과 분리한 재시도 큐에 먼저 남긴다. 외부 호출은 커밋 뒤 worker가 수행한다.
   */
  deleteOwnedAccount(userId: string) {
    return aiTransaction(async tx => {
      await touchAiMutex(tx, `account-lifecycle:${userId}`, randomUUID(), new Date())
      // 이미지 신규 저장도 같은 User 행을 써서 탈퇴 뒤 늦은 생성 결과가 다시 연결되지 않게 한다.
      const owner = await tx.user.updateMany({ where: { id: userId }, data: { updatedAt: new Date() } })
      if (owner.count !== 1) return false
      const [outfits, weeks, images, rewardSessions, executions] = await Promise.all([
        tx.outfit.findMany({ where: { userId }, select: { id: true } }),
        tx.plannerWeek.findMany({ where: { userId }, select: { id: true } }),
        tx.imageAsset.findMany({ where: { userId }, select: { cloudflareImageId: true } }),
        tx.previewRewardSession.findMany({ where: { userId }, select: { id: true } }),
        tx.aiExecution.findMany({ where: { userId }, select: { id: true, leaseToken: true } }),
      ])
      if (images.length) {
        const queued = await tx.accountImageCleanup.findMany({ where: { cloudflareImageId: { in: images.map(image => image.cloudflareImageId) } }, select: { cloudflareImageId: true } })
        const existing = new Set(queued.map(task => task.cloudflareImageId))
        const pending = images.filter(image => !existing.has(image.cloudflareImageId))
        if (pending.length) await tx.accountImageCleanup.createMany({ data: pending })
      }
      await tx.pushDevice.deleteMany({ where: { userId } })
      await tx.userSession.deleteMany({ where: { userId } })
      await tx.plannerEntry.deleteMany({ where: { plannerWeekId: { in: weeks.map(week => week.id) } } })
      await tx.outfitGeneration.deleteMany({ where: { userId } })
      await tx.outfitItem.deleteMany({ where: { outfitId: { in: outfits.map(outfit => outfit.id) } } })
      await tx.plannerWeek.deleteMany({ where: { userId } })
      await tx.outfit.deleteMany({ where: { userId } })
      await tx.wardrobeRediscovery.deleteMany({ where: { userId } })
      await tx.wardrobeItem.deleteMany({ where: { userId } })
      await tx.aiPreviewJob.deleteMany({ where: { userId } })
      await tx.imageAsset.deleteMany({ where: { userId } })
      await tx.recommendationCreditUse.deleteMany({ where: { userId } })
      await tx.previewRewardReceipt.deleteMany({ where: { sessionId: { in: rewardSessions.map(session => session.id) } } })
      await tx.previewRewardSession.deleteMany({ where: { userId } })
      await tx.previewCreditDay.deleteMany({ where: { userId } })
      await tx.aiCreditWallet.deleteMany({ where: { userId } })
      await tx.aiExecution.deleteMany({ where: { userId } })
      await tx.aiQuota.deleteMany({ where: { id: { in: aiKinds.map(kind => aiInputKey([userId, kind])) } } })
      await tx.aiLease.deleteMany({ where: { OR: [
        { id: { startsWith: `user:${aiInputKey(userId)}:` } },
        { id: { in: executions.map(execution => `execution:${execution.id}`) } },
        { token: { in: executions.map(execution => execution.leaseToken) } },
      ] } })
      await tx.userStylePreference.deleteMany({ where: { userId } })
      await tx.styleProfile.deleteMany({ where: { userId } })
      await tx.userSettings.deleteMany({ where: { userId } })
      await tx.oAuthAccount.deleteMany({ where: { userId } })
      await tx.testAccount.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
      return true
    }, { timeout: 30_000 })
  },
}
