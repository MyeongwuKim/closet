import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type { AiExecution, Prisma } from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { prisma } from '../prisma.js'
import { aiInputKey, getAiLimits, type AiExecutor, type AiKind } from './ai-execution.js'
import { aiTransaction, touchAiMutex } from './ai-storage.js'

const LEASE_MS = 90_000
const MAX_RESULT_BYTES = 12 * 1024 * 1024

/** 만료된 슬롯 하나를 원자적으로 점유한다. 트랜잭션을 함께 쓰므로 사용자 슬롯 실패 시 전체 슬롯도 되돌린다. */
async function claimSlot(tx: Prisma.TransactionClient, prefix: string, count: number, token: string, now: Date) {
  for (let index = 0; index < count; index += 1) {
    const id = `${prefix}:${index}`
    const slot = await tx.aiLease.findUnique({ where: { id } })
    if (slot && slot.leaseUntil > now) continue
    await tx.aiLease.upsert({ where: { id },
      create: { id, token, leaseUntil: new Date(now.getTime() + LEASE_MS) },
      update: { token, leaseUntil: new Date(now.getTime() + LEASE_MS) },
    })
    return
  }
  throw new ServiceError('다른 AI 작업이 진행 중이에요. 완료 후 다시 시도해 주세요.', 'AI_BUSY')
}

/** UTC 분·날짜별 공유 한도를 갱신한다. 중복 작업을 기다리거나 캐시를 읽는 호출은 이 함수를 실행하지 않는다. */
async function consumeQuota(tx: Prisma.TransactionClient, userId: string, kind: AiKind, now: Date) {
  const id = aiInputKey([userId, kind])
  const minuteStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000)
  const dayStart = new Date(Math.floor(now.getTime() / 86_400_000) * 86_400_000)
  const previous = await tx.aiQuota.findUnique({ where: { id } })
  const minuteCount = previous?.minuteStart.getTime() === minuteStart.getTime() ? previous.minuteCount : 0
  const dayCount = previous?.dayStart.getTime() === dayStart.getTime() ? previous.dayCount : 0
  const limits = getAiLimits(kind)
  if (minuteCount >= limits.minute || dayCount >= limits.day) {
    throw new ServiceError('AI 사용 횟수 제한에 도달했어요. 시간이 지난 뒤 다시 시도해 주세요.', 'AI_RATE_LIMITED')
  }
  const data = { minuteStart, minuteCount: minuteCount + 1, dayStart, dayCount: dayCount + 1, expiresAt: new Date(dayStart.getTime() + 2 * 86_400_000) }
  await tx.aiQuota.upsert({ where: { id }, create: { id, ...data }, update: data })
}

/** DB에 저장된 성공 결과를 복원하거나 실패·중단 사유를 같은 요청의 대기자에게 전달한다. */
function readResult<T>(record: AiExecution): T {
  if (record.status === 'completed' && record.resultText !== null) return JSON.parse(record.resultText) as T
  throw new ServiceError(record.errorMessage ?? 'AI 작업이 중단됐어요. 다시 시도해 주세요.', record.errorCode ?? 'AI_INTERRUPTED')
}

/**
 * 서버 여러 대가 MongoDB의 작업 키·슬롯·사용량·결과 캐시를 공유한다.
 * 처리 중에는 임대를 갱신하고 결과 저장 시 토큰을 확인한다. 임대가 끊긴 작업은 자동 재전송하지 않는다.
 * 일반 분석의 원본 이미지는 저장하지 않으며, 임시 결과 문서는 TTL로 제거한다.
 */
export function createSharedAiExecutor({ pollMs = 250, waitMs = 180_000, now = Date.now } = {}): AiExecutor {
  return {
    async run<T>(userId: string, kind: AiKind, input: unknown, operation: () => Promise<T>, ttlMs = 0): Promise<T> {
      const id = aiInputKey([userId, kind, input])
      const token = randomUUID()
      const startedAt = now()
      const decision = await aiTransaction(async (tx) => {
        // 키를 먼저 쓰므로 동시에 도착한 서버가 사용량을 각각 차감하지 않는다.
        await touchAiMutex(tx, `execution:${id}`, token, new Date(now()))
        const existing = await tx.aiExecution.findUnique({ where: { id } })
        const timestamp = new Date(now())
        if (existing && (existing.cacheUntil > timestamp || existing.status === 'processing')) return existing
        await claimSlot(tx, 'global', 6, token, timestamp)
        await claimSlot(tx, `user:${aiInputKey(userId)}`, 2, token, timestamp)
        await consumeQuota(tx, userId, kind, timestamp)
        const data = { userId, kind, status: 'processing' as const, leaseToken: token,
          leaseUntil: new Date(now() + LEASE_MS), cacheUntil: timestamp,
          expiresAt: new Date(now() + 86_400_000), resultText: null, errorCode: null, errorMessage: null }
        await tx.aiExecution.upsert({ where: { id }, create: { id, ...data }, update: data })
        return null
      })

      if (decision) {
        let record = decision
        while (record.status === 'processing') {
          if (record.leaseUntil.getTime() <= now()) {
            await prisma.aiExecution.updateMany({ where: { id, leaseToken: record.leaseToken, status: 'processing', leaseUntil: { lte: new Date(now()) } },
              data: { status: 'interrupted', errorCode: 'AI_INTERRUPTED', errorMessage: '이전 AI 요청의 완료 여부를 확인하지 못했어요. 자동으로 다시 생성하지 않았습니다.', cacheUntil: new Date(now() + 15_000) } })
          } else if (now() - startedAt >= waitMs) {
            throw new ServiceError('AI 작업이 계속 진행 중이에요. 잠시 후 결과를 확인해 주세요.', 'AI_BUSY')
          } else {
            await delay(pollMs)
          }
          const updated = await prisma.aiExecution.findUnique({ where: { id } })
          if (!updated || updated.leaseToken !== decision.leaseToken) throw new ServiceError('AI 작업 상태가 바뀌었어요. 결과를 다시 확인해 주세요.', 'AI_INTERRUPTED')
          record = updated
        }
        return readResult<T>(record)
      }

      let renewing = false
      const heartbeat = setInterval(() => {
        if (renewing) return
        renewing = true
        void aiTransaction(async (tx) => {
          const current = await tx.aiExecution.findUnique({ where: { id } })
          if (current?.status !== 'processing' || current.leaseToken !== token) return
          const leaseUntil = new Date(now() + LEASE_MS)
          await tx.aiLease.updateMany({ where: { token }, data: { leaseUntil } })
          await tx.aiExecution.updateMany({ where: { id, leaseToken: token, status: 'processing' }, data: { leaseUntil } })
        }).catch(() => console.warn('[ai-lease] renewal failed')).finally(() => { renewing = false })
      }, 15_000)
      heartbeat.unref()
      try {
        const result = await operation()
        const resultText = JSON.stringify(result)
        if (Buffer.byteLength(resultText) > MAX_RESULT_BYTES) throw new ServiceError('AI 결과가 저장 가능한 크기를 초과했어요.', 'AI_RESULT_TOO_LARGE')
        const saved = await prisma.aiExecution.updateMany({ where: { id, leaseToken: token, status: 'processing' }, data: {
          status: 'completed', resultText, cacheUntil: new Date(now() + Math.max(ttlMs, 2000)),
          expiresAt: new Date(now() + Math.max(ttlMs, 60_000)),
        } })
        if (saved.count !== 1) throw new ServiceError('AI 작업이 중단되어 결과를 저장하지 못했어요.', 'AI_INTERRUPTED')
        return result
      } catch (error) {
        await prisma.aiExecution.updateMany({ where: { id, leaseToken: token, status: 'processing' }, data: {
          status: 'failed', errorCode: error instanceof ServiceError ? error.code : 'AI_FAILED',
          errorMessage: error instanceof ServiceError ? error.message : 'AI 작업을 완료하지 못했어요. 다시 시도해 주세요.',
          cacheUntil: new Date(now() + 15_000), expiresAt: new Date(now() + 60_000),
        } }).catch(() => undefined)
        throw error
      } finally {
        clearInterval(heartbeat)
        await prisma.aiLease.updateMany({ where: { token }, data: { leaseUntil: new Date(now()) } }).catch(() => undefined)
      }
    },
  }
}
