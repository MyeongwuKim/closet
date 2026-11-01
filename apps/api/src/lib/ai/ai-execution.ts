import { createHash } from 'node:crypto'
import { ServiceError } from '../../graphql/errors.js'

export type AiKind = 'classification' | 'size-chart' | 'cutout' | 'recommendation' | 'today-recommendation' | 'preview'
/** 기본 제한은 사용자·기능별 횟수다. AI_PREVIEW_DAY_LIMIT 등 AI_<기능>_MINUTE_LIMIT·DAY_LIMIT으로 조정한다. */
const policies: Record<AiKind, { minute: number; day: number }> = {
  classification: { minute: 20, day: 200 },
  'size-chart': { minute: 10, day: 100 },
  cutout: { minute: 20, day: 200 },
  recommendation: { minute: 20, day: 200 },
  'today-recommendation': { minute: 20, day: 200 },
  preview: { minute: 4, day: 30 },
}

/** 기능별 기본 횟수에 양수 환경 변수 설정을 반영한다. 단위는 분당·UTC 날짜당 요청 횟수다. */
export function getAiLimits(kind: AiKind) {
  const prefix = `AI_${kind.replaceAll('-', '_').toUpperCase()}`
  const read = (suffix: string, fallback: number) => {
    const value = Number(process.env[`${prefix}_${suffix}_LIMIT`])
    return Number.isInteger(value) && value > 0 ? value : fallback
  }
  return { minute: read('MINUTE', policies[kind].minute), day: read('DAY', policies[kind].day) }
}

/** 입력 원문 대신 해시를 키로 사용한다. 사용자별 키 구분은 실행기에서 별도로 적용한다. */
export function aiInputKey(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

/**
 * 한 서버 프로세스에서 사용자별 동일 작업을 합치고 호출 횟수·동시 실행·결과 캐시를 제한한다.
 * 성공 결과만 ttlMs 동안 재사용하며 오류는 저장하지 않는다. 재시작하면 기록은 초기화된다.
 * 실제 API 시작 시에는 createSharedAiExecutor를 설치한다. 이 메모리 구현은 단위 테스트와 합성 평가용이다.
 */
export function createAiExecutor({
  now = Date.now,
  maxConcurrent = 6,
  maxPerUser = 2,
  maxEntries = 200,
  maxCacheBytes = 16 * 1024 * 1024,
} = {}) {
  // 사용자·기능·입력 해시별 작업 Promise. 동일 요청은 실행 자리를 추가로 차지하지 않는다.
  const pending = new Map<string, Promise<unknown>>()
  // 성공 결과와 만료 시각·직렬화 크기를 보관해 항목 수와 전체 메모리를 함께 제한한다.
  const cache = new Map<string, { value: unknown; expires: number; bytes: number }>()
  // 사용자·기능별 첫 호출을 기준으로 1분·24시간의 횟수를 집계한다.
  const usage = new Map<string, { minuteStart: number; minute: number; dayStart: number; day: number }>()
  const active = new Map<string, number>()
  let cacheBytes = 0

  function removeCached(key: string) {
    const entry = cache.get(key)
    if (entry) cacheBytes -= entry.bytes
    cache.delete(key)
  }

  /** 같은 사용자·기능·입력의 진행 중 처리를 공유하며 캐시 재사용에는 이용 횟수를 더하지 않는다. */
  async function run<T>(userId: string, kind: AiKind, input: unknown, operation: () => Promise<T>, ttlMs = 0): Promise<T> {
    const timestamp = now()
    for (const [key, entry] of cache) if (entry.expires <= timestamp) removeCached(key)
    for (const [key, entry] of usage) if (entry.dayStart + 86_400_000 <= timestamp) usage.delete(key)
    const key = aiInputKey([userId, kind, input])
    const cached = cache.get(key)
    if (cached) return structuredClone(cached.value) as T
    const existing = pending.get(key)
    if (existing) return structuredClone(await existing) as T

    if (pending.size >= maxConcurrent || (active.get(userId) ?? 0) >= maxPerUser) {
      throw new ServiceError('다른 AI 작업이 진행 중이에요. 완료 후 다시 시도해 주세요.', 'AI_BUSY')
    }
    const usageKey = aiInputKey([userId, kind])
    const counts = usage.get(usageKey) ?? { minuteStart: timestamp, minute: 0, dayStart: timestamp, day: 0 }
    if (counts.minuteStart + 60_000 <= timestamp) {
      counts.minuteStart = timestamp
      counts.minute = 0
    }
    const limits = getAiLimits(kind)
    if (counts.minute >= limits.minute || counts.day >= limits.day) {
      throw new ServiceError('AI 사용 횟수 제한에 도달했어요. 시간이 지난 뒤 다시 시도해 주세요.', 'AI_RATE_LIMITED')
    }
    if (usage.size >= 10_000 && !usage.has(usageKey)) {
      throw new ServiceError('AI 요청이 많아요. 잠시 후 다시 시도해 주세요.', 'AI_BUSY')
    }
    counts.minute += 1
    counts.day += 1
    usage.set(usageKey, counts)
    active.set(userId, (active.get(userId) ?? 0) + 1)
    const work = Promise.resolve().then(operation)
    pending.set(key, work)
    try {
      const result = await work
      if (ttlMs > 0) {
        const bytes = Buffer.byteLength(JSON.stringify(result) ?? '')
        if (bytes <= maxCacheBytes) {
          while (cache.size >= maxEntries || cacheBytes + bytes > maxCacheBytes) removeCached(cache.keys().next().value!)
          cache.set(key, { value: structuredClone(result), expires: now() + ttlMs, bytes })
          cacheBytes += bytes
        }
      }
      console.info('[ai-operation]', { kind, durationMs: now() - timestamp, status: 'completed' })
      return result
    } catch (error) {
      console.warn('[ai-operation]', { kind, durationMs: now() - timestamp, status: 'failed', code: error instanceof ServiceError ? error.code : 'AI_FAILED' })
      throw error
    } finally {
      pending.delete(key)
      const remaining = (active.get(userId) ?? 1) - 1
      if (remaining === 0) active.delete(userId)
      else active.set(userId, remaining)
    }
  }

  return { run }
}

export type AiExecutor = ReturnType<typeof createAiExecutor>
let installedExecutor: AiExecutor | null = null
const testExecutor = createAiExecutor()

/** API 시작 시 공유 실행기를 연결한다. 저장소 장애를 메모리 구현으로 우회하지 않는다. */
export function installAiExecutor(executor: AiExecutor) {
  installedExecutor = executor
}

/** 일반 실행에는 MongoDB 실행기가 필요하며 Node 단위 테스트만 메모리 구현을 사용한다. */
export const aiExecutor: AiExecutor = {
  run: (...args) => {
    const executor = installedExecutor ?? (process.env.NODE_TEST_CONTEXT ? testExecutor : null)
    if (!executor) throw new ServiceError('AI 작업 저장소가 초기화되지 않았습니다.', 'AI_STORAGE_UNAVAILABLE')
    return executor.run(...args)
  },
}
