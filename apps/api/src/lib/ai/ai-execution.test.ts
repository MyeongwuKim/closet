import assert from 'node:assert/strict'
import test from 'node:test'
import { createAiExecutor } from './ai-execution.js'

test('같은 사용자·입력의 동시 요청은 한 번 실행하고 결과는 복사해 전달한다', async () => {
  const executor = createAiExecutor()
  let release!: (value: { name: string }) => void
  let calls = 0
  const work = () => { calls += 1; return new Promise<{ name: string }>((resolve) => { release = resolve }) }
  const first = executor.run('a', 'preview', ['top', 'bottom'], work)
  const second = executor.run('a', 'preview', ['top', 'bottom'], work)
  await Promise.resolve()
  release({ name: '완료' })
  const [one, two] = await Promise.all([first, second])
  assert.equal(calls, 1)
  assert.deepEqual(one, two)
  one.name = '변경'
  assert.equal(two.name, '완료')
})

test('캐시를 사용자와 입력별로 분리하고 만료·수정 입력에는 다시 실행한다', async () => {
  let time = 100
  const executor = createAiExecutor({ now: () => time })
  let calls = 0
  const work = async () => ({ number: ++calls })
  assert.equal((await executor.run('a', 'recommendation', { revision: 1 }, work, 10)).number, 1)
  assert.equal((await executor.run('a', 'recommendation', { revision: 1 }, work, 10)).number, 1)
  assert.equal((await executor.run('b', 'recommendation', { revision: 1 }, work, 10)).number, 2)
  assert.equal((await executor.run('a', 'recommendation', { revision: 2 }, work, 10)).number, 3)
  time = 111
  assert.equal((await executor.run('a', 'recommendation', { revision: 1 }, work, 10)).number, 4)
})

test('실패한 작업의 실행 자리를 해제하고 오류 결과를 캐시하지 않는다', async () => {
  const executor = createAiExecutor({ maxConcurrent: 1 })
  await assert.rejects(executor.run('a', 'preview', 1, async () => { throw new Error('실패') }, 100))
  assert.equal(await executor.run('a', 'preview', 1, async () => '다시 완료'), '다시 완료')
})

test('전체 동시 실행 제한은 서로 다른 사용자에게도 적용한다', async () => {
  const executor = createAiExecutor({ maxConcurrent: 1 })
  let release!: () => void
  const pending = executor.run('a', 'preview', 1, () => new Promise<void>((resolve) => { release = resolve }))
  await Promise.resolve()
  await assert.rejects(executor.run('b', 'preview', 2, async () => '새 작업'), { code: 'AI_BUSY' })
  release()
  await pending
  assert.equal(await executor.run('b', 'preview', 2, async () => '새 작업'), '새 작업')
})

test('분당·일일 사용량 제한은 캐시 조회를 제외하고 시간창이 지난 뒤 초기화한다', async () => {
  let time = 0
  const executor = createAiExecutor({ now: () => time })
  for (let index = 0; index < 4; index += 1) await executor.run('a', 'preview', index, async () => index, 100)
  assert.equal(await executor.run('a', 'preview', 0, async () => 99, 100), 0)
  await assert.rejects(executor.run('a', 'preview', 4, async () => 4), { code: 'AI_RATE_LIMITED' })
  for (let index = 4; index < 30; index += 1) {
    time += 60_001
    await executor.run('a', 'preview', index, async () => index)
  }
  time += 60_001
  await assert.rejects(executor.run('a', 'preview', 30, async () => 30), { code: 'AI_RATE_LIMITED' })
  time = 86_400_001
  assert.equal(await executor.run('a', 'preview', 30, async () => 30), 30)
})

test('캐시 저장량이 넘으면 오래된 결과를 제거하고 큰 결과는 저장하지 않는다', async () => {
  const executor = createAiExecutor({ maxEntries: 1, maxCacheBytes: 20 })
  let calls = 0
  const work = async () => ++calls
  await executor.run('a', 'recommendation', 1, work, 100)
  await executor.run('a', 'recommendation', 2, work, 100)
  assert.equal(await executor.run('a', 'recommendation', 1, work, 100), 3)
  let largeCalls = 0
  const largeWork = async () => { largeCalls += 1; return 'x'.repeat(30) }
  await executor.run('a', 'recommendation', 3, largeWork, 100)
  await executor.run('a', 'recommendation', 3, largeWork, 100)
  assert.equal(largeCalls, 2)
})
