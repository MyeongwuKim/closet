import type { AiCreditKind } from '@closet/types'
import type { GraphQLContext } from '../../graphql/context.js'
import { toGraphQLError } from '../../graphql/errors.js'
import { previewCreditService } from './preview-credit.service.js'

/** 모든 생성권·광고 번호 요청을 로그인 계정에 한정하며 다른 사용자의 잔액이나 보상을 변경하지 않는다. */
function owned<TArgs>(operation: (userId: string, args: TArgs) => Promise<unknown>) {
  return async (_: unknown, args: TArgs, context: GraphQLContext) => {
    try { return await operation((await context.getViewer()).id, args) }
    catch (error) { throw toGraphQLError(error, '생성권 정보를 처리하지 못했어요.', 'PREVIEW_CREDIT_FAILED') }
  }
}

export const previewCreditResolvers = {
  Query: {
    previewCredits: owned((userId, { kind }: { kind?: AiCreditKind }) => previewCreditService.balance(userId, kind)),
    previewRewardSession: owned((userId, { id }: { id: string }) => previewCreditService.rewardSession(userId, id)),
  },
  Mutation: {
    startPreviewReward: owned((userId, { kind }: { kind?: AiCreditKind }) => previewCreditService.startReward(userId, kind)),
    markPreviewRewardWatched: owned((userId, { id }: { id: string }) => previewCreditService.markWatched(userId, id)),
    completeTestPreviewReward: owned((userId, { id }: { id: string }) => previewCreditService.completeTestReward(userId, id)),
  },
}
