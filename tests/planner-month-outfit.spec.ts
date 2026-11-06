import { createOutfit, expect, test } from './support/fixture'

test.use({ timezoneId: 'Asia/Seoul' })

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 월간 날짜 상세에서 코디북의 코디를 검색해 배정한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.clock.setFixedTime(new Date('2026-11-06T12:00:00+09:00'))
    const date = '2026-10-28'
    const monthUrl = '/plan?view=month&month=2026-10'
    const work = createOutfit({ name: '출근 코디' })
    mockApi.outfits = [work, createOutfit({ id: 'outfit-2', name: '주말 코디' })]

    await page.goto(monthUrl)
    const emptyDay = page.getByRole('link', { name: `${date}, 저장된 코디 없음`, exact: true })
    await expect(emptyDay).toBeVisible()
    const getBodyOverflow = () => page.locator('body').evaluate((body) => body.style.overflow)
    const initialOverflow = await getBodyOverflow()
    await emptyDay.click()
    const detail = page.getByRole('dialog', { name: '코디를 설정해주세요 상세' })
    const choose = detail.getByRole('button', { name: '코디북에서 고르기', exact: true })
    await expect(choose).toBeInViewport({ ratio: 1 })
    const detailUrl = page.url()
    await page.screenshot({ path: testInfo.outputPath('month-date-detail.png'), animations: 'disabled' })

    const picker = page.getByRole('dialog', { name: '하루 코디 선택' })
    await choose.click()
    await expect(picker.getByRole('heading', { name: '10월 28일에 넣을 코디' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(picker).toHaveCount(0)
    await expect(detail).toBeVisible()
    await expect(page).toHaveURL(detailUrl)
    await expect.poll(getBodyOverflow).toBe('hidden')
    expect(mockApi.plannerEntries).toHaveLength(0)

    await choose.click()
    await picker.getByRole('button', { name: '코디 검색', exact: true }).click()
    await picker.getByRole('searchbox', { name: '코디 검색어' }).fill('출근')
    await expect(picker.getByRole('button', { name: /주말 코디/ })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('month-outfit-picker.png'), animations: 'disabled' })
    await picker.getByRole('button', { name: /출근 코디/ }).click()
    await expect(picker).toHaveCount(0)
    const assignedDetail = page.getByRole('dialog', { name: '출근 코디 상세' })
    await expect(assignedDetail.getByRole('heading', { name: '출근 코디', exact: true })).toBeVisible()
    await expect(page).toHaveURL(detailUrl)
    expect(mockApi.plannerEntries.map((entry) => entry.date)).toEqual([date])
    expect(mockApi.plannerEntries[0].outfit?.plannerOnly).toBe(true)

    await assignedDetail.getByRole('button', { name: '플래너로 돌아가기' }).click()
    await expect(page).toHaveURL(monthUrl)
    await expect(page.getByRole('link', { name: `${date}, 출근 코디`, exact: true })).toBeVisible()
    await expect.poll(getBodyOverflow).toBe(initialOverflow)
  })
}
