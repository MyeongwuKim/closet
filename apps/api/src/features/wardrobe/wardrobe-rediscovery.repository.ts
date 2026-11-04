import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

export const wardrobeRediscoveryRepository = {
  /** 페이지·검색 조건 없이 현재 계정의 활성 옷 전체에서 선정에 필요한 정보만 읽는다. */
  findCandidates(userId: string) {
    return prisma.wardrobeItem.findMany({
      where: { userId, OR: [{ archivedAt: null }, { archivedAt: { isSet: false } }] },
      select: { id: true, createdAt: true, seasons: true, category: true, classificationStatus: true },
    })
  },
  /** 사용자 ID를 문서 기본키로 사용해 하루 선택과 노출 이력을 계정별로 조회한다. */
  findState(userId: string) {
    return prisma.wardrobeRediscovery.findUnique({ where: { userId } })
  },
  /** 첫 방문의 선택을 만든다. 동시 생성으로 이미 상태가 생겼다면 호출자가 다시 읽도록 false를 반환한다. */
  async createState(userId: string, day: string, itemIds: string[]) {
    try {
      await prisma.wardrobeRediscovery.create({ data: { userId, day, itemIds, impressions: {} } })
      return true
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false
      throw error
    }
  },
  /** 읽은 버전이 그대로일 때만 선택·노출 이력을 교체해 여러 탭의 기록이 덮어써지지 않게 한다. */
  async updateState(userId: string, version: number, data: { day?: string; itemIds?: string[]; impressions?: Record<string, string> }) {
    const result = await prisma.wardrobeRediscovery.updateMany({
      where: { userId, version }, data: { ...data, version: { increment: 1 } },
    })
    return result.count === 1
  },
}
