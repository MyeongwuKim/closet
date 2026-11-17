import { prisma } from '../../lib/prisma.js'

const dueAt = (now: Date) => ({ OR: [
  { rediscoveryPushNextAt: { lte: now } },
  { rediscoveryPushNextAt: null },
  { rediscoveryPushNextAt: { isSet: false } },
] })

/** 별도 수신 동의·다음 검사 시각을 계정 설정에서 읽고 여러 서버의 중복 발송을 막는다. */
export const rediscoveryPushRepository = {
  /** 오래 대기한 동의 계정부터 제한된 수만 읽는다. 기기가 로그아웃했는지는 발송 시 세션으로 다시 확인한다. */
  findDue(now: Date) {
    return prisma.userSettings.findMany({
      where: { rediscoveryPushEnabled: true, ...dueAt(now) },
      select: { userId: true }, orderBy: [{ rediscoveryPushNextAt: 'asc' }, { userId: 'asc' }], take: 50,
    })
  },

  /** 다음 발송 시각을 먼저 예약한다. 동시에 여러 worker가 읽어도 한 요청만 선점할 수 있다. */
  async claim(userId: string, now: Date, reservedUntil: Date) {
    const result = await prisma.userSettings.updateMany({
      where: { userId, rediscoveryPushEnabled: true, ...dueAt(now) },
      data: { rediscoveryPushNextAt: reservedUntil },
    })
    return result.count === 1
  },

  /** 후보를 조회하는 사이 수신 동의를 끄거나 다시 설정한 계정에는 발송하지 않는다. */
  async isCurrent(userId: string, reservedUntil: Date) {
    return Boolean(await prisma.userSettings.findFirst({
      where: { userId, rediscoveryPushEnabled: true, rediscoveryPushNextAt: reservedUntil }, select: { id: true },
    }))
  },

  /** 후보·활성 기기가 없으면 다음 아침에 다시 검사한다. 이후에 바뀐 사용자 설정은 덮어쓰지 않는다. */
  async retryTomorrow(userId: string, reservedUntil: Date, nextAt: Date) {
    await prisma.userSettings.updateMany({
      where: { userId, rediscoveryPushEnabled: true, rediscoveryPushNextAt: reservedUntil },
      data: { rediscoveryPushNextAt: nextAt },
    })
  },
}
