import { test, expect, createWardrobeItem } from './support/fixture'

for (const width of [390, 1440]) {
  test(`${width}px: 위치를 저장·검색하고 추천 보류를 새로고침 후 해제한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    mockApi.wardrobeItems = [createWardrobeItem({ id: 'stored-shirt', name: '보관한 셔츠' })]
    mockApi.rediscoveryItems = [{ item: mockApi.wardrobeItems[0], reason: 'no_wear_record', daysSinceLastWorn: null }]
    await page.goto('/closet/stored-shirt')
    await page.getByRole('button', { name: '옷 정보 수정', exact: true }).click()
    const edit = page.getByRole('dialog', { name: '옷 정보 수정', exact: true })
    await edit.getByRole('textbox', { name: '보관 위치' }).fill('본가 겨울옷 박스')
    await edit.getByRole('button', { name: '변경사항 저장' }).click()
    await expect(edit).toHaveCount(0)
    await expect(page.getByText('본가 겨울옷 박스')).toBeVisible()
    await expect(page.getByText('옷 정보를 수정했어요.', { exact: true })).toHaveCount(0)
    await page.getByText('본가 겨울옷 박스').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`location-${width}.png`), fullPage: true, animations: 'disabled' })
    await page.getByRole('button', { name: '안 입는 이유', exact: true }).click()
    const preference = page.getByRole('dialog', { name: '안 입는 이유', exact: true })
    await preference.getByRole('radio', { name: /사이즈가 안 맞아요/ }).click()
    await page.screenshot({ path: testInfo.outputPath(`preference-${width}.png`), fullPage: true, animations: 'disabled' })
    await preference.getByRole('button', { name: '이유 저장' }).click()
    await expect(page.getByRole('button', { name: '사이즈 문제로 추천 보류 중' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: '사이즈 문제로 추천 보류 중' })).toBeVisible()
    await page.goto('/closet')
    await page.getByRole('button', { name: '잊고 있던 옷 확인하기' }).click()
    await expect(page.getByRole('button', { name: '보관한 셔츠 코디 추천' })).toHaveCount(0)
    await page.getByRole('button', { name: '잊고 있던 옷 닫기' }).click()
    await page.getByRole('button', { name: '옷장 검색', exact: true }).click()
    await page.getByRole('searchbox', { name: '옷장 검색어' }).fill('본가')
    await expect(page.getByRole('button', { name: '보관한 셔츠 옷 상세 보기' })).toBeVisible()
    await page.getByRole('button', { name: '보관한 셔츠 옷 상세 보기' }).click()
    await page.getByRole('button', { name: '사이즈 문제로 추천 보류 중' }).click()
    await preference.getByRole('radio', { name: /사유 지우기/ }).click()
    await preference.getByRole('button', { name: '이유 저장' }).click()
    expect(mockApi.wardrobeItems[0].wearAvoidanceReason).toBeNull()
    expect(mockApi.operations).not.toContain('TodayOutfitRecommendation')
    await page.getByRole('button', { name: '옷 정보 수정', exact: true }).click()
    await edit.getByRole('textbox', { name: '보관 위치' }).fill('')
    await edit.getByRole('button', { name: '변경사항 저장' }).click()
    expect(mockApi.wardrobeItems[0].storageLocation).toBeNull()
  })
}

test('보류한 옷의 과거 추천을 자동 복원하지 않고 설정 변경만으로 AI를 재실행하지 않는다', async ({ page, mockApi }) => {
  const oldItems = mockApi.wardrobeItems.map((item) => ({ ...item }))
  const freshShirt = createWardrobeItem({ id: 'fresh-shirt', name: '다시 입을 셔츠' })
  mockApi.wardrobeItems = [{ ...mockApi.wardrobeItems[0], wearAvoidanceReason: 'fit_issue' }, mockApi.wardrobeItems[1], freshShirt]
  let requests = 0
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('query TodayOutfitRecommendation')) { await route.fallback(); return }
    requests++
    await route.fulfill({ json: { data: { todayOutfitRecommendation: {
      date: variables.input.date, season: 'spring', ready: true, combinationCount: 2,
      headline: '보류를 반영한 새 추천', summary: '보류하지 않은 옷을 골랐어요.', style: null,
      items: [freshShirt, mockApi.wardrobeItems[1]], reasons: [], profileSummary: [], source: 'fallback', model: null, colorSchemeApplied: true, weather: null,
    } } } })
  })
  await page.goto('/plan')
  await page.evaluate(async (items) => {
    const path = '/src/features/plan/utils/todayRecommendationHistory.ts'
    const history = await import(path)
    const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
    history.storeTodayRecommendation('e2e-user', date, 'spring', null, 0, {
      date, season: 'spring', ready: true, headline: '보류 전 추천', summary: '예전 조합이에요.', style: null,
      items, reasons: [], profileSummary: [], source: 'fallback', model: null, colorSchemeApplied: true, weather: null,
    }, undefined, 'auto')
  }, oldItems)
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
  await sheet.getByRole('button', { name: '조건 바꾸기', exact: true }).click()
  await sheet.getByRole('button', { name: '봄', exact: true }).click()
  await sheet.getByRole('button', { name: '자동', exact: true }).click()
  await expect(sheet.getByText('보류를 반영한 새 추천', { exact: true })).toBeVisible()
  await expect(sheet.getByText('보류 전 추천', { exact: true })).toHaveCount(0)
  expect(requests).toBe(1)
  expect(await page.evaluate(() => Object.values(localStorage).some((value) => value.includes('보류 전 추천')))).toBe(true)
  mockApi.wardrobeItems = mockApi.wardrobeItems.map((item) => item.id === freshShirt.id ? { ...item, storageLocation: '새 서랍' } : item)
  await page.evaluate(async () => {
    const path = '/src/lib/queryClient.ts'
    const { queryClient } = await import(path)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wardrobe'] }),
      queryClient.invalidateQueries({ queryKey: ['planner', 'today-recommendation'], refetchType: 'none' }),
    ])
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  await expect(sheet.getByText('보류를 반영한 새 추천', { exact: true })).toBeVisible()
  expect(requests).toBe(1)
  mockApi.wardrobeItems = mockApi.wardrobeItems.map((item) => item.id === freshShirt.id ? { ...item, wearAvoidanceReason: 'fit_issue' } : item)
  await page.evaluate(async () => {
    const path = '/src/lib/queryClient.ts'
    const { queryClient } = await import(path)
    await queryClient.invalidateQueries({ queryKey: ['wardrobe'] })
  })
  await expect(sheet.getByText('옷장 설정이 바뀌었어요. 다시 추천받아주세요.', { exact: true })).toBeVisible()
  expect(requests).toBe(1)
})
