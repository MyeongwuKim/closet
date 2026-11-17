import { randomUUID } from 'node:crypto'
import { prisma } from '../../lib/prisma.js'

const available = (now: Date) => ({ retryAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { isSet: false } }, { leaseUntil: { lte: now } }] })

export const accountImageCleanupRepository = {
  /** 탈퇴와 겹쳐 저장이 거절된 업로드도 원격 삭제 실패 시 파일 번호만 보관한다. 중복 등록은 기존 임대를 유지한다. */
  enqueue(cloudflareImageId: string) {
    return prisma.accountImageCleanup.upsert({ where: { cloudflareImageId }, update: {}, create: { cloudflareImageId } })
  },

  /** 여러 API 서버 중 한 곳만 원격 파일을 삭제하도록 만료된 작업 한 건을 원자적으로 임대한다. */
  async claim(now = new Date()) {
    const task = await prisma.accountImageCleanup.findFirst({ where: available(now), orderBy: [{ retryAt: 'asc' }, { cloudflareImageId: 'asc' }] })
    if (!task) return null
    const leaseToken = randomUUID()
    const claimed = await prisma.accountImageCleanup.updateMany({ where: { cloudflareImageId: task.cloudflareImageId, ...available(now) },
      data: { leaseToken, leaseUntil: new Date(now.getTime() + 60_000) } })
    return claimed.count === 1 ? { cloudflareImageId: task.cloudflareImageId, leaseToken } : null
  },

  /** 자신의 임대가 유지되는 성공 작업만 지운다. 오래된 응답은 새 작업을 완료 처리할 수 없다. */
  complete(cloudflareImageId: string, leaseToken: string) {
    return prisma.accountImageCleanup.deleteMany({ where: { cloudflareImageId, leaseToken } })
  },

  /** CF·DB 실패는 계정 복원 없이 1분 후 재시도한다. 실패한 파일 번호는 유실하지 않는다. */
  retry(cloudflareImageId: string, leaseToken: string) {
    return prisma.accountImageCleanup.updateMany({ where: { cloudflareImageId, leaseToken }, data: { leaseToken: null, leaseUntil: null, retryAt: new Date(Date.now() + 60_000) } })
  },
}

/** 탈퇴 트랜잭션에서 새 컬렉션을 만들지 않도록 서버 시작 시 큐와 조회 인덱스만 준비한다. */
export async function ensureAccountImageCleanupStorage() {
  try { await prisma.$runCommandRaw({ create: 'AccountImageCleanup' }) }
  catch (error) { if (!/NamespaceExists|already exists/i.test(String(error))) throw error }
  await prisma.$runCommandRaw({ createIndexes: 'AccountImageCleanup', indexes: [{ key: { retryAt: 1 }, name: 'AccountImageCleanup_retryAt_idx' }] })
}
