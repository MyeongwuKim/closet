import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma } from '@prisma/client'
import { buildSchema, getVariableValues, Kind, parse } from 'graphql'
import { typeDefs } from '../../graphql/schema.js'
import { activeWardrobeWhere, catalogService, wardrobePageWhere } from './catalog.service.js'
import { prisma } from '../../lib/prisma.js'

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

test('복수 색상·브랜드·태그는 항목 안에서 OR, 항목 사이에서는 AND로 묶고 사용자·활성 옷 조건을 유지한다', () => {
  const input = {
    category: 'top' as const, colors: ['네이비', '베이지'], brandNames: ['  ＣＯＳ ', 'Arket', 'cos'],
    includeUnbranded: true, tags: ['출근', '주말'],
  }
  assert.deepEqual(wardrobePageWhere('viewer', input, ['출근', '주말', '운동']), {
    userId: 'viewer',
    AND: [
      activeWardrobeWhere,
      { OR: [{ category: 'top' }, { additionalCategories: { has: 'top' } }] },
      { OR: [
        { brandName: { equals: 'COS', mode: 'insensitive' } },
        { brandName: { equals: 'Arket', mode: 'insensitive' } },
        { brandName: null }, { brandName: { isSet: false } }, { brandName: '' },
      ] },
      { colorName: { in: ['네이비', '베이지'] } },
      { tags: { hasSome: ['출근', '주말'] } },
    ],
  })
})

test('비어 있는 복수 필터는 조건을 추가하지 않고 기존 단일 값도 함께 사용할 수 있다', () => {
  const empty = { colors: [], brandNames: [], tags: [], includeUnbranded: false }
  assert.deepEqual(wardrobePageWhere('viewer', empty), wardrobePageWhere('viewer', {}))
  const input = { color: '네이비', colors: ['베이지'], tag: '출근', tags: ['주말'] }
  const where = wardrobePageWhere('viewer', input, ['출근', '주말', '운동'])
  assert.deepEqual(where.AND, [
    activeWardrobeWhere, { colorName: { in: ['네이비', '베이지'] } }, { tags: { hasSome: ['출근', '주말'] } },
  ])
})

test('GraphQL 옷장 조회는 복수 필터 입력을 수용한다', () => {
  const schema = buildSchema(typeDefs)
  const operation = parse('query Page($input: WardrobePageInput) { wardrobePage(input: $input) { totalCount } }').definitions[0]
  assert.equal(operation.kind, Kind.OPERATION_DEFINITION)
  if (operation.kind !== Kind.OPERATION_DEFINITION) return
  const input = { colors: ['네이비', '베이지'], brandNames: ['COS', 'Arket'], tags: ['출근', '주말'], includeUnbranded: true }
  const result = getVariableValues(schema, operation.variableDefinitions ?? [], { input })
  assert.equal(result.errors, undefined)
})

test('복수 태그만 전달해도 원본 태그를 읽고 페이지 조회와 개수 집계에 같은 조건을 쓴다', async (t) => {
  const originalFindMany = prisma.wardrobeItem.findMany
  const originalCount = prisma.wardrobeItem.count
  const findMany = t.mock.fn(async (args: Prisma.WardrobeItemFindManyArgs) => args.select?.tags ? [{ tags: ['출근', '주말', '운동'] }] : [])
  const count = t.mock.fn(async (_args: Prisma.WardrobeItemCountArgs) => 0)
  prisma.wardrobeItem.findMany = findMany as unknown as typeof originalFindMany
  prisma.wardrobeItem.count = count as unknown as typeof originalCount
  t.after(() => { prisma.wardrobeItem.findMany = originalFindMany; prisma.wardrobeItem.count = originalCount })
  await catalogService.wardrobePage('viewer', { tags: ['출근', '주말'] })
  assert.equal(findMany.mock.callCount(), 2)
  const where = { userId: 'viewer', AND: [activeWardrobeWhere, { tags: { hasSome: ['출근', '주말'] } }] }
  const pageWhere = findMany.mock.calls[1]?.arguments[0].where?.AND
  assert.ok(Array.isArray(pageWhere))
  assert.deepEqual(pageWhere[0], where)
  assert.deepEqual(count.mock.calls[0]?.arguments, [{ where }])
})

