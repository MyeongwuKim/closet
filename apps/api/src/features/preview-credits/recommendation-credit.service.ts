import { setTimeout as delay } from 'node:timers/promises'
import { ServiceError } from '../../graphql/errors.js'
import { recommendationCreditRepository } from './recommendation-credit.repository.js'

/** 같은 입력을 처리 중이면 최대 3분 동안 결과를 기다린다. 중복 요청은 추가 예약이나 AI 호출을 수행하지 않는다. */
async function reserveOrWait(userId: string, input: unknown) {
  const deadline = Date.now() + 180_000
  while (true) {
    try { return await recommendationCreditRepository.reserve(userId, input) }
    catch (error) {
      if (!(error instanceof ServiceError) || error.code !== 'AI_BUSY' || Date.now() >= deadline) throw error
      await delay(250)
    }
  }
}

/** 추천 설명을 만들기 전에 횟수를 예약한다. 같은 입력의 성공 결과는 재사용하고, 실패하면 원래 날짜의 횟수를 반환한다. */
export async function withRecommendationCredit<T>(userId: string, input: unknown, operation: () => Promise<T | null>): Promise<T | null> {
  const reservation = await reserveOrWait(userId, input)
  if (reservation.resultText !== null) return JSON.parse(reservation.resultText) as T
  try {
    const result = await operation()
    if (!await recommendationCreditRepository.settle(userId, reservation.id, reservation.token, result === null ? null : JSON.stringify(result))) {
      throw new ServiceError('추천 요청이 만료됐어요. 횟수는 차감되지 않았습니다. 다시 시도해 주세요.', 'AI_INTERRUPTED')
    }
    return result
  } catch (error) {
    await recommendationCreditRepository.settle(userId, reservation.id, reservation.token, null)
    throw error
  }
}
