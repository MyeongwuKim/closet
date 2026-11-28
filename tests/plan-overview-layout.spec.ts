import type { Locator, Page } from '@playwright/test'
import { createOutfit, expect, test } from './support/fixture'

async function bottomOfVisibleContent(page: Page) {
  return page.evaluate(() => {
    const tabBar = document.querySelector('nav[aria-label="모바일 주요 메뉴"]')
    return tabBar?.getBoundingClientRect().height
      ? tabBar.getBoundingClientRect().top
      : window.innerHeight
  })
}

async function bottomOf(locator: Locator) {
  return locator.evaluate((element) => element.getBoundingClientRect().bottom)
}

async function expectNoPageScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const { scrollHeight, scrollWidth } = document.documentElement
    return { vertical: scrollHeight - innerHeight, horizontal: scrollWidth - innerWidth }
  })
  expect.soft(overflow.vertical).toBeLessThanOrEqual(0)
  expect.soft(overflow.horizontal).toBeLessThanOrEqual(0)
}

test.use({ timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })

for (const viewport of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`${viewport.width}×${viewport.height}: 주간 전체와 6주짜리 월간 달력을 스크롤 없이 본다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.clock.setFixedTime(new Date('2026-11-29T12:00:00+09:00'))
    const outfit = createOutfit({ name: '출근 코디' })
    mockApi.plannerEntries = ['2026-11-24', '2026-11-29', '2026-11-30'].map((date) => ({
      date,
      title: outfit.name,
      wornAt: date === '2026-11-24' ? '2026-11-24T01:00:00Z' : null,
      occasion: '출근',
      weatherSummary: null,
      temperatureC: null,
      outfit: { ...outfit, plannerOnly: true },
    }))

    await page.goto('/plan?view=week')
    const weekRows = page.locator('[data-plan-date]')
    await expect(weekRows).toHaveCount(7)
    await expect(weekRows.last().getByTitle('테스트 셔츠', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('week.png'), animations: 'disabled' })
    expect.soft(await bottomOf(weekRows.last())).toBeLessThanOrEqual(await bottomOfVisibleContent(page))
    await expectNoPageScroll(page)

    await page.getByRole('radio', { name: '월간' }).click()
    const monthDays = page.locator('.plan-month-calendar-days').getByRole('link')
    await expect(monthDays).toHaveCount(42)
    await expect(page.getByRole('link', { name: '2026-11-30, 출근 코디' }).getByText('출근 코디')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('month.png'), animations: 'disabled' })
    expect.soft(await bottomOf(monthDays.last())).toBeLessThanOrEqual(await bottomOfVisibleContent(page))
    await expectNoPageScroll(page)
  })
}
