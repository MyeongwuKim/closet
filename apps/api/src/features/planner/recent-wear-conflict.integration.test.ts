import assert from 'node:assert/strict'
import test from 'node:test'
import type { WardrobeItem } from '@prisma/client'
import { buildApp } from '../../app.js'
import { prisma } from '../../lib/prisma.js'
import { hashSessionToken } from '../auth/sessionToken.js'
import { getKoreaTodayUtc } from '../wardrobe/wardrobe.service.js'

test('별도 MongoDB에서 최근 착용 기간·착용 확인·계정 구분을 GraphQL로 검증한다', { skip: !process.env.RECENT_WEAR_INTEGRATION_DATABASE }, async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/closet_recent_wear_test_\d+$/)
  const collections = await prisma.$runCommandRaw({ listCollections: 1, nameOnly: true }) as unknown as { cursor: { firstBatch: unknown[] } }
  assert.equal(collections.cursor.firstBatch.length, 0, '새 테스트 DB에서만 실행한다')
  const app = await buildApp()
  t.after(async () => {
    await app.close()
    await prisma.$runCommandRaw({ dropDatabase: 1 })
    await prisma.$disconnect()
  })
  const user = await prisma.user.create({ data: { displayName: '최근 착용 통합 테스트' } })
  const other = await prisma.user.create({ data: { displayName: '다른 테스트 사용자' } })
  for (const [owner, token] of [[user, 'recent-wear-test'], [other, 'recent-wear-other']] as const) {
    await prisma.userSession.create({ data: { userId: owner.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 3_600_000) } })
  }
  const categories = ['top', 'bottom', 'outer', 'shoes', 'bottom'] as const
  const items: WardrobeItem[] = []
  for (const category of categories) {
    items.push(await prisma.wardrobeItem.create({ data: { userId: user.id, name: `테스트 ${category}`, category } }))
  }
  const [top, bottom, outer, shoes, otherBottom] = items
  assert.ok(top && bottom && outer && shoes && otherBottom)
  const makeOutfit = (name: string, selected: typeof items) => prisma.outfit.create({ data: {
    userId: user.id, name, style: 'casual',
    items: { create: selected.map((item, layerOrder) => ({ wardrobeItemId: item.id, slot: item.category!, layerOrder })) },
  } })
  const exact = await makeOutfit('같은 코디', [top, bottom, shoes])
  const combination = await makeOutfit('핵심 조합', [top, bottom, outer])
  const single = await makeOutfit('같은 상의', [top, otherBottom])
  const today = getKoreaTodayUtc()
  const day = (offset: number) => new Date(today.getTime() + offset * 86_400_000)
  const date = (offset: number) => day(offset).toISOString().slice(0, 10)
  const week = await prisma.plannerWeek.create({ data: { userId: user.id, weekStartsOn: day(-8) } })
  const entries = new Map<number, string>()
  for (const [offset, outfit, worn] of [
    [-8, exact, true], [-7, exact, true], [-6, combination, true], [-5, single, true],
    [-2, exact, false], [0, exact, false], [1, exact, true],
  ] as const) {
    const entry = await prisma.plannerEntry.create({ data: {
      plannerWeekId: week.id, date: day(offset), outfitId: outfit.id, wornAt: worn ? new Date() : null,
    } })
    entries.set(offset, entry.id)
  }
  const itemIds = [top.id, bottom.id, shoes.id]
  const check = async (overrides: Record<string, unknown> = {}, token = 'recent-wear-test') => {
    const response = await app.inject({ method: 'POST', url: '/graphql', headers: { authorization: `Bearer ${token}` }, payload: {
      query: 'query RecentWearConflict($input: RecentWearConflictInput!) { recentWearConflict(input: $input) { kind wornDate itemIds outfitName } }',
      variables: { input: { itemIds, targetDate: date(0), intervalDays: 7, combinationReminderEnabled: true, itemReminderEnabled: true, ...overrides } },
    } })
    const body = response.json()
    assert.equal(body.errors, undefined)
    return body.data.recentWearConflict as { kind: string; wornDate: string; itemIds: string[] } | null
  }

  await t.test('7일 경계의 같은 코디가 더 최근의 부분 조합보다 우선한다', async () => {
    const result = await check()
    assert.equal(result?.kind, 'exact')
    assert.equal(result?.wornDate, date(-7))
  })
  await t.test('기간을 줄이면 핵심 조합·개별 옷·충돌 없음으로 바뀐다', async () => {
    assert.equal((await check({ intervalDays: 6 }))?.kind, 'combination')
    assert.equal((await check({ intervalDays: 5 }))?.kind, 'item')
    assert.equal(await check({ intervalDays: 4 }), null)
  })
  await t.test('조합·개별 옷 설정과 사용자 범위를 지킨다', async () => {
    assert.equal((await check({ combinationReminderEnabled: false }))?.kind, 'item')
    assert.equal((await check({ itemReminderEnabled: false }))?.kind, 'exact')
    assert.equal(await check({ combinationReminderEnabled: false, itemReminderEnabled: false }), null)
    assert.equal(await check({}, 'recent-wear-other'), null)
  })
  await t.test('신발만 겹치는 경우에는 개별 옷 알림을 만들지 않는다', async () => {
    assert.equal(await check({ itemIds: [shoes.id] }), null)
  })
  await t.test('오늘 착용 확인은 대상 날짜 포함 옵션을 켠 경우에만 본다', async () => {
    await prisma.plannerEntry.update({ where: { id: entries.get(0)! }, data: { wornAt: new Date() } })
    assert.equal((await check())?.wornDate, date(-7))
    assert.equal((await check({ includeTargetDate: true }))?.wornDate, date(0))
    await prisma.plannerEntry.update({ where: { id: entries.get(0)! }, data: { wornAt: null } })
  })
  await t.test('착용을 취소하면 미확인·기간 밖·미래 기록은 경고에서 제외한다', async () => {
    await prisma.plannerEntry.updateMany({ where: { id: { in: [-7, -6, -5].map(offset => entries.get(offset)!) } }, data: { wornAt: null } })
    assert.equal(await check({ includeTargetDate: true }), null)
  })
})
