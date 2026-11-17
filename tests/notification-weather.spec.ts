import { test, expect } from './support/fixture'
import type { Page } from '@playwright/test'

/** 기기 설정·권한 요청을 메모리 호출 기록으로 대체해 실제 OS나 알림 수신 설정을 바꾸지 않는다. */
async function mockNativePermissions(page: Page, status: 'granted' | 'undetermined' | 'denied') {
  await page.addInitScript((initialStatus) => {
    if (!localStorage.getItem('closet:notification-weather-preferences:v1')) {
      localStorage.setItem('closet:notification-weather-preferences:v1', JSON.stringify({ locationWeather: false, locationWeatherDisabled: true }))
    }
    const permissions = {
      notifications: initialStatus,
      location: initialStatus,
      photos: 'granted',
      camera: 'granted',
    }
    const calls: string[] = []
    Object.assign(window, { notificationWeatherCalls: calls, notificationWeatherPermissions: permissions })
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ permissions, capabilities: [] }),
      getCurrentLocation: async () => ({ status: 'services-disabled' }),
      openAppSettings: async () => { calls.push('settings') },
      requestPermission: async (permission: 'notifications' | 'location') => {
        calls.push(`permission:${permission}`)
        permissions[permission] = 'granted'
        return 'granted'
      },
    } as unknown as NonNullable<Window['ClosetNative']>
  }, status)
}

test('작업 완료 알림을 별도로 저장·복원하고 주간 알림 선택은 유지한다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockNativePermissions(page, 'granted')
  await page.goto('/#/settings/notifications')
  const completion = page.getByRole('switch', { name: '작업 완료 알림', exact: true })
  const rediscovery = page.getByRole('switch', { name: '잊고 있던 옷 알림', exact: true })
  await expect(completion).toBeChecked()
  await completion.click()
  await expect(completion).not.toBeChecked()
  expect(mockApi.completionPushEnabled).toBe(false)
  await expect(rediscovery).not.toBeChecked()
  await page.reload()
  await expect(completion).not.toBeChecked()
  await page.screenshot({ path: testInfo.outputPath('completion-off.png'), animations: 'disabled' })
  await completion.click()
  await expect(completion).toBeChecked()
  expect(mockApi.rediscoveryPushEnabled).toBe(false)
})

test('기기 권한이 없으면 수신 선택을 유지한 채 비활성화하고 허용 후 변경할 수 있다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockNativePermissions(page, 'denied')
  await page.goto('/#/settings/notifications')
  const completion = page.getByRole('switch', { name: '작업 완료 알림', exact: true })
  const rediscovery = page.getByRole('switch', { name: '잊고 있던 옷 알림', exact: true })
  const notice = page.getByText('알림 권한을 허용해야 받을 수 있어요.', { exact: true })
  await expect(completion).toBeDisabled()
  await expect(completion).toBeChecked()
  await expect(rediscovery).toBeDisabled()
  await expect(rediscovery).not.toBeChecked()
  await expect(notice).toHaveCount(1)
  await expect(notice).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('completion-permission-denied.png'), animations: 'disabled' })
  expect(mockApi.operations).not.toContain('SetCompletionPushEnabled')
  expect(mockApi.operations).not.toContain('SetWardrobeRediscoveryPushEnabled')
  expect(mockApi.completionPushEnabled).toBe(true)
  const permission = page.getByRole('button', { name: '알림 권한 기기 설정에서 변경', exact: true })
  await permission.focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('summary').filter({ hasText: '알림 안내' })).toBeFocused()
  await page.evaluate(() => {
    const state = window as unknown as Window & { notificationWeatherPermissions: { notifications: string } }
    state.notificationWeatherPermissions.notifications = 'granted'
    window.dispatchEvent(new Event('closet:native-app-active'))
  })
  await expect(completion).toBeEnabled()
  await expect(rediscovery).toBeEnabled()
  await expect(completion).toBeChecked()
  await expect(rediscovery).not.toBeChecked()
  await expect(notice).toHaveCount(0)
  await completion.click()
  await expect(completion).not.toBeChecked()
  expect(mockApi.completionPushEnabled).toBe(false)
})

async function permissionCalls(page: Page) {
  return page.evaluate(() => (
    window as unknown as Window & { notificationWeatherCalls: string[] }
  ).notificationWeatherCalls)
}

test('기기 권한은 이동 행으로 열고 수신 설정만 스위치로 변경한다', async ({ page, mockApi }) => {
  await mockNativePermissions(page, 'granted')
  await page.goto('/#/settings/notifications')

  const completion = page.getByRole('button', { name: '알림 권한 기기 설정에서 변경', exact: true })
  await expect(completion).toBeEnabled()
  await expect(completion).toHaveAccessibleDescription('허용됨')
  await completion.click()
  expect(await permissionCalls(page)).toEqual(['settings'])
  await expect(page.getByText('위치 기반 날씨', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('closet:notification-weather-preferences:v1')!))).toEqual({ locationWeather: false, locationWeatherDisabled: true })
  await expect(page.getByRole('switch')).toHaveCount(2)
  expect(mockApi.operations).not.toContain('SetWardrobeRediscoveryPushEnabled')

  const rediscovery = page.getByRole('switch', { name: '잊고 있던 옷 알림', exact: true })
  const permissionBounds = await completion.boundingBox()
  const rediscoveryBounds = await rediscovery.boundingBox()
  expect(permissionBounds!.y).toBeLessThan(rediscoveryBounds!.y)
  await rediscovery.click()
  await expect(rediscovery).toBeChecked()
  expect(mockApi.rediscoveryPushEnabled).toBe(true)
  await page.reload()
  await expect(rediscovery).toBeChecked()
})

test('권한 요청 전에는 해당 행에서 요청하고 새 권한 상태를 표시한다', async ({ page, mockApi }) => {
  void mockApi
  await mockNativePermissions(page, 'undetermined')
  await page.goto('/#/settings/notifications')
  await page.getByRole('button', { name: '알림 권한 알림 권한 허용하기', exact: true }).click()
  await expect(page.getByRole('button', { name: '알림 권한 기기 설정에서 변경', exact: true })).toContainText('허용됨')
  expect(await permissionCalls(page)).toEqual(['permission:notifications'])
  await page.goto('/#/settings/weather-location')
  await page.getByRole('button', { name: '위치 기반 날씨 위치 권한 허용하기', exact: true }).click()
  await expect(page.getByRole('button', { name: '위치 기반 날씨 기기 설정에서 변경', exact: true })).toContainText('허용됨')
  expect(await permissionCalls(page)).toEqual(['permission:notifications', 'permission:location'])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('closet:notification-weather-preferences:v1')!))).toEqual({ locationWeather: true, locationWeatherDisabled: false })
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px에서 접힌 도움 영역과 Tab 순환·Escape 복귀를 유지한다`, async ({ page, mockApi }, testInfo) => {
    void mockApi
    await page.setViewportSize(viewport)
    await mockNativePermissions(page, 'granted')
    await page.goto('/#/settings')
    await expect(page.getByRole('link', { name: '날씨 및 위치', exact: true })).toBeVisible()
    await page.getByRole('link', { name: '알림', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '알림', exact: true })
    const back = page.getByRole('link', { name: '알림 닫기', exact: true })
    const help = dialog.locator('summary').filter({ hasText: '알림 안내' })
    const testPush = page.getByRole('button', { name: '테스트 알림 보내기', exact: true })
    await expect(dialog).toBeFocused()
    await expect(page.getByRole('switch', { name: '작업 완료 알림', exact: true })).toBeEnabled()
    for (const description of ['AI 작업 완료·실패', '착용 기록 없는 옷 · 주 1회']) {
      const dimensions = await page.getByText(description, { exact: true }).evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        lineHeight: parseFloat(getComputedStyle(element).lineHeight),
      }))
      expect(dimensions.height).toBeLessThanOrEqual(dimensions.lineHeight + 1)
    }
    await page.screenshot({ path: testInfo.outputPath(`notifications-granted-${viewport.width}.png`), animations: 'disabled' })
    if (viewport.width === 390) {
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath('notifications-200-percent.png'), animations: 'disabled' })
      await page.evaluate(() => { document.documentElement.style.fontSize = '' })
    }
    await page.keyboard.press('Tab')
    await expect(back).toBeFocused()
    await expect(testPush).toBeHidden()
    await page.keyboard.press('Shift+Tab')
    await expect(help).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(back).toBeFocused()
    await help.click()
    await expect(testPush).toBeVisible()
    const settings = page.getByRole('button', { name: '기기 설정 열기', exact: true })
    await settings.focus()
    await page.keyboard.press('Tab')
    await expect(back).toBeFocused()

    for (const control of [back, page.getByRole('button', { name: '권한 상태 다시 확인' }), page.getByRole('switch', { name: '잊고 있던 옷 알림', exact: true })]) {
      const bounds = await control.boundingBox()
      expect(bounds?.height).toBeGreaterThanOrEqual(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('link', { name: '알림', exact: true })).toBeFocused()
  })

  test(`${viewport.width}px에서 날씨 설정을 별도로 열고 키보드로 설정 메뉴에 복귀한다`, async ({ page, mockApi }) => {
    void mockApi
    await page.setViewportSize(viewport)
    await mockNativePermissions(page, 'granted')
    await page.goto('/#/settings')
    await page.getByRole('link', { name: '날씨 및 위치', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '날씨 및 위치', exact: true })
    await expect(dialog).toBeFocused()
    await expect(page.getByRole('switch', { name: '잊고 있던 옷 알림' })).toHaveCount(0)
    await page.keyboard.press('Tab')
    const back = page.getByRole('link', { name: '날씨 및 위치 닫기' })
    await expect(back).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('button', { name: '위치 기반 날씨 기기 설정에서 변경', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(back).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('link', { name: '날씨 및 위치', exact: true })).toBeFocused()
  })
}

for (const native of [false, true]) {
  test(`이전 통합 주소는 ${native ? '앱' : '웹'}에서 알림 설정으로 연결한다`, async ({ page, mockApi }) => {
    void mockApi
    if (native) await mockNativePermissions(page, 'granted')
    await page.goto(native ? '/#/settings/notifications-weather' : '/settings/notifications-weather')
    await expect(page).toHaveURL(/\/settings\/notifications$/)
    await expect(page.getByRole('dialog', { name: '알림', exact: true })).toBeVisible()
    await expect(page.getByText('위치 기반 날씨', { exact: true })).toHaveCount(0)
  })
}

test('웹 날씨 사용 선택은 기존 저장 키로 저장하고 새로고침 후에도 유지한다', async ({ page, context, mockApi }) => {
  void mockApi
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 37.5665, longitude: 126.978 })
  await page.goto('/settings')
  await page.evaluate(() => localStorage.setItem('closet:notification-weather-preferences:v1', JSON.stringify({ locationWeather: false, locationWeatherDisabled: true })))
  await page.getByRole('link', { name: '날씨 및 위치', exact: true }).click()
  const toggle = page.getByRole('switch', { name: '위치 기반 날씨', exact: true })
  await expect(toggle).toBeEnabled()
  await expect(toggle).not.toBeChecked()
  await toggle.click()
  await expect(toggle).toBeChecked()
  await page.reload()
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('closet:notification-weather-preferences:v1')!))).toEqual({ locationWeather: false, locationWeatherDisabled: true })
})

test('옷장에서 알림 수신을 설정한 뒤 보던 옷과 진입 링크로 복귀한다', async ({ page, mockApi }) => {
  await mockNativePermissions(page, 'granted')
  mockApi.rediscoveryItems = mockApi.wardrobeItems.map((item) => ({ item, reason: 'no_wear_record', daysSinceLastWorn: null }))
  await page.goto('/#/closet/rediscovery')
  const carouselStatus = page.getByRole('dialog', { name: '잊고 있던 옷', exact: true }).getByRole('status')
  await page.getByRole('button', { name: '다음 옷', exact: true }).click()
  await expect(carouselStatus).toHaveText('2 / 2')
  await page.getByRole('link', { name: '잊고 있던 옷 알림 설정', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '알림', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/from=rediscovery&item=/)
  const toggle = page.getByRole('switch', { name: '잊고 있던 옷 알림', exact: true })
  await toggle.click()
  await expect(toggle).toBeChecked()
  await page.getByRole('link', { name: '잊고 있던 옷으로 돌아가기' }).click()
  await expect(carouselStatus).toHaveText('2 / 2')
  const entry = page.getByRole('link', { name: '잊고 있던 옷 알림 설정', exact: true })
  await expect(entry).toBeFocused()
  await entry.click()
  await expect(toggle).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '잊고 있던 옷', exact: true })).toBeVisible()
  await expect(carouselStatus).toHaveText('2 / 2')
})
