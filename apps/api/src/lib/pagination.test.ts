import assert from 'node:assert/strict'
import test from 'node:test'
import { makePage, readPageInput } from './pagination.js'

test('기본 20개, 최대 50개로 제한하고 잘못된 요청을 거부한다', () => {
  assert.equal(readPageInput().limit, 20)
  assert.equal(readPageInput({ limit: 50 }).limit, 50)
  for (const limit of [0, -1, 51, 1.5]) {
    assert.throws(() => readPageInput({ limit }), { code: 'INVALID_PAGE' })
  }
})

test('같은 생성일의 항목도 ID 경계로 이어서 조회하고 마지막 페이지에서 멈춘다', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    id: String(index + 1).padStart(24, '0'),
    createdAt: new Date('2026-08-27T01:00:00.000Z'),
  }))
  for (const sort of ['latest', 'oldest'] as const) {
    const ordered = sort === 'latest' ? [...rows].reverse() : rows
    const first = makePage(ordered.slice(0, 3), rows.length, readPageInput({ limit: 2, sort }))
    assert.equal(first.items.length, 2)
    assert.equal(first.totalCount, 5)
    assert.equal(first.hasNextPage, true)
    const next = readPageInput({ limit: 2, sort, cursor: first.nextCursor })
    const boundary = ordered[1]
    assert.deepEqual(next.after, {
      OR: [
        { createdAt: { [sort === 'latest' ? 'lt' : 'gt']: boundary.createdAt } },
        { createdAt: boundary.createdAt, id: { [sort === 'latest' ? 'lt' : 'gt']: boundary.id } },
      ],
    })
    const second = makePage(ordered.slice(2), rows.length, next)
    const last = makePage(ordered.slice(4), rows.length, readPageInput({ limit: 2, sort, cursor: second.nextCursor }))
    assert.equal(last.hasNextPage, false)
    assert.equal(last.nextCursor, null)
    assert.deepEqual([...first.items, ...second.items, ...last.items], ordered)
  }
})

test('손상된 커서와 다른 정렬의 커서는 거부하고 빈 페이지도 반환한다', () => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  for (const cursor of [
    'not-a-cursor',
    encode({ id: 'invalid', createdAt: '2026-08-27', sort: 'latest' }),
    encode({ id: '1'.repeat(24), createdAt: 'not-a-date', sort: 'latest' }),
    encode({ id: '1'.repeat(24), createdAt: '2026-08-27', sort: 'oldest' }),
  ]) {
    assert.throws(() => readPageInput({ cursor }), { code: 'INVALID_CURSOR' })
  }
  assert.deepEqual(makePage([], 0, readPageInput()), {
    items: [], totalCount: 0, hasNextPage: false, nextCursor: null,
  })
})
