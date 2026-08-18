import { prisma } from '../../lib/prisma.js'
import { viewerInclude } from '../user/user.repository.js'

export const authRepository = {
  findTestAccount(loginId: string) {
    return prisma.testAccount.findUnique({
      where: { loginId },
      include: { user: { include: viewerInclude } },
    })
  },

  createTestUser(input: {
    loginId: string
    displayName: string
    passwordHash: string
    passwordSalt: string
  }) {
    return prisma.user.create({
      data: {
        displayName: input.displayName,
        isTemporary: true,
        lastLoginAt: new Date(),
        testAccount: {
          create: {
            loginId: input.loginId,
            passwordHash: input.passwordHash,
            passwordSalt: input.passwordSalt,
          },
        },
        styleProfile: { create: { preferredFit: 'regular' } },
      },
      include: viewerInclude,
    })
  },

  updateLastLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
      include: viewerInclude,
    })
  },

  createSession(userId: string, tokenHash: string, expiresAt: Date) {
    return prisma.userSession.create({
      data: { userId, tokenHash, expiresAt },
    })
  },

  findSession(tokenHash: string) {
    return prisma.userSession.findUnique({
      where: { tokenHash },
      include: { user: { include: viewerInclude } },
    })
  },

  touchSession(id: string) {
    return prisma.userSession.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    })
  },

  deleteSession(tokenHash: string) {
    return prisma.userSession.deleteMany({ where: { tokenHash } })
  },
}
