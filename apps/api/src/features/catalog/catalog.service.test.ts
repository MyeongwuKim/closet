import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma } from '@prisma/client'
import { activeWardrobeWhere, wardrobePageWhere } from './catalog.service.js'

test('브랜드는 전체 이름으로 비교하고 유니코드·연속 공백을 정리한다', () => {
  for (const [brandName, expected] of [
    ['  ＣＯＳ  ', 'COS'],
    ['  Steady\t  Everywear ', 'Steady Everywear'],
    ['A.P.C.', 'A.P.C.'],
  ]) {
    const where = wardrobePageWhere('viewer', { brandName })
    assert.deepEqual(where, {
      userId: 'viewer',
      AND: [activeWardrobeWhere, { brandName: { equals: expected, mode: 'insensitive' } }],
    })
  }
  assert.deepEqual(
    wardrobePageWhere('viewer', { brandName: ' \t ' }),
    wardrobePageWhere('viewer', {}),
  )
})

test('브랜드 선택은 종류·계절·색상·태그·검색 조건과 함께 적용한다', () => {
  const filters = {
    category: 'outer' as const, subcategory: '재킷', season: 'autumn' as const,
    color: '브라운', tag: '데일리', search: '재킷',
  }
  const base = wardrobePageWhere('viewer', filters, ['데일리', '여름'])
  const branded = wardrobePageWhere('viewer', { ...filters, brandName: 'roughside' }, ['데일리', '여름'])
  const withoutBrand = (branded.AND as Prisma.WardrobeItemWhereInput[]).filter((condition) => !condition.brandName)
  assert.equal(branded.userId, 'viewer')
  assert.deepEqual(withoutBrand, base.AND)
  assert.ok((branded.AND as Prisma.WardrobeItemWhereInput[]).includes(activeWardrobeWhere))
})

test('브랜드 미지정은 null·누락·빈 이름을 포함하고 선택한 브랜드명보다 우선한다', () => {
  assert.deepEqual(wardrobePageWhere('viewer', { brandName: 'COS', unbrandedOnly: true }), {
    userId: 'viewer',
    AND: [activeWardrobeWhere, { OR: [
      { brandName: null }, { brandName: { isSet: false } }, { brandName: '' },
    ] }],
  })
  assert.deepEqual(
    wardrobePageWhere('viewer', { brandName: 'COS', unbrandedOnly: false }),
    wardrobePageWhere('viewer', { brandName: 'COS' }),
  )
})

