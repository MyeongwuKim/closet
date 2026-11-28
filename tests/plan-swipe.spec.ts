import type { CDPSession } from '@playwright/test'
import { createOutfit, expect, test } from './support/fixture'

test.use({ hasTouch: true, timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })

async function swipe(
  session: CDPSession,
  start: { x: number; y: number },
  delta: { x: number; y: number },
) {
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
  for (const progress of [0.25, 0.5, 0.75, 1]) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: start.x + delta.x * progress, y: start.y + delta.y * progress }],
    })
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test('스와이프와 현재 기간 버튼으로 일간·주간·월간을 이동한다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 660 })
  await page.clock.setFixedTime(new Date('2026-09-02T12:00:00+09:00'))
  const outfit = createOutfit({ name: '월요일 코디' })
  mockApi.plannerEntries = [{
    date: '2026-08-31',
    title: outfit.name,
    occasion: null,
    weatherSummary: null,
    temperatureC: null,
    outfit: { ...outfit, plannerOnly: true },
  }]

  await page.goto('/plan?view=today&date=2026-08-01')
  await expect(page.getByRole('radio', { name: '일간' })).toBeChecked()
  const session = await page.context().newCDPSession(page)
  const header = page.locator('.plan-period-header')
  const title = header.getByRole('heading', { level: 2 })
  const body = page.locator('[data-plan-period-body]')
  const left = async () => {
    const bounds = await body.boundingBox()
    if (!bounds) throw new Error('플래너 본문을 찾지 못했어요.')
    await swipe(session, { x: 245, y: bounds.y + 44 }, { x: -145, y: 3 })
  }
  const right = async () => {
    const bounds = await body.boundingBox()
    if (!bounds) throw new Error('플래너 본문을 찾지 못했어요.')
    await swipe(session, { x: 75, y: bounds.y + 44 }, { x: 145, y: 3 })
  }

  await left()
  await expect(title).toHaveText('08.02')
  await right()
  await expect(title).toHaveText('08.01')
  await header.getByRole('button', { name: '오늘' }).tap()
  await expect(title).toHaveText('오늘')
  await expect(header.getByRole('button', { name: '오늘' })).toBeDisabled()

  await page.getByRole('radio', { name: '주간' }).tap()
  await expect(title).toHaveText('08.31—09.06')
  const dragHandle = page.getByRole('button', { name: '월요일 코디 위치 옮기기' })
  await expect(dragHandle).toBeEnabled()
  const handle = await dragHandle.boundingBox()
  if (!handle) throw new Error('주간 편집 핸들을 찾지 못했어요.')
  await swipe(session, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { x: -144, y: 2 })
  await expect(title).toHaveText('08.31—09.06')

  await right()
  await expect(title).toHaveText('08.24—08.30')
  await left()
  await expect(title).toHaveText('08.31—09.06')
  await left()
  await expect(title).toHaveText('09.07—09.13')
  const currentWeek = header.getByRole('button', { name: '이번 주' })
  const titleRight = await title.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getBoundingClientRect().right
  })
  expect(titleRight + 6).toBeLessThan(await currentWeek.evaluate((element) => element.getBoundingClientRect().left))
  await page.screenshot({ path: testInfo.outputPath('week-navigation.png') })
  await currentWeek.tap()
  await expect(title).toHaveText('08.31—09.06')
  await expect(currentWeek).toBeDisabled()

  await page.getByRole('radio', { name: '월간' }).tap()
  await expect(title).toHaveText('8월')
  const currentMonth = header.getByRole('button', { name: '이번 달' })
  await currentMonth.tap()
  await expect(title).toHaveText('9월')
  await expect(page.locator('.plan-month-calendar-day').first()).toBeVisible()
  await left()
  await expect(title).toHaveText('10월')
  await expect(page.locator('.plan-month-calendar-day').first()).toBeVisible()
  await right()
  await expect(title).toHaveText('9월')
  await expect(page.locator('.plan-month-calendar-day').first()).toBeVisible()
  await right()
  await expect(title).toHaveText('8월')
  await currentMonth.tap()
  await expect(title).toHaveText('9월')
  await expect(currentMonth).toBeDisabled()

  await page.setViewportSize({ width: 320, height: 550 })
  const bounds = await body.boundingBox()
  if (!bounds) throw new Error('월간 플래너를 찾지 못했어요.')
  await swipe(session, { x: 150, y: bounds.y + 180 }, { x: 18, y: -105 })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(title).toHaveText('9월')
  await page.getByRole('link', { name: '2026-09-02, 저장된 코디 없음', exact: true }).tap()
  await expect(page.getByRole('button', { name: '플래너로 돌아가기' })).toBeVisible()
})
