import { expect, test } from './support/fixture'

test.use({ timezoneId: 'Asia/Seoul' })

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  test(`${viewport.name}: 하루·주간·월간의 날짜 제목과 기간 이동을 표시한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.clock.install({ time: new Date('2026-09-02T12:00:00+09:00') })
    await page.goto('/plan?view=today')

    const header = page.locator('.plan-period-header')
    const title = header.getByRole('heading', { level: 2 })
    const checkTitleFits = async (previousLabel: string) => {
      const titleBounds = await title.boundingBox()
      const buttonBounds = await header.getByRole('button', { name: previousLabel }).boundingBox()
      expect(titleBounds).not.toBeNull()
      expect(buttonBounds).not.toBeNull()
      expect(titleBounds!.x + titleBounds!.width).toBeLessThan(buttonBounds!.x)
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
    }

    await expect(header.getByText('2026년 · 하루 플래너')).toBeVisible()
    await expect(title).toHaveText('09.02')
    await expect(title).toHaveAttribute('aria-label', '2026년 9월 2일 수요일')
    await expect(header.getByText('수요일')).toBeVisible()
    await checkTitleFits('이전 날짜')
    await testInfo.attach(`${viewport.name}-day-period`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })

    await header.getByRole('button', { name: '다음 날짜' }).click()
    await expect(title).toHaveText('09.03')

    await page.getByRole('radio', { name: '주간' }).click()
    await expect(header.getByText('2026년 · 주간 플래너')).toBeVisible()
    await expect(title).toHaveText('08.31—09.06')
    await expect(title).toHaveAttribute('aria-label', '2026년 8월 31일 – 2026년 9월 6일')
    await expect(header.getByText('월요일')).toBeVisible()
    await expect(header.getByText('일요일')).toBeVisible()
    await checkTitleFits('이전 주')

    await testInfo.attach(`${viewport.name}-week-period`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })

    await header.getByRole('button', { name: '다음 주' }).click()
    await expect(title).toHaveText('09.07—09.13')

    await page.getByRole('radio', { name: '월간' }).click()
    await expect(header.getByText('2026년 · 월간 플래너')).toBeVisible()
    await expect(title).toHaveText('9월')
    await expect(title).toHaveAttribute('aria-label', '2026년 9월')
    await checkTitleFits('이전 달')
    await testInfo.attach(`${viewport.name}-month-period`, {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })

    await header.getByRole('button', { name: '다음 달' }).click()
    await expect(title).toHaveText('10월')
    await header.getByRole('button', { name: '이전 달' }).click()
    await expect(title).toHaveText('9월')
    expect(mockApi.operations).toContain('PlannerWeek')
  })
}
