/**
 * 용도:
 * 푸시 토큰을 로그인 계정과 세션에 연결하고, 유효한 세션의 기기를 찾는다.
 *
 * 동작 방식:
 * 같은 기기가 다른 계정으로 로그인하면 토큰의 소유자를 갱신하고,
 * 로그아웃한 세션의 기기는 목록에서 제거한다.
 */
import type { PushPlatform } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

export const pushDeviceRepository = {
  register(input: {
    userId: string
    sessionTokenHash: string
    token: string
    platform: PushPlatform
  }) {
    return prisma.pushDevice.upsert({
      where: { expoPushToken: input.token },
      update: {
        userId: input.userId,
        sessionTokenHash: input.sessionTokenHash,
        platform: input.platform,
      },
      create: {
        userId: input.userId,
        sessionTokenHash: input.sessionTokenHash,
        expoPushToken: input.token,
        platform: input.platform,
      },
    })
  },

  deleteForSession(sessionTokenHash: string) {
    return prisma.pushDevice.deleteMany({ where: { sessionTokenHash } })
  },

  async findActiveTokensForUser(userId: string) {
    const sessions = await prisma.userSession.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { tokenHash: true },
    })
    if (sessions.length === 0) return []

    const devices = await prisma.pushDevice.findMany({
      where: {
        userId,
        sessionTokenHash: { in: sessions.map(({ tokenHash }) => tokenHash) },
      },
      select: { expoPushToken: true },
    })
    return devices.map(({ expoPushToken }) => expoPushToken)
  },
}
