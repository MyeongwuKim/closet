import { test, expect } from './support/fixture'

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px에서 계정 메뉴로 로그인 정보를 열고 키보드로 복귀한다`, async ({ page, mockApi }, testInfo) => {
    void mockApi
    await page.setViewportSize(viewport)
    await page.goto('/settings')
    const entry = page.getByRole('link', { name: '계정 관리', exact: true })
    await expect(entry).toBeVisible()
    await expect(page.getByRole('button', { name: /로그아웃/ })).toHaveCount(0)
    if (viewport.width === 390) {
      const entryBox = await entry.boundingBox()
      const tabsBox = await page.getByRole('navigation', { name: '주요 메뉴' }).boundingBox()
      expect(entryBox!.y + entryBox!.height).toBeLessThanOrEqual(tabsBox!.y)
    }
    await page.screenshot({ path: testInfo.outputPath(`settings-${viewport.width}.png`), animations: 'disabled' })
    await entry.click()
    const dialog = page.getByRole('dialog', { name: '계정 관리', exact: true })
    await expect(dialog).toBeFocused()
    await expect(page.getByText('closet_test', { exact: true })).toBeVisible()
    await expect(page.getByText('테스트 사용자', { exact: true })).toBeVisible()
    if (viewport.width === 390) await expect(page.getByRole('navigation', { name: '주요 메뉴' })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`account-${viewport.width}.png`), animations: 'disabled' })
    const back = page.getByRole('link', { name: '계정 관리 닫기', exact: true })
    await page.keyboard.press('Tab')
    await expect(back).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('button', { name: '회원탈퇴', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(entry).toBeFocused()
  })
}

test('낮은 모바일 화면에서도 마지막 메뉴를 하단 탭 위로 스크롤할 수 있다', async ({ page, mockApi }, testInfo) => {
  void mockApi
  await page.setViewportSize({ width: 390, height: 667 })
  await page.goto('/settings')
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const entry = await page.getByRole('link', { name: '계정 관리', exact: true }).boundingBox()
  const tabs = await page.getByRole('navigation', { name: '주요 메뉴' }).boundingBox()
  expect(entry!.y + entry!.height).toBeLessThanOrEqual(tabs!.y)
  await page.screenshot({ path: testInfo.outputPath('settings-short-screen.png'), animations: 'disabled' })
})

test('긴 이메일과 이름은 글자 확대에서도 잘리지 않고 표시된다', async ({ page, mockApi }, testInfo) => {
  void mockApi
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/graphql', async (route) => {
    if (route.request().postDataJSON().query.includes('query MyAccount ')) {
      await route.fulfill({ json: { data: { myAccount: {
        displayName: '아주 긴 이름을 사용하는 계정의 사용자',
        email: 'long.account.name.for.layout@example.com', loginId: null,
      } } } })
    } else await route.fallback()
  })
  await page.goto('/settings/account')
  await expect(page.getByText('long.account.name.for.layout@example.com', { exact: true })).toBeVisible()
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const value of await page.locator('.settings-account-info dd').all()) {
    expect(await value.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath('account-large-text.png'), animations: 'disabled' })
})

test('계정 조회 오류는 다시 시도할 수 있고 로그아웃하면 로그인으로 돌아간다', async ({ page, mockApi }) => {
  void mockApi
  let fail = true
  await page.route('**/graphql', async (route) => {
    if (fail && route.request().postDataJSON().query.includes('query MyAccount ')) {
      await route.fulfill({ json: { errors: [{ message: '계정 정보를 불러오지 못했어요.', extensions: { code: 'ACCOUNT_INFO_LOAD_FAILED' } }] } })
    } else await route.fallback()
  })
  await page.goto('/settings/account')
  await expect(page.getByRole('alert')).toHaveText('계정 정보를 불러오지 못했어요.')
  fail = false
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByText('closet_test', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page).toHaveURL('/login')
  expect(await page.evaluate(() => localStorage.getItem('closet-test-access-token'))).toBeNull()
})
