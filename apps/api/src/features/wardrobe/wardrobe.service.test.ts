import assert from 'node:assert/strict'
import test from 'node:test'
import { getWardrobeWearStats } from './wardrobe.service.js'

test('플래너 기록에서 아이템별 최근 착용일과 착용 횟수를 계산한다', () => {
  const stats = getWardrobeWearStats([
    {
      date: new Date('2026-08-23T00:00:00.000Z'),
      outfit: {
        items: [
          { wardrobeItemId: 'top-1' },
          { wardrobeItemId: 'bottom-1' },
        ],
      },
    },
    {
      date: new Date('2026-08-25T00:00:00.000Z'),
      outfit: { items: [{ wardrobeItemId: 'top-1' }] },
    },
  ])

  assert.equal(stats.get('top-1')?.wearCount, 2)
  assert.equal(
    stats.get('top-1')?.lastWornAt?.toISOString(),
    '2026-08-25T00:00:00.000Z',
  )
  assert.equal(stats.get('bottom-1')?.wearCount, 1)
})

test('같은 아이템의 같은 날짜 기록은 한 번만 센다', () => {
  const date = new Date('2026-08-25T00:00:00.000Z')
  const stats = getWardrobeWearStats([
    {
      date,
      outfit: { items: [{ wardrobeItemId: 'top-1' }] },
    },
    {
      date,
      outfit: { items: [{ wardrobeItemId: 'top-1' }] },
    },
  ])

  assert.equal(stats.get('top-1')?.wearCount, 1)
})
