import { ServiceError } from '../../graphql/errors.js'
import { accountDeletionRepository } from './account-deletion.repository.js'

export const accountDeletionService = {
  /** 명시적 최종 확인을 검증하고 인증된 본인만 탈퇴시킨다. 사용자 ID를 클라이언트 입력으로 받지 않는다. */
  async deleteAccount(userId: string, confirmation: string) {
    if (confirmation !== '회원탈퇴') throw new ServiceError('회원탈퇴 확인이 필요해요.', 'ACCOUNT_DELETION_CONFIRMATION_REQUIRED')
    const deleted = await accountDeletionRepository.deleteOwnedAccount(userId)
    if (!deleted) throw new ServiceError('로그인이 필요해요.', 'UNAUTHENTICATED')
    return true
  },
}
