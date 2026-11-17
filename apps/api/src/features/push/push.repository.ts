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
  /** 발송 시점의 완료·실패 푸시 수신 선택을 읽는다. 설정이나 필드가 없으면 기존 수신 동작을 유지한다. */
  async isCompletionPushEnabled(userId: string) {
    const settings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { completionPushEnabled: true },
    })
    return settings?.completionPushEnabled ?? true
  },

  /** CLI에 명시한 기존 테스트 계정의 발송 대상만 조회한다. 비밀번호·푸시 토큰은 계정 조회 결과에 포함하지 않는다. */
  findTestAccountTarget(loginId: string) {
    return prisma.testAccount.findUnique({ where: { loginId }, select: { loginId: true, userId: true } })
  },

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
