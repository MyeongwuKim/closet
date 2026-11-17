import { expect, test } from './support/fixture'
import type { Page } from '@playwright/test'

test.use({ seedMockSession: false })

async function openAccount(page: Page) {
  await page.goto('/login')
  await page.evaluate(() => localStorage.setItem('closet-test-access-token', 'account-deletion-fixture'))
  await page.goto('/settings/account')
  await expect(page.getByText('closet_test', { exact: true })).toBeVisible()
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 탈퇴 확인을 취소하면 유지하고 최종 확인하면 로그인으로 돌아간다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    await openAccount(page)
    const trigger = page.getByRole('button', { name: '회원탈퇴', exact: true })
    await trigger.click()
    const dialog = page.getByRole('alertdialog', { name: '회원탈퇴할까요?', exact: true })
    await expect(dialog.getByText(/복구할 수 없어요/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: '확인창 닫기', exact: true })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: '탈퇴하기', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(mockApi.operations).not.toContain('DeleteMyAccount')
    await trigger.click()
    await page.screenshot({ path: testInfo.outputPath(`account-delete-${viewport.width}.png`), animations: 'disabled' })
    await dialog.getByRole('button', { name: '탈퇴하기', exact: true }).click()
    await expect(page).toHaveURL('/login')
    expect(await page.evaluate(() => localStorage.getItem('closet-test-access-token'))).toBeNull()
    expect(mockApi.operations.filter(operation => operation === 'DeleteMyAccount')).toHaveLength(1)
    expect(mockApi.wardrobeItems).toHaveLength(0)
    await page.reload()
    await expect(page).toHaveURL('/login')
  })
}

test('탈퇴 저장 오류는 계정과 로그인 상태를 유지하고 다시 시도할 수 있다', async ({ page, mockApi }) => {
  let fail = true
  await page.route('**/graphql', async route => {
    if (fail && route.request().postDataJSON().query.includes('mutation DeleteMyAccount')) {
      await route.fulfill({ json: { data: null, errors: [{ message: '회원탈퇴를 완료하지 못했어요. 다시 시도해주세요.', extensions: { code: 'ACCOUNT_DELETION_FAILED' } }] } })
    } else await route.fallback()
  })
  await openAccount(page)
  const originalItems = structuredClone(mockApi.wardrobeItems)
  await page.getByRole('button', { name: '회원탈퇴', exact: true }).click()
  const confirm = page.getByRole('alertdialog').getByRole('button', { name: '탈퇴하기', exact: true })
  await confirm.click()
  await expect(page.getByText('회원탈퇴를 완료하지 못했어요. 다시 시도해주세요.', { exact: true })).toBeVisible()
  await expect(page).toHaveURL('/settings/account')
  expect(await page.evaluate(() => localStorage.getItem('closet-test-access-token'))).toBeTruthy()
  expect(mockApi.wardrobeItems).toEqual(originalItems)
  fail = false
  await confirm.click()
  await expect(page).toHaveURL('/login')
})

test('탈퇴 처리 중에는 중복 요청·Escape·키보드 이탈을 막는다', async ({ page, mockApi }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let requests = 0
  await page.route('**/graphql', async route => {
    if (route.request().postDataJSON().query.includes('mutation DeleteMyAccount')) { requests += 1; await gate }
    await route.fallback()
  })
  await openAccount(page)
  await page.getByRole('button', { name: '회원탈퇴', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  try {
    await dialog.getByRole('button', { name: '탈퇴하기', exact: true }).click()
    await expect(dialog.getByRole('button', { name: '탈퇴 처리 중…', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(dialog).toBeFocused()
    expect(requests).toBe(1)
    expect(mockApi.wardrobeItems.length).toBeGreaterThan(0)
  } finally { release() }
  await expect(page).toHaveURL('/login')
})

test('200% 글자에서도 탈퇴 안내와 버튼이 잘리지 않는다', async ({ page, mockApi }, testInfo) => {
  void mockApi
  await page.setViewportSize({ width: 390, height: 844 })
  await openAccount(page)
  await page.addStyleTag({ content: ':root { font-size: 200%; }' })
  await page.getByRole('button', { name: '회원탈퇴', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await dialog.getByRole('heading').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(dialog.getByRole('button', { name: '탈퇴하기', exact: true })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('account-delete-large-text.png'), animations: 'disabled' })
})
