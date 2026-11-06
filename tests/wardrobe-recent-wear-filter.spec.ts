import { createWardrobeItem, expect, test } from './support/fixture'

test.use({ timezoneId: 'UTC' })

// UTC로는 11월 5일이지만 한국 날짜는 이미 11월 6일이다.
const now = new Date('2026-11-05T15:30:00Z')

test('옷 선택에서 설정한 최근 착용 기간을 적용하고 필터를 해제할 수 있다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(now)
  mockApi.wardrobeItems = [
    createWardrobeItem({ id: 'today', name: '오늘 입은 코트', category: 'outer', subcategory: '코트', lastWornAt: '2026-11-06T00:00:00.000Z' }),
    createWardrobeItem({ id: 'boundary', name: '3일 전 코트', category: 'outer', subcategory: '코트', lastWornAt: '2026-11-03T00:00:00.000Z' }),
    createWardrobeItem({ id: 'old', name: '4일 전 코트', category: 'outer', subcategory: '코트', lastWornAt: '2026-11-02T00:00:00.000Z' }),
    createWardrobeItem({ id: 'never', name: '새 코트', category: 'outer', subcategory: '코트' }),
  ]
  await page.route('**/graphql', async (route) => {
    if (!route.request().postDataJSON().query.includes('query Me ')) {
      await route.fallback()
      return
    }
    await route.fulfill({ json: { data: { me: {
      id: 'e2e-user', displayName: '최근 착용 테스트', email: null, isTemporary: true,
      styleProfile: { gender: null, bodyBuild: null, heightCm: null, weightKg: null, chestCircumferenceCm: null, waistCircumferenceCm: null, hipCircumferenceCm: null, shoulderWidthCm: null, inseamCm: null, preferredFit: 'regular', preferredStyles: [] },
      wearReminderPreferences: { enabled: false, intervalDays: 3, combinationReminderEnabled: false, itemReminderEnabled: false },
    } } } })
  })

  await page.goto('/plan/2026-10-28')
  await page.getByRole('button', { name: '아우터 고르기', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '아우터 옷 선택' })
  const todaysCoat = picker.getByRole('button', { name: /오늘 입은 코트/ })
  const boundaryCoat = picker.getByRole('button', { name: /3일 전 코트/ })
  await expect(todaysCoat).toBeVisible()
  await expect(todaysCoat.getByText('오늘 착용', { exact: true })).toBeVisible()
  await expect(boundaryCoat).toBeVisible()
  await todaysCoat.click()
  await picker.getByRole('button', { name: '아우터 필터', exact: true }).click()

  const filter = picker.getByRole('button', { name: '최근 3일 입은 옷 숨기기', exact: true })
  await expect(filter).toHaveAttribute('aria-pressed', 'false')
  await filter.click()
  await expect(filter).toHaveAttribute('aria-pressed', 'true')
  await expect(todaysCoat).toHaveCount(0)
  await expect(boundaryCoat).toHaveCount(0)
  await expect(picker.getByRole('button', { name: /4일 전 코트/ })).toBeVisible()
  await expect(picker.getByRole('button', { name: /새 코트/ })).toBeVisible()
  await expect(picker.getByRole('button', { name: '1개 선택 완료', exact: true })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('recent-wear-filter.png'), animations: 'disabled' })

  await filter.click()
  await expect(todaysCoat).toHaveAttribute('aria-pressed', 'true')
  await expect(boundaryCoat).toBeVisible()
  await filter.click()
  await picker.getByRole('button', { name: '필터 초기화', exact: true }).click()
  await expect(filter).toHaveAttribute('aria-pressed', 'false')
  await expect(todaysCoat).toHaveAttribute('aria-pressed', 'true')
  await expect(boundaryCoat).toBeVisible()
})

test('코디북 만들기의 옷 선택에도 최근 착용 필터를 적용한다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.clock.setFixedTime(now)
  mockApi.wardrobeItems = [
    createWardrobeItem({ id: 'item-1', name: '기준 셔츠' }),
    createWardrobeItem({ id: 'recent-pants', name: '최근 입은 바지', category: 'bottom', subcategory: '바지', lastWornAt: '2026-10-30T00:00:00.000Z' }),
    createWardrobeItem({ id: 'old-pants', name: '오래전 바지', category: 'bottom', subcategory: '바지', lastWornAt: '2026-10-29T00:00:00.000Z' }),
  ]

  await page.goto('/lookbook/new?items=item-1')
  const composer = page.getByRole('dialog', { name: '코디 맞춰보기' })
  await composer.getByRole('button', { name: '하의 아이템 고르기', exact: true }).click()
  const recentPants = composer.getByRole('button', { name: '최근 입은 바지 Look에 추가', exact: true })
  await expect(recentPants).toBeVisible()
  await composer.getByRole('button', { name: '하의 필터', exact: true }).click()
  const filter = composer.getByRole('button', { name: '최근 7일 입은 옷 숨기기', exact: true })
  await expect(filter).toHaveAttribute('aria-pressed', 'false')
  await filter.click()
  await expect(recentPants).toHaveCount(0)
  await expect(composer.getByRole('button', { name: '오래전 바지 Look에 추가', exact: true })).toBeVisible()
  await filter.click()
  await expect(recentPants).toBeVisible()
})
