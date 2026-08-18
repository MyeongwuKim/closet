import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { ServiceError } from '../../graphql/errors.js'
import { authRepository } from './auth.repository.js'

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export interface TestLoginInput {
  loginId: string
  password: string
  displayName?: string | null
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex')
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function normalizeLoginInput(input: TestLoginInput) {
  const loginId = input.loginId.trim().toLowerCase()
  const displayName = input.displayName?.trim() || loginId

  if (!/^[a-z0-9._-]{3,30}$/.test(loginId)) {
    throw new ServiceError(
      '테스트 ID는 영문, 숫자, 점, 밑줄, 하이픈으로 3~30자여야 합니다.',
      'INVALID_TEST_LOGIN',
    )
  }
  if (input.password.length < 4 || input.password.length > 72) {
    throw new ServiceError(
      '비밀번호는 4~72자로 입력해주세요.',
      'INVALID_TEST_LOGIN',
    )
  }
  if (displayName.length > 30) {
    throw new ServiceError(
      '표시 이름은 30자 이하로 입력해주세요.',
      'INVALID_TEST_LOGIN',
    )
  }

  return { loginId, password: input.password, displayName }
}

export const authService = {
  async testLogin(input: TestLoginInput) {
    const normalized = normalizeLoginInput(input)
    const account = await authRepository.findTestAccount(normalized.loginId)
    let viewer

    if (account) {
      const expectedHash = Buffer.from(account.passwordHash, 'hex')
      const receivedHash = Buffer.from(
        hashPassword(normalized.password, account.passwordSalt),
        'hex',
      )
      if (
        expectedHash.length !== receivedHash.length ||
        !timingSafeEqual(expectedHash, receivedHash)
      ) {
        throw new ServiceError(
          '테스트 ID 또는 비밀번호가 맞지 않습니다.',
          'INVALID_TEST_CREDENTIALS',
        )
      }
      viewer = await authRepository.updateLastLogin(account.userId)
    } else {
      const passwordSalt = randomBytes(16).toString('hex')
      viewer = await authRepository.createTestUser({
        loginId: normalized.loginId,
        displayName: normalized.displayName,
        passwordSalt,
        passwordHash: hashPassword(normalized.password, passwordSalt),
      })
    }

    const accessToken = randomBytes(32).toString('base64url')
    await authRepository.createSession(
      viewer.id,
      hashToken(accessToken),
      new Date(Date.now() + SESSION_DURATION_MS),
    )

    return { accessToken, viewer }
  },

  async getViewer(accessToken?: string) {
    if (!accessToken) {
      throw new ServiceError('로그인이 필요합니다.', 'UNAUTHENTICATED')
    }

    const session = await authRepository.findSession(hashToken(accessToken))
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) await authRepository.deleteSession(session.tokenHash)
      throw new ServiceError('로그인 세션이 만료되었습니다.', 'UNAUTHENTICATED')
    }

    void authRepository.touchSession(session.id)
    return session.user
  },

  async logout(accessToken?: string) {
    if (!accessToken) return
    await authRepository.deleteSession(hashToken(accessToken))
  },
}
