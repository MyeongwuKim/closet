/**
 * 용도:
 * 로그인한 기기의 Expo 푸시 토큰을 검증하고 테스트·AI 완료 알림을 발송한다.
 *
 * 동작 방식:
 * 토큰을 현재 계정·세션에 저장하고 유효한 세션의 기기에만 알림을 보낸다.
 * 완료 알림은 등록 기기가 없으면 조용히 건너뛰고, 테스트 알림은 오류를 반환한다.
 */
import type { PushPlatform } from '@prisma/client'
import { hashSessionToken } from '../auth/sessionToken.js'
import { ServiceError } from '../../graphql/errors.js'
import { pushDeviceRepository } from './push.repository.js'

const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send'
const expoTokenPattern = /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/

interface ExpoPushResponse {
  data?: Array<{ status: 'ok' | 'error'; message?: string }>
  errors?: Array<{ message?: string }>
}

export type CompletionPushKind =
  | 'wardrobe-classification'
  | 'today-outfit-recommendation'
  | 'outfit-recommendation'
  | 'outfit-preview'

export type FailurePushKind = 'outfit-preview'

interface PushMessage {
  title: string
  body: string
  data: Record<string, string>
}

const completionMessages: Record<CompletionPushKind, PushMessage> = {
  'wardrobe-classification': {
    title: '옷 분석이 끝났어요',
    body: '앱에서 분석 결과를 확인해보세요.',
    data: { type: 'ai-completion', kind: 'wardrobe-classification' },
  },
  'today-outfit-recommendation': {
    title: '오늘의 코디 추천이 준비됐어요',
    body: '플래너에서 추천 코디를 확인해보세요.',
    data: { type: 'ai-completion', kind: 'today-outfit-recommendation' },
  },
  'outfit-recommendation': {
    title: '코디 추천이 준비됐어요',
    body: '선택한 옷에 어울리는 코디를 확인해보세요.',
    data: { type: 'ai-completion', kind: 'outfit-recommendation' },
  },
  'outfit-preview': {
    title: 'AI 코디 이미지가 완성됐어요',
    body: '앱에서 생성된 이미지를 확인해보세요.',
    data: { type: 'ai-completion', kind: 'outfit-preview' },
  },
}

const failureMessages: Record<FailurePushKind, PushMessage> = {
  'outfit-preview': {
    title: 'AI 코디 이미지를 만들지 못했어요',
    body: '앱에서 다시 시도해주세요.',
    data: { type: 'ai-failure', kind: 'outfit-preview' },
  },
}

async function sendToUser(userId: string, message: PushMessage, requireDevice: boolean) {
  const tokens = await pushDeviceRepository.findActiveTokensForUser(userId)
  if (tokens.length === 0) {
    if (!requireDevice) return false
    throw new ServiceError(
      '등록된 기기가 없습니다. 알림 권한을 허용한 뒤 앱을 다시 열어주세요.',
      'PUSH_DEVICE_NOT_REGISTERED',
    )
  }

  for (let index = 0; index < tokens.length; index += 100) {
    const batch = tokens.slice(index, index + 100)
    let response: Response
    try {
      response = await fetch(expoPushEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(batch.map((to) => ({
          to,
          ...message,
          sound: 'default',
        }))),
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      throw new ServiceError('Expo 푸시 서버에 연결하지 못했습니다.', 'PUSH_SEND_FAILED')
    }

    const result = (await response.json().catch(() => null)) as ExpoPushResponse | null
    if (
      !response.ok ||
      result?.errors?.length ||
      !Array.isArray(result?.data) ||
      result.data.length !== batch.length ||
      result.data.some((ticket) => ticket.status !== 'ok')
    ) {
      console.error('[push] Expo notification rejected', {
        status: response.status,
        errors: result?.errors,
        tickets: result?.data,
      })
      throw new ServiceError(
        '알림을 보내지 못했습니다. Expo 푸시 키 설정을 확인해주세요.',
        'PUSH_SEND_FAILED',
      )
    }
  }
  return true
}

export const pushService = {
  async register(userId: string, accessToken: string, token: string, platform: PushPlatform) {
    if (token.length > 256 || !expoTokenPattern.test(token)) {
      throw new ServiceError('Expo 푸시 토큰 형식이 올바르지 않습니다.', 'INVALID_PUSH_TOKEN')
    }
    if (platform !== 'ios' && platform !== 'android') {
      throw new ServiceError('지원하지 않는 기기입니다.', 'INVALID_PUSH_PLATFORM')
    }

    await pushDeviceRepository.register({
      userId,
      sessionTokenHash: hashSessionToken(accessToken),
      token,
      platform,
    })
    return true
  },

  async sendTest(userId: string) {
    return sendToUser(userId, {
      title: 'closet 알림 테스트',
      body: '푸시 알림이 정상적으로 도착했어요.',
      data: { type: 'push-test' },
    }, true)
  },

  async sendCompletion(
    userId: string,
    kind: CompletionPushKind,
    data: Record<string, string> = {},
  ) {
    const message = completionMessages[kind]
    return sendToUser(userId, {
      ...message,
      data: { ...message.data, ...data },
    }, false)
  },

  async sendFailure(
    userId: string,
    kind: FailurePushKind,
    data: Record<string, string> = {},
  ) {
    const message = failureMessages[kind]
    return sendToUser(userId, {
      ...message,
      data: { ...message.data, ...data },
    }, false)
  },
}

export function notifyCompletion(
  userId: string,
  kind: CompletionPushKind,
  data?: Record<string, string>,
) {
  void pushService.sendCompletion(userId, kind, data).catch((error: unknown) => {
    console.warn('[push] AI 작업 완료 알림 전송 실패:', kind, error)
  })
}

export function notifyFailure(
  userId: string,
  kind: FailurePushKind,
  data?: Record<string, string>,
) {
  void pushService.sendFailure(userId, kind, data).catch((error: unknown) => {
    console.warn('[push] AI 작업 실패 알림 전송 실패:', kind, error)
  })
}
