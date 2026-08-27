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
    { id: 'daily', name: '데일리 코디' },
    { id: 'weekend', name: '주말 코디' },
    { id: 'unworn', name: '아직 안 입은 코디' },
    { id: 'future', name: '내일 입을 코디' },
  ]
  const daily = outfit('daily', 'casual', ['top', 'pants'])
  const result = summarizeWardrobe(inventory, [
    { date: new Date('2026-08-26'), outfit: daily },
    { date: throughDate, outfit: daily },
    { date: throughDate, outfit: daily },
    { date: throughDate, outfit: outfit('weekend', 'minimal', ['shirt', 'pants']) },
    { date: throughDate, outfit: outfit('planner-only', 'casual', ['top']) },
    { date: throughDate, outfit: outfit('deleted', 'casual', ['top']) },
    { date: new Date('2026-08-28'), outfit: outfit('future', 'sporty', ['unknown']) },
    { date: throughDate, outfit: null },
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
  ]
  const records = saved.map(({ id }) => ({ date: throughDate, outfit: outfit(id, 'casual', ['top']) }))
  records.push({ date: new Date('2026-08-26'), outfit: outfit('f', 'casual', ['top']) })
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
    { date: new Date('2026-08-26'), outfit: casual },
    { date: throughDate, outfit: casual },
    { date: throughDate, outfit: casual },
    { date: throughDate, outfit: outfit('second-outfit', 'minimal', ['top', 'shirt', 'archived']) },
    { date: new Date('2026-08-28'), outfit: outfit('future', 'sporty', ['unknown']) },
    { date: throughDate, outfit: null },
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
  const result = summarizeWardrobe(items, [{ date: throughDate, outfit: outfit('one', 'custom', items.map((item) => item.id)) }], throughDate)
  assert.equal(result.mostWorn.length, 5)
  assert.equal(result.wornStyles[0].label, 'custom')
  const empty = summarizeWardrobe([], [], throughDate)
  assert.equal(empty.totalItems, 0)
  assert.equal(empty.wearRecordCount, 0)
  assert.equal(empty.unwornCount, 0)
  assert.deepEqual(empty.categories, [])
  assert.deepEqual(empty.colors, [])
})
