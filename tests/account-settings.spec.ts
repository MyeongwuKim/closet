import { test, expect } from './support/fixture'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

function viewer(id: string, heightCm: number, thighCircumferenceCm: number | null = null) {
  return {
    id, displayName: id, email: null, isTemporary: true,
    styleProfile: {
      gender: 'male', bodyBuild: 'average', heightCm, weightKg: 65,
      chestCircumferenceCm: null, waistCircumferenceCm: null, hipCircumferenceCm: null, thighCircumferenceCm,
      shoulderWidthCm: null, inseamCm: null, preferredFit: 'regular', preferredStyles: [],
    },
    wearReminderPreferences: { enabled: false, intervalDays: 7, combinationReminderEnabled: true, itemReminderEnabled: true },
  }
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`허벅지둘레를 저장·새로고침·삭제하고 ${viewport.width}px 화면에서 표시한다`, async ({ page, mockApi }) => {
    void mockApi
    await page.setViewportSize(viewport)
    let currentViewer = viewer('허벅지 치수 테스트', 176)
    const savedInputs: Array<{ thighCircumferenceCm: number | null }> = []
    await page.route('**/graphql', async (route) => {
      const { query, variables = {} } = route.request().postDataJSON()
      let data: unknown
      if (query.includes('query Me ')) {
        expect(query).toContain('thighCircumferenceCm')
        data = { me: currentViewer }
      } else if (query.includes('mutation UpdateMyStyleProfile')) {
        savedInputs.push(variables.input)
        currentViewer = { ...currentViewer, styleProfile: { ...currentViewer.styleProfile, ...variables.input } }
        data = { updateMyStyleProfile: currentViewer }
      } else {
        await route.fallback()
        return
      }
      await route.fulfill({ json: { data } })
    })

    await page.goto('/settings/style-profile')
    const thigh = page.getByLabel('허벅지둘레', { exact: false })
    const save = page.getByRole('button', { name: '프로필 저장', exact: true })
    await expect(thigh).toHaveAttribute('min', '20')
    await expect(thigh).toHaveAttribute('max', '150')
    await thigh.fill('19')
    expect(await thigh.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true)
    await save.click()
    expect(savedInputs).toHaveLength(0)

    await thigh.fill('70')
    await save.click()
    await expect.poll(() => savedInputs.length).toBe(1)
    expect(savedInputs[0]?.thighCircumferenceCm).toBe(70)
    await expect(page.getByText('스타일 프로필을 저장했습니다.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(thigh).toHaveValue('70')
    await thigh.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const box = await thigh.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    const proofDirectory = resolve('.playwright-mcp/thigh-profile-review')
    await mkdir(proofDirectory, { recursive: true })
    await page.screenshot({ path: resolve(proofDirectory, `style-profile-${viewport.width}.png`) })

    await thigh.fill('')
    await save.click()
    await expect.poll(() => savedInputs.length).toBe(2)
    expect(savedInputs[1]?.thighCircumferenceCm).toBeNull()
    await page.reload()
    await expect(thigh).toHaveValue('')
  })
}

test.describe('로그인 화면', () => {
  test.use({ seedMockSession: false })

  test('로그인 ID는 영문·숫자·점·밑줄·하이픈만 허용하며 브라우저 오류를 내지 않는다', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/login')
    const loginId = page.getByLabel('테스트 ID', { exact: true })
    for (const value of ['closet_test', 'closet.test-01', 'USER123']) {
      await loginId.fill(value)
      expect(await loginId.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(true)
    }
    for (const value of ['한글아이디', 'has space', 'slash/name']) {
      await loginId.fill(value)
      expect(await loginId.evaluate((input: HTMLInputElement) => input.validity.patternMismatch)).toBe(true)
      expect(await loginId.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false)
    }
  })
})

test('프로필 저장 중 다른 계정으로 로그인해도 늦은 응답이 새 계정과 로컬 프로필을 덮지 않는다', async ({ page, mockApi }) => {
  void mockApi
  const accountA = viewer('계정 A', 175)
  const accountB = viewer('계정 B', 162)
  let currentViewer = accountA
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let saving = false
  await page.route('**/graphql', async (route) => {
    const { query, variables = {} } = route.request().postDataJSON()
    let data: unknown
    if (query.includes('query Me ')) data = { me: currentViewer }
    else if (query.includes('mutation UpdateMyStyleProfile')) {
      saving = true
      await gate
      data = { updateMyStyleProfile: { ...accountA, styleProfile: variables.input } }
    } else if (query.includes('mutation Logout')) data = { logout: true }
    else if (query.includes('mutation TestLogin')) {
      currentViewer = accountB
      data = { testLogin: { accessToken: 'e2e-account-B-session', viewer: accountB } }
    } else { await route.fallback(); return }
    await route.fulfill({ json: { data } })
  })
  try {
    await page.goto('/settings/style-profile')
    await page.getByLabel('키', { exact: false }).fill('185')
    await page.getByRole('button', { name: '프로필 저장', exact: true }).click()
    await expect.poll(() => saving).toBe(true)
    await page.getByRole('link', { name: '스타일 프로필 닫기' }).click()
    await page.getByRole('button', { name: /로그아웃/ }).click()
    await expect(page.getByRole('button', { name: '테스트 로그인' })).toBeVisible()
    await page.getByLabel('테스트 ID', { exact: true }).fill('account_b')
    await page.getByLabel('비밀번호', { exact: true }).fill('fake-password')
    await page.getByRole('button', { name: '테스트 로그인' }).click()
    await expect(page).toHaveURL('/plan')
    const response = page.waitForResponse((response) => response.request().postData()?.includes('mutation UpdateMyStyleProfile') ?? false)
    release()
    await response
    await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '설정', exact: true }).click()
    await expect(page.getByText('계정 B', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: /스타일 프로필/ }).click()
    await expect(page.getByLabel('키', { exact: false })).toHaveValue('162')
    await expect(page.getByText('스타일 프로필을 저장했습니다.', { exact: true })).toHaveCount(0)
  } finally { release() }
})
