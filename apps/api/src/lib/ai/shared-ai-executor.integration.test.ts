import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { prisma } from '../prisma.js'
import { aiInputKey } from './ai-execution.js'
import { ensureAiStorage } from './ai-storage.js'
import { createSharedAiExecutor } from './shared-ai-executor.js'

// 별도 테스트 DB를 지정한 전용 실행에서만 사용한다. 일반 단위 테스트는 계정 DB에 연결하지 않는다.
test('MongoDB 공유 실행기 통합 검증', { skip: !process.env.AI_INTEGRATION_DATABASE }, async (t) => {
  await ensureAiStorage()
  const indexes = await prisma.$runCommandRaw({ listIndexes: 'AiExecution' })
  const entries = (indexes.cursor as { firstBatch: Array<{ key: Record<string, number>; expireAfterSeconds?: unknown }> }).firstBatch
  const index = entries.find((entry) => entry.key.expiresAt === 1)
  assert.ok(index && index.expireAfterSeconds !== undefined, '일반 인덱스를 TTL로 전환해야 함')
  t.after(() => prisma.$disconnect())
  const user = () => randomBytes(12).toString('hex')

  await t.test('서로 다른 실행기와 재시작한 프로세스가 성공 캐시를 공유한다', async () => {
    const userId = user()
    let calls = 0
    const one = createSharedAiExecutor({ pollMs: 5 })
    const two = createSharedAiExecutor({ pollMs: 5 })
    const work = async () => { calls += 1; await delay(50); return { answer: 'cached' } }
    const results = await Promise.all([one.run(userId, 'recommendation', 'same', work, 60_000), two.run(userId, 'recommendation', 'same', work, 60_000)])
    assert.deepEqual(results, [{ answer: 'cached' }, { answer: 'cached' }])
    assert.equal(calls, 1)
    const script = `const {createSharedAiExecutor}=await import('./apps/api/src/lib/ai/shared-ai-executor.ts');const {prisma}=await import('./apps/api/src/lib/prisma.ts');try{const r=await createSharedAiExecutor().run('${userId}','recommendation','same',async()=>{throw Error('duplicate')},60000);console.log(r.answer)}finally{await prisma.$disconnect()}`
    const child = spawnSync(process.execPath, ['--import', './apps/api/node_modules/tsx/dist/loader.mjs', '--input-type=module', '-e', script], { encoding: 'utf8', timeout: 15_000 })
    assert.equal(child.status, 0, child.stderr)
    assert.equal(child.stdout.trim(), 'cached')
    const quota = await prisma.aiQuota.findUniqueOrThrow({ where: { id: aiInputKey([userId, 'recommendation']) } })
    assert.equal(quota.minuteCount, 1)
  })

  await t.test('실행기를 다시 만들어도 사용량 제한이 유지된다', async () => {
    const previous = process.env.AI_PREVIEW_MINUTE_LIMIT
    process.env.AI_PREVIEW_MINUTE_LIMIT = '2'
    try {
      const userId = user()
      await createSharedAiExecutor().run(userId, 'preview', 1, async () => 1)
      await createSharedAiExecutor().run(userId, 'preview', 2, async () => 2)
      await assert.rejects(createSharedAiExecutor().run(userId, 'preview', 3, async () => 3), { code: 'AI_RATE_LIMITED' })
    } finally {
      if (previous === undefined) delete process.env.AI_PREVIEW_MINUTE_LIMIT
      else process.env.AI_PREVIEW_MINUTE_LIMIT = previous
    }
  })

  await t.test('서버별 실행기를 사용해도 사용자 동시 실행 수는 두 개다', async () => {
    const userId = user()
    let entered = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const work = async () => { entered += 1; await gate; return 'done' }
    const one = createSharedAiExecutor().run(userId, 'classification', 1, work)
    const two = createSharedAiExecutor().run(userId, 'classification', 2, work)
    try {
      for (let attempt = 0; entered < 2 && attempt < 200; attempt += 1) await delay(20)
      assert.equal(entered, 2)
      await assert.rejects(createSharedAiExecutor().run(userId, 'classification', 3, work), { code: 'AI_BUSY' })
    } finally { release(); await Promise.allSettled([one, two]) }
  })

  await t.test('만료된 처리 임대는 자동 API 재전송 없이 중단 상태로 남는다', async () => {
    const userId = user()
    const now = Date.now()
    const id = aiInputKey([userId, 'recommendation', 'interrupted'])
    await prisma.aiExecution.create({ data: { id, userId, kind: 'recommendation', status: 'processing', leaseToken: 'old-server', leaseUntil: new Date(now - 1000), cacheUntil: new Date(now - 1000), expiresAt: new Date(now + 60_000) } })
    let calls = 0
    await assert.rejects(createSharedAiExecutor().run(userId, 'recommendation', 'interrupted', async () => { calls += 1; return 'new' }), { code: 'AI_INTERRUPTED' })
    assert.equal(calls, 0)
    assert.equal((await prisma.aiExecution.findUniqueOrThrow({ where: { id } })).status, 'interrupted')
  })
})
