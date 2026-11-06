import { createOutfit, expect, test } from './support/fixture'

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
      await page.getByRole('button', { name: '플래너로 돌아가기' }).click()
      await expect(page).toHaveURL(route)
      await expect(choose).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: testInfo.outputPath('day-planner.png'), animations: 'disabled' })

      await choose.click()
      const picker = page.getByRole('dialog', { name: '하루 코디 선택' })
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

      await page.getByRole('button', { name: '코디 바꾸기', exact: true }).click()
      await picker.getByRole('button', { name: /주말 코디/ }).click()
      await expect(picker).toHaveCount(0)
      await expect(page.getByText('주말 코디', { exact: true })).toBeVisible()
      expect(mockApi.plannerEntries.map((entry) => entry.date)).toEqual([date])

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
