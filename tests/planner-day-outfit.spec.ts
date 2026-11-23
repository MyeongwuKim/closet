import { createOutfit, createWardrobeItem, expect, test } from './support/fixture'

for (const choice of ['copy', 'later', 'existing'] as const) {
  test(`플래너에서 공통 코디 화면으로 날짜에 먼저 저장한다 (${choice})`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(choice === 'later' ? { width: 1440, height: 900 } : { width: 390, height: 844 })
    await page.clock.setFixedTime(new Date('2026-11-23T12:00:00+09:00'))
    const date = '2026-11-25'
    const backPath = `/plan?view=today&date=${date}`
    mockApi.outfits = choice === 'existing' ? [createOutfit()] : []
    mockApi.wardrobeItems.push(
      createWardrobeItem({ id: 'long-tee', name: '흰 긴팔', subcategory: '긴팔', colorName: '흰색' }),
      createWardrobeItem({ id: 'knit', name: '검은 니트', subcategory: '니트', colorName: '검정' }),
    )
    await page.goto(backPath)
    await page.getByRole('link', { name: /옷 직접 고르기|내 옷으로 코디 만들기/ }).click()
    const composer = page.getByRole('dialog', { name: '코디 맞춰보기' })
    await composer.getByRole('button', { name: '상의·원피스 아이템 고르기' }).click()
    const kinds = composer.getByRole('navigation', { name: /상의.*세부 카테고리/ })
    await kinds.getByRole('button', { name: '니트', exact: true }).click()
    await expect(composer.getByRole('button', { name: '검은 니트 코디에 추가' })).toBeVisible()
    await expect(composer.getByRole('button', { name: '흰 긴팔 코디에 추가' })).toHaveCount(0)
    await expect(kinds.getByRole('button', { name: '검정', exact: true })).toHaveCount(0)
    const filters = composer.getByRole('button', { name: /상의.*필터/ })
    await expect(filters).toHaveAttribute('aria-expanded', 'false')
    if (choice === 'copy') {
      await page.screenshot({ path: testInfo.outputPath('composer-subcategories.png'), animations: 'disabled' })
      await filters.click()
      await expect(composer.getByRole('button', { name: '검정', exact: true })).toBeVisible()
      await filters.click()
    }
    await kinds.getByRole('button', { name: '전체', exact: true }).click()
    await composer.getByRole('button', { name: '테스트 셔츠 코디에 추가' }).click()
    if (choice === 'copy') {
      await composer.getByRole('button', { name: '받쳐 입는 옷 추가' }).click()
      const innerPicker = page.getByRole('dialog', { name: '받쳐 입는 옷 선택' })
      await innerPicker.getByRole('button', { name: /흰 긴팔/ }).click()
      await innerPicker.getByRole('button', { name: '1개 선택 완료' }).click()
    }
    await composer.getByRole('button', { name: '하의 아이템 고르기' }).click()
    await composer.getByRole('button', { name: '테스트 바지 코디에 추가' }).click()
    if (choice === 'copy') {
      await composer.getByRole('button', { name: '스타일 · 계절 설정', exact: true }).click()
      const info = page.getByRole('dialog', { name: '플래너에 넣을 코디' })
      await info.getByRole('textbox', { name: '코디 이름' }).fill('겨울 미니멀 코디')
      await info.getByRole('button', { name: '미니멀', exact: true }).click()
      const seasons = info.getByRole('group', { name: '입을 계절' })
      await seasons.getByRole('button', { name: '봄', exact: true }).click()
      await seasons.getByRole('button', { name: '겨울', exact: true }).click()
      await page.screenshot({ path: testInfo.outputPath('planner-style-season.png'), animations: 'disabled' })
      await info.getByRole('button', { name: '플래너에 추가하기', exact: true }).click()
    } else {
      await composer.getByRole('button', { name: '플래너에 추가하기', exact: true }).click()
    }

    const prompt = page.getByRole('alertdialog', { name: '코디북에도 추가할까요?' })
    if (choice === 'existing') {
      await expect(page).toHaveURL(backPath)
      await expect(prompt).toHaveCount(0)
    } else {
      await expect(prompt).toBeVisible()
      expect(mockApi.plannerEntries[0]).toMatchObject({ date, outfit: { plannerOnly: true } })
      expect(mockApi.outfits).toHaveLength(0)
      if (choice === 'copy') {
        await page.screenshot({ path: testInfo.outputPath('copy-to-lookbook.png'), animations: 'disabled' })
        await prompt.getByRole('button', { name: '코디북에 추가', exact: true }).click()
      } else {
        await prompt.getByRole('button', { name: '나중에', exact: true }).click()
      }
      await expect(page).toHaveURL(backPath)
    }
    await expect(page.getByRole('link', { name: choice === 'copy' ? /겨울 미니멀 코디, 옷 설정하기/ : /직접 고른 코디, 옷 설정하기/ })).toBeVisible()
    expect(mockApi.outfits).toHaveLength(choice === 'later' ? 0 : 1)
    expect(mockApi.operations.filter((operation) => operation === 'SetDirectPlannerEntry')).toHaveLength(1)
    expect(mockApi.operations.filter((operation) => operation === 'SavePlannerOutfitToLookbook')).toHaveLength(choice === 'copy' ? 1 : 0)
    if (choice === 'copy') {
      expect(mockApi.outfits[0].items[0]).toMatchObject({ wardrobeItemId: 'long-tee', isBaseLayer: true })
      expect(mockApi.outfits[0]).toMatchObject({ name: '겨울 미니멀 코디', style: 'minimal', seasons: ['winter'] })
      expect(mockApi.outfits[0].id).not.toBe(mockApi.plannerEntries[0].outfit?.id)

      await page.getByRole('link', { name: /겨울 미니멀 코디, 옷 설정하기/ }).click()
      const savedItems = page.getByRole('region', { name: '이 코디에 담은 옷' })
      const baseLayerName = savedItems.getByText('흰 긴팔', { exact: true })
      const edit = page.getByRole('button', { name: '코디 수정', exact: true })
      await expect(savedItems.getByText('테스트 셔츠', { exact: true })).toBeVisible()
      await expect(baseLayerName).toBeVisible()
      await expect(savedItems.getByText('받쳐 입는 옷', { exact: true })).toBeVisible()
      await expect(savedItems.locator('dd').first()).toHaveText('테스트 셔츠')
      const topSlot = page.getByRole('button', { name: /상의 아이템 바꾸기/ })
      await expect(topSlot).toHaveCount(0)

      await edit.click()
      await expect(page.getByRole('heading', { name: '코디 편집', exact: true })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('planner-outfit-edit.png'), animations: 'disabled' })
      await topSlot.click()
      const topPicker = page.getByRole('dialog', { name: '상의 옷 선택' })
      await expect(topPicker.getByRole('button', { name: /흰 긴팔/ })).toHaveCount(0)
      await topPicker.getByRole('button', { name: /검은 니트/ }).click()
      await topPicker.getByRole('button', { name: '1개 선택 완료' }).click()
      await page.getByRole('button', { name: '취소', exact: true }).click()
      await expect(savedItems.getByText('테스트 셔츠', { exact: true })).toBeVisible()
      expect(mockApi.operations.filter((operation) => operation === 'SetDirectPlannerEntry')).toHaveLength(1)

      await edit.click()
      await topSlot.click()
      await topPicker.getByRole('button', { name: /검은 니트/ }).click()
      await topPicker.getByRole('button', { name: '1개 선택 완료' }).click()
      await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
      await expect.poll(() => mockApi.plannerEntries[0].outfit?.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ wardrobeItemId: 'long-tee', isBaseLayer: true }),
        expect.objectContaining({ wardrobeItemId: 'knit' }),
      ]))
      await page.reload()
      await expect(savedItems.getByText('검은 니트', { exact: true })).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('planner-layered-outfit.png'), animations: 'disabled' })
      await baseLayerName.scrollIntoViewIfNeeded()
      await expect(baseLayerName).toBeInViewport()

      await page.setViewportSize({ width: 1440, height: 900 })
      await expect(baseLayerName).toBeInViewport()
      await page.screenshot({ path: testInfo.outputPath('planner-layered-outfit-desktop.png'), animations: 'disabled' })
    }
  })
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 하루 보기에서 날짜에 맞는 코디북 코디를 검색해 배정하고 교체한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.clock.setFixedTime(new Date('2026-11-06T12:00:00+09:00'))
    const date = '2026-10-28'
    const route = `/plan?view=today&date=${date}`
    const work = createOutfit({ name: '출근 코디' })
    const casual = createOutfit({
      id: 'outfit-2',
      name: '주말 코디',
      items: [{ wardrobeItemId: 'item-2', layerOrder: 0 }],
    })
    mockApi.outfits = [work, casual]
    let release = () => {}
    const refetch = new Promise<void>((resolve) => { release = resolve })
    const assignmentDates: string[] = []
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (query.includes('mutation SetPlannerEntry')) {
        assignmentDates.push(`${variables.input.weekStartsOn}/${variables.input.date}`)
      }
      if (query.includes('query PlannerEntries') && variables.from === date && assignmentDates.length > 0) {
        await refetch
      }
      await route.fallback()
    })

    try {
      await page.goto(route)
      const choose = page.getByRole('button', { name: '코디북에서 고르기', exact: true })
      await expect(choose).toBeVisible()
      await expect(page.getByRole('button', { name: '일주일 코디 설정' })).toHaveCount(0)
      await page.getByRole('link', { name: '옷 직접 고르기', exact: true }).click()
      await page.getByRole('button', { name: '코디 만들기 닫기' }).click()
      await expect(page).toHaveURL(route)
      await expect(choose).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: testInfo.outputPath('day-planner.png'), animations: 'disabled' })

      await choose.click()
      const picker = page.getByRole('dialog', { name: '코디 고르기' })
      await expect(picker.getByRole('heading', { name: '10월 28일에 넣을 코디' })).toBeVisible()
      await expect(picker.getByLabel('설정할 요일')).toHaveCount(0)
      await picker.getByRole('button', { name: '코디 검색', exact: true }).click()
      await picker.getByRole('searchbox', { name: '코디 검색어' }).fill('출근')
      await expect(picker.getByRole('button', { name: /주말 코디/ })).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath('day-outfit-picker.png'), animations: 'disabled' })
      await picker.getByRole('button', { name: /출근 코디/ }).click()
      await expect(picker).toHaveCount(0)
      await expect(page.getByText('출근 코디', { exact: true })).toBeVisible()
      expect(assignmentDates).toEqual(['2026-10-26/2026-10-28'])
      expect(mockApi.plannerEntries).toHaveLength(1)
      expect(mockApi.plannerEntries[0].outfit?.plannerOnly).toBe(true)
      release()

      const assignedCard = page.getByRole('link', { name: /출근 코디, 옷 설정하기/ })
      await expect(assignedCard).toBeVisible()
      await expect(page.getByRole('button', { name: '코디 바꾸기', exact: true })).toHaveCount(0)
      await page.screenshot({ path: testInfo.outputPath('assigned-day-card.png'), animations: 'disabled' })
      await assignedCard.getByText('상의', { exact: true }).click()
      await page.getByRole('button', { name: '코디북에서 고르기', exact: true }).click()
      await picker.getByRole('button', { name: /주말 코디/ }).click()
      await expect(picker).toHaveCount(0)
      await expect(page.getByText('주말 코디', { exact: true })).toBeVisible()
      expect(mockApi.plannerEntries.map((entry) => entry.date)).toEqual([date])
      await page.getByRole('button', { name: '플래너로 돌아가기', exact: true }).click()
      await expect(page).toHaveURL(route)

      await page.getByRole('radio', { name: '월간', exact: true }).click()
      await expect(page.getByRole('link', { name: `${date}, 주말 코디` })).toBeVisible()
      await expect(page.getByRole('button', { name: '일주일 코디 설정' })).toHaveCount(0)
      await page.getByRole('radio', { name: '주간', exact: true }).click()
      await expect(page.getByRole('button', { name: '일주일 코디 설정' })).toBeVisible()
    } finally {
      release()
    }
  })
}

test('오늘 코디 고르기에서 카드 사진을 맞추고 기온과 코디북 필터를 함께 적용한다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(new Date('2026-11-21T12:00:00+09:00'))
  const worn = createOutfit({ id: '000000000000000000000101', name: '기온 기록 코디' })
  const unworn = createOutfit({
    id: '000000000000000000000102', name: '처음 입는 코디',
    createdAt: '2026-11-20T00:00:00.000Z',
    items: [{ wardrobeItemId: 'item-2', layerOrder: 0 }],
  })
  mockApi.outfits = [worn, unworn]
  mockApi.plannerEntries = [{
    date: '2026-11-19', title: worn.name, outfit: { ...worn, plannerOnly: true }, occasion: null,
    weatherSummary: null, temperatureC: null, wornAt: '2026-11-19T12:00:00+09:00', wearTemperatureC: 12,
  }]
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ permissions: { location: 'granted' }, capabilities: [] }),
      getCurrentLocation: async () => ({ status: 'available', latitude: 37.57, longitude: 126.98, accuracy: 100 }),
    } as unknown as NonNullable<Window['ClosetNative']>
  })
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('query WeatherForecast')) return route.fallback()
    await route.fulfill({ json: { data: { weatherForecast: {
      date: variables.input.date, expiresAt: '2026-11-21T04:00:00Z', temperatureC: 18, meanTemperatureC: 12,
      minTemperatureC: 7, maxTemperatureC: 18, apparentTemperatureC: 17, precipitationProbability: 0,
      weatherCode: 0, summary: '맑음', recommendedSeason: 'fall', source: 'open-meteo', attribution: 'Open-Meteo',
      attributionUrl: 'https://open-meteo.com/',
    } } } })
  })
  await page.goto('/plan?view=today&date=2026-11-21')
  await page.getByRole('button', { name: '코디북에서 고르기', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '코디 고르기', exact: true })
  const wornCard = picker.getByRole('button', { name: /기온 기록 코디/ })
  const unwornCard = picker.getByRole('button', { name: /처음 입는 코디/ })
  await expect(wornCard).toContainText('12℃에 입었어요')
  const photoTop = (card: typeof wornCard) => card.locator('[class*="aspect-"]').first().evaluate((node) => node.getBoundingClientRect().top)
  expect(await photoTop(wornCard)).toBe(await photoTop(unwornCard))
  await page.screenshot({ path: testInfo.outputPath('today-outfit-picker.png'), animations: 'disabled' })

  await picker.getByRole('button', { name: '코디북 필터' }).click()
  const filters = page.getByRole('dialog', { name: '코디북 필터' })
  await filters.getByRole('button', { name: '오래된순' }).click()
  await page.keyboard.press('Escape')
  await expect(filters).toHaveCount(0)
  await expect(picker).toBeVisible()
  expect((await wornCard.boundingBox())!.x).toBeLessThan((await unwornCard.boundingBox())!.x)

  const weatherFilter = picker.getByRole('button', { name: '오늘 기온 · 평균 12℃' })
  await weatherFilter.click()
  await expect(weatherFilter).toHaveAttribute('aria-pressed', 'true')
  await expect(unwornCard).toHaveCount(0)
  await expect(wornCard).toBeVisible()
  await weatherFilter.click()
  await expect(unwornCard).toBeVisible()

  await picker.getByRole('button', { name: '코디북 필터' }).click()
  await filters.getByRole('button', { name: '네이비', exact: true }).click()
  await filters.getByRole('button', { name: '코디 보기', exact: true }).click()
  await expect(unwornCard).toHaveCount(0)
  await expect(wornCard).toBeVisible()
})
