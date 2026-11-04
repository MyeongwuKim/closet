import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeWardrobe } from './statistics.service.js'

const throughDate = new Date('2026-08-27T00:00:00.000Z')
const inventory = [
  { id: 'top', name: '흰 티셔츠', category: 'top' as const, colorName: '화이트', colorHex: '#ffffff' },
  { id: 'shirt', name: '셔츠', category: 'top' as const, colorName: '블랙', colorHex: '#000000' },
  { id: 'pants', name: '바지', category: 'bottom' as const, colorName: '블랙', colorHex: '#000000' },
  { id: 'unknown', name: '미분류 옷', category: null, colorName: null, colorHex: null },
]
const outfit = (id: string, style: string, ids: string[]) => ({
  id, style, items: ids.map((wardrobeItemId) => ({ wardrobeItemId })),
})

test('과거 일정도 실제 착용 확인이 없으면 횟수·순위·스타일에 포함하지 않는다', () => {
  const assigned = outfit('planned', 'casual', ['top'])
  const confirmed = outfit('worn', 'minimal', ['shirt'])
  const result = summarizeWardrobe(inventory, [
    { date: new Date('2026-08-20'), outfit: assigned },
    { date: new Date('2026-08-21'), wornAt: null, outfit: assigned },
    { date: throughDate, wornAt: throughDate, outfit: confirmed },
  ], throughDate, [{ id: assigned.id, name: '예정 코디', items: assigned.items }, { id: confirmed.id, name: '입은 코디', items: confirmed.items }])
  assert.equal(result.wearRecordCount, 1)
  assert.equal(result.unwornCount, inventory.length - 1)
  assert.equal(result.unwornOutfitCount, 1)
  assert.deepEqual(result.mostWorn.map((item) => item.id), ['shirt'])
  assert.deepEqual(result.wornStyles.map((style) => style.key), ['minimal'])
})

test('전체 옷장의 대표 카테고리와 색상을 집계하고 미지정 항목도 포함한다', () => {
  const result = summarizeWardrobe(inventory, [], throughDate)
  assert.equal(result.totalItems, 4)
  assert.equal(result.categories[0].key, 'top')
  assert.equal(result.categories[0].count, 2)
  assert.equal(result.categories.reduce((total, row) => total + row.count, 0), 4)
  assert.equal(result.colors[0].label, '블랙')
  assert.equal(result.colors[0].count, 2)
  assert.ok(result.categories.some((row) => row.label === '미분류' && row.count === 1))
  assert.ok(result.colors.some((row) => row.label === '미지정' && row.count === 1))
  assert.equal(result.unwornCount, 4)
  assert.deepEqual(result.mostWorn, [])
  assert.deepEqual(result.mostWornOutfits, [])
  assert.equal(result.unwornOutfitCount, 0)
  assert.deepEqual(result.wornStyles, [])
})

test('코디북에 저장한 코디의 날짜별 착용만 순위에 넣고 미래·중복·미착용 코디는 제외한다', () => {
  const saved = [
    { id: 'daily', name: '데일리 코디', items: outfit('', '', ['top', 'pants']).items },
    { id: 'weekend', name: '주말 코디', items: outfit('', '', ['shirt', 'pants']).items },
    { id: 'unworn', name: '아직 안 입은 코디', items: outfit('', '', ['unknown']).items },
    { id: 'future', name: '내일 입을 코디', items: outfit('', '', ['unknown', 'top']).items },
  ]
  const daily = outfit('daily', 'casual', ['top', 'pants'])
  const result = summarizeWardrobe(inventory, [
    { wornAt: throughDate, date: new Date('2026-08-26'), outfit: daily },
    { wornAt: throughDate, date: throughDate, outfit: daily },
    { wornAt: throughDate, date: throughDate, outfit: daily },
    { wornAt: throughDate, date: throughDate, outfit: outfit('weekend', 'minimal', ['shirt', 'pants']) },
    { wornAt: throughDate, date: throughDate, outfit: outfit('planner-only', 'casual', ['top']) },
    { wornAt: throughDate, date: throughDate, outfit: outfit('deleted', 'casual', ['top']) },
    { wornAt: throughDate, date: new Date('2026-08-28'), outfit: outfit('future', 'sporty', ['unknown']) },
    { wornAt: throughDate, date: throughDate, outfit: null },
  ], throughDate, saved)
  assert.deepEqual(result.mostWornOutfits, [
    { id: 'daily', name: '데일리 코디', wearCount: 2 },
    { id: 'weekend', name: '주말 코디', wearCount: 1 },
  ])
  assert.equal(result.unwornOutfitCount, 2)
  assert.equal(result.wearRecordCount, 5)
  assert.equal(result.mostWorn.find((item) => item.id === 'pants')?.wearCount, 2)
})

test('코디 순위는 횟수·이름·ID 순으로 상위 5개를 반환하고 이름이 같아도 합치지 않는다', () => {
  const saved = [
    { id: 'c', name: '가벼운 코디' },
    { id: 'b', name: '가벼운 코디' },
    { id: 'a', name: '가벼운 코디' },
    { id: 'd', name: '나들이 코디' },
    { id: 'e', name: '데일리 코디' },
    { id: 'f', name: '주말 코디' },
  ].map((entry) => ({ ...entry, items: outfit('', '', ['top', entry.id]).items }))
  const records = saved.map(({ id, items }) => ({ wornAt: throughDate, date: throughDate, outfit: { id, style: 'casual', items } }))
  records.push({ wornAt: throughDate, date: new Date('2026-08-26'), outfit: outfit('f', 'casual', ['top', 'f']) })
  const result = summarizeWardrobe(inventory, records, throughDate, saved)
  assert.deepEqual(result.mostWornOutfits.map(({ id, wearCount }) => ({ id, wearCount })), [
    { id: 'f', wearCount: 2 }, { id: 'a', wearCount: 1 }, { id: 'b', wearCount: 1 },
    { id: 'c', wearCount: 1 }, { id: 'd', wearCount: 1 },
  ])
  assert.equal(result.unwornOutfitCount, 0)
  const empty = summarizeWardrobe(inventory, [], throughDate, saved)
  assert.deepEqual(empty.mostWornOutfits, [])
  assert.equal(empty.unwornOutfitCount, saved.length)
})

test('미래 일정은 제외하고 옷은 날짜별, 스타일은 코디·날짜별 착용으로 계산한다', () => {
  const casual = outfit('casual-outfit', 'casual', ['top', 'pants'])
  const result = summarizeWardrobe(inventory, [
    { wornAt: throughDate, date: new Date('2026-08-26'), outfit: casual },
    { wornAt: throughDate, date: throughDate, outfit: casual },
    { wornAt: throughDate, date: throughDate, outfit: casual },
    { wornAt: throughDate, date: throughDate, outfit: outfit('second-outfit', 'minimal', ['top', 'shirt', 'archived']) },
    { wornAt: throughDate, date: new Date('2026-08-28'), outfit: outfit('future', 'sporty', ['unknown']) },
    { wornAt: throughDate, date: throughDate, outfit: null },
  ], throughDate)
  assert.equal(result.wearRecordCount, 3)
  assert.equal(result.unwornCount, 1)
  assert.equal(result.mostWorn.find((item) => item.id === 'top')?.wearCount, 2)
  assert.equal(result.mostWorn.find((item) => item.id === 'shirt')?.wearCount, 1)
  assert.equal(result.mostWorn.some((item) => item.id === 'archived'), false)
  assert.deepEqual(result.wornStyles.map(({ key, count }) => ({ key, count })), [
    { key: 'casual', count: 2 }, { key: 'minimal', count: 1 },
  ])
})

test('상위 5개만 반환하며 착용 기록이 없어도 빈 통계를 반환한다', () => {
  const items = Array.from({ length: 8 }, (_, index) => ({ ...inventory[0], id: `item-${index}`, name: `옷 ${index}` }))
  const result = summarizeWardrobe(items, [{ wornAt: throughDate, date: throughDate, outfit: outfit('one', 'custom', items.map((item) => item.id)) }], throughDate)
  assert.equal(result.mostWorn.length, 5)
  assert.equal(result.wornStyles[0].label, 'custom')
  const empty = summarizeWardrobe([], [], throughDate)
  assert.equal(empty.totalItems, 0)
  assert.equal(empty.wearRecordCount, 0)
  assert.equal(empty.unwornCount, 0)
  assert.deepEqual(empty.categories, [])
  assert.deepEqual(empty.colors, [])
})

test('코디북 ABC를 ABD로 수정해도 날짜에 보관한 ABC 착용을 ABD의 횟수로 표시하지 않는다', () => {
  const snapshot = outfit('date-copy', 'casual', ['top', 'pants', 'shirt'])
  const records = [{ wornAt: throughDate, date: throughDate, outfit: snapshot }]
  const before = [{ id: 'book', name: '수정 전 ABC', items: snapshot.items }]
  const renamed = [{ id: 'book', name: '이름·사진 수정 후 ABC', items: [...snapshot.items].reverse() }]
  const changed = [{ id: 'book', name: '수정 후 ABD', items: outfit('', '', ['top', 'pants', 'unknown']).items }]

  assert.equal(summarizeWardrobe(inventory, records, throughDate, before).mostWornOutfits[0]?.wearCount, 1)
  assert.equal(summarizeWardrobe(inventory, records, throughDate, renamed).mostWornOutfits[0]?.wearCount, 1)
  const result = summarizeWardrobe(inventory, records, throughDate, changed)
  assert.equal(result.unwornOutfitCount, 1)
  assert.deepEqual(result.mostWornOutfits, [])
  assert.equal(result.wearRecordCount, 1)
  assert.equal(result.mostWorn.find((item) => item.id === 'shirt')?.wearCount, 1)
  assert.equal(result.mostWorn.some((item) => item.id === 'unknown'), false)
  assert.deepEqual(result.wornStyles.map(({ key, count }) => ({ key, count })), [{ key: 'casual', count: 1 }])
})

test('원본 코디북을 삭제해도 날짜 복사본의 전체 착용과 옷별 이력은 남는다', () => {
  const result = summarizeWardrobe(inventory, [{
    date: throughDate, wornAt: throughDate,
    outfit: outfit('preserved-date-copy', 'minimal', ['shirt', 'pants']),
  }], throughDate, [])
  assert.equal(result.wearRecordCount, 1)
  assert.deepEqual(result.mostWorn.map((item) => item.id).sort(), ['pants', 'shirt'])
  assert.deepEqual(result.mostWornOutfits, [])
  assert.equal(result.unwornOutfitCount, 0)
})

test('같은 조합은 복사본 ID·옷 순서와 무관하게 날짜당 한 번 집계하며 빈 구성은 연결하지 않는다', () => {
  const result = summarizeWardrobe(inventory, [
    { date: throughDate, wornAt: throughDate, outfit: outfit('copy-a', 'casual', ['top', 'pants']) },
    { date: throughDate, wornAt: throughDate, outfit: outfit('copy-b', 'casual', ['pants', 'top']) },
    { date: new Date('2026-08-26'), wornAt: throughDate, outfit: outfit('copy-c', 'casual', ['top', 'pants']) },
    { date: throughDate, wornAt: throughDate, outfit: outfit('empty-copy', 'casual', []) },
  ], throughDate, [
    { id: 'saved', name: '복사본과 같은 조합', items: outfit('', '', ['pants', 'top']).items },
    { id: 'empty', name: '빈 코디', items: [] },
  ])
  assert.deepEqual(result.mostWornOutfits, [{ id: 'saved', name: '복사본과 같은 조합', wearCount: 2 }])
  assert.equal(result.unwornOutfitCount, 1)
})
