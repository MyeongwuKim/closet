import { test, expect } from './support/fixture'

const statistics = {
  totalItems: 2, totalOutfits: 1, wearRecordCount: 3,
  unwornCount: 1, unwornOutfitCount: 0, throughDate: '2026-11-13',
  categories: [{ key: 'top', label: '상의', count: 2, color: null }],
  colors: [{ key: 'navy', label: '네이비', count: 2, color: '#24364a' }],
  wornStyles: [{ key: 'casual', label: '캐주얼', count: 3, color: null }],
  mostWorn: [{ id: 'item-1', name: '테스트 셔츠', wearCount: 3, imageUrl: null }],
  mostWornOutfits: [{ id: 'outfit-1', name: '기본 코디', wearCount: 3, imageUrl: null, itemImageUrls: [] }],
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 통계 응답의 수치·착용 순위를 표시하고 코디 상세를 연다`, async ({ page, mockApi }) => {
    void mockApi
    await page.setViewportSize(viewport)
    await page.route('**/graphql', async (route) => {
      if (!route.request().postDataJSON().query.includes('query WardrobeStatistics')) return route.fallback()
      await route.fulfill({ json: { data: { wardrobeStatistics: statistics } } })
    })

    await page.goto('/settings/statistics')
    await expect(page.getByText('전체 기록 · 2026.11.13 기준')).toBeVisible()
    for (const [label, count] of [['옷장 아이템', '2개'], ['저장한 코디', '1개'], ['착용 기록', '3회']]) {
      await expect(page.locator('p').filter({ hasText: new RegExp(`^${label}$`) }).locator('..')).toContainText(count)
    }
    await expect(page.getByRole('tabpanel', { name: '옷장 구성' })).toContainText('네이비')
    await page.getByRole('tab', { name: '착용 기록', exact: true }).click()
    await expect(page.getByRole('link', { name: /테스트 셔츠/ })).toContainText('3회')
    await page.getByRole('tab', { name: '코디', exact: true }).click()
    await page.getByRole('button', { name: /기본 코디/ }).click()
    await expect(page.getByRole('dialog', { name: '기본 코디 코디 상세' })).toBeVisible()
    await page.getByRole('button', { name: '통계로 돌아가기', exact: true }).click()
    await expect(page.getByRole('tab', { name: '착용 기록', exact: true })).toHaveAttribute('aria-selected', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('통계 조회 오류는 빈 통계와 구분하고 다시 시도하면 서버 응답을 표시한다', async ({ page, mockApi }) => {
  void mockApi
  let fail = true
  await page.route('**/graphql', async (route) => {
    if (!route.request().postDataJSON().query.includes('query WardrobeStatistics')) return route.fallback()
    await route.fulfill({ json: fail
      ? { data: null, errors: [{ message: '테스트 통계 오류', extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }
      : { data: { wardrobeStatistics: statistics } } })
  })
  await page.goto('/settings/statistics')
  await expect(page.getByRole('alert')).toContainText('통계를 불러오지 못했어요.')
  await expect(page.getByText('아직 옷장에 옷이 없어요', { exact: true })).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: '옷장 구성' })).toContainText('네이비')
})

test('옷장과 착용 기록이 비어 있으면 두 통계 탭에 빈 상태를 표시한다', async ({ page, mockApi }) => {
  void mockApi
  await page.route('**/graphql', async (route) => {
    if (!route.request().postDataJSON().query.includes('query WardrobeStatistics')) return route.fallback()
    await route.fulfill({ json: { data: { wardrobeStatistics: {
      ...statistics, totalItems: 0, totalOutfits: 0, wearRecordCount: 0,
      unwornCount: 0, categories: [], colors: [], wornStyles: [], mostWorn: [], mostWornOutfits: [],
    } } } })
  })
  await page.goto('/settings/statistics')
  await expect(page.getByText('아직 옷장에 옷이 없어요', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '착용 기록', exact: true }).click()
  await expect(page.getByText('플래너에 착용 기록을 남기면 순위가 생겨요.', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: '코디', exact: true }).click()
  await expect(page.getByText('코디북에 코디를 저장하고 플래너에 기록하면 순위가 생겨요.', { exact: true })).toBeVisible()
})
