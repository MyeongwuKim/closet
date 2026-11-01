import { setTimeout as delay } from 'node:timers/promises'
import { ServiceError } from '../../graphql/errors.js'

/** Retry-After의 초 또는 HTTP 날짜를 밀리초로 바꾼다. 잘못된 값은 null이다. */
export function getRetryDelay(value: string | null, now = Date.now()) {
  if (!value?.trim()) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : null
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - now) : null
}

/**
 * API 요청과 응답 본문 읽기에 하나의 기한을 적용한다. 일시적 429·5xx만 최대 한 번 재시도한다.
 * 결제·할당량 오류, 성공했지만 잘못된 본문, 전송 결과를 모르는 네트워크 오류는 다시 과금하지 않도록 재전송하지 않는다.
 * 이미지·프롬프트는 기록하지 않고 요청 ID·토큰 사용량·상태만 기록한다.
 */
export async function requestAiJson<T = unknown>(
  url: string,
  options: RequestInit,
  { timeoutMs, attempts = 2 }: { timeoutMs: number; attempts?: number },
): Promise<T> {
  const startedAt = Date.now()
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs)
  try {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const response = await fetch(url, { ...options, signal })
      const payload = await response.json().catch(() => null) as {
        error?: { code?: string }; usage?: unknown; status?: string
      } | null
      signal.throwIfAborted()
      console.info('[ai-request]', {
        status: response.status, attempt, requestId: response.headers.get('x-request-id'),
        durationMs: Date.now() - startedAt, usage: payload?.usage,
      })
      if (response.ok) {
        if (!payload || (payload.status !== undefined && payload.status !== 'completed')) throw new ServiceError('AI 응답을 확인하지 못했어요. 다시 시도해 주세요.', 'AI_INVALID_RESPONSE')
        return payload as T
      }
      const quotaError = ['insufficient_quota', 'billing_hard_limit_reached', 'usage_limit_reached'].includes(payload?.error?.code ?? '')
      const retryable = !quotaError && (response.status === 429 || response.status >= 500)
      const retryMs = (getRetryDelay(response.headers.get('retry-after')) ?? 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 200)
      if (retryable && attempt < attempts && retryMs + Date.now() - startedAt < timeoutMs) {
        await delay(retryMs, undefined, { signal })
        continue
      }
      throw new ServiceError(
        response.status === 429 ? 'AI 요청이 많거나 사용 한도에 도달했어요. 잠시 후 다시 시도해 주세요.' : 'AI 요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
        // 앱의 사용자별 제한과 구분해, 사진 분류에서는 로컬 컷아웃을 통한 수동 등록을 허용한다.
        response.status === 429 ? 'AI_PROVIDER_RATE_LIMITED' : 'AI_UPSTREAM_ERROR',
      )
    }
  } catch (error) {
    if (signal.aborted) throw new ServiceError('AI 처리 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.', 'AI_TIMEOUT')
    throw error
  }
  throw new ServiceError('AI 요청을 완료하지 못했어요.', 'AI_UPSTREAM_ERROR')
}
