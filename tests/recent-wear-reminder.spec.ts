import { mkdirSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from './support/fixture'

interface Preferences {
  enabled: boolean
  intervalDays: number
  combinationReminderEnabled: boolean
  itemReminderEnabled: boolean
}

const enabledPreferences: Preferences = { enabled: true, intervalDays: 7, combinationReminderEnabled: true, itemReminderEnabled: true }

/** 테스트 계정의 설정·기록 응답만 대체하며 실제 저장 여부는 공용 메모리 API에서 확인한다. */
async function installReminder(page: Page, options: {
  preferences?: Partial<Preferences>
  kind?: 'exact' | 'combination' | 'item'
  daysAgo?: number
  loadError?: boolean
} = {}) {
  const state = { preferences: { ...enabledPreferences, ...options.preferences }, queries: [] as Array<Record<string, unknown>> }
  const viewer = () => ({
    id: 'e2e-user', displayName: '리마인드 테스트', email: null, isTemporary: true,
    styleProfile: { gender: null, bodyBuild: null, heightCm: null, weightKg: null, chestCircumferenceCm: null, waistCircumferenceCm: null, hipCircumferenceCm: null, shoulderWidthCm: null, inseamCm: null, preferredFit: 'regular', preferredStyles: [] },
    wearReminderPreferences: state.preferences,
  })
  await page.route('**/graphql', async (route) => {
    const { query, variables = {} } = route.request().postDataJSON()
    let data: unknown
    if (query.includes('query Me ')) data = { me: viewer() }
    else if (query.includes('mutation UpdateWearReminderPreferences')) {
      state.preferences = variables.input
      data = { updateWearReminderPreferences: viewer() }
    } else if (query.includes('query RecentWearConflict')) {
      state.queries.push(variables.input)
      if (options.loadError) {
        await route.fulfill({ json: { errors: [{ message: '테스트 기록 조회 실패' }] } })
        return
      }
      const daysAgo = options.daysAgo ?? 1
      const wornDate = new Date(`${variables.input.targetDate}T00:00:00Z`)
      wornDate.setUTCDate(wornDate.getUTCDate() - daysAgo)
      data = { recentWearConflict: daysAgo <= variables.input.intervalDays ? {
        kind: options.kind ?? 'exact', wornDate: wornDate.toISOString().slice(0, 10),
        itemIds: options.kind === 'item' ? ['item-1'] : ['item-1', 'item-2'], outfitName: '지난 코디',
      } : null }
    } else {
      await route.fallback()
      return
    }
    await route.fulfill({ json: { data } })
  })
  return state
}

async function openSave(page: Page) {
  await page.goto('/lookbook/new?items=item-1,item-2')
  await page.getByRole('button', { name: '코디 저장하기', exact: true }).click()
  const save = page.getByRole('dialog', { name: '이 Look으로 저장할까요?', exact: true })
  await save.getByRole('textbox', { name: '코디 이름' }).fill('리마인드 확인 코디')
  await save.getByRole('button', { name: '캐주얼', exact: true }).click()
  return save
}

test('설정을 저장·다시 불러온 뒤 같은 코디 경고에서 취소·Esc·계속 저장을 구분한다', async ({ page, mockApi }) => {
  mockApi.outfits = []
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await installReminder(page, { preferences: { enabled: false } })
  await page.goto('/settings/wear-reminder')
  await page.getByRole('switch', { name: '최근 착용 리마인드 켜기', exact: true }).click()
  await page.getByLabel('최근 착용 알림 기간', { exact: true }).fill('3')
  await page.getByRole('button', { name: '리마인드 설정 저장', exact: true }).click()
  await expect(page.getByText('최근 착용 리마인드 설정을 저장했습니다.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('switch', { name: '최근 착용 리마인드 끄기', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('최근 착용 알림 기간', { exact: true })).toHaveValue('3')

  const save = await openSave(page)
  const submit = save.getByRole('button', { name: '코디북에 저장', exact: true })
  const reminder = page.getByRole('alertdialog', { name: '같은 코디를 최근에 입었어요', exact: true })
  await submit.click()
  await expect(reminder).toBeVisible()
  expect(state.queries[0]).toMatchObject({ intervalDays: 3, includeTargetDate: true, combinationReminderEnabled: true, itemReminderEnabled: true })
  expect(mockApi.outfits).toHaveLength(0)
  mkdirSync('.playwright-mcp/recent-wear-review', { recursive: true })
  await page.screenshot({ path: '.playwright-mcp/recent-wear-review/confirmation.png', animations: 'disabled' })
  await reminder.getByRole('button', { name: '계속 편집', exact: true }).click()
  await expect(reminder).toHaveCount(0)
  expect(mockApi.operations).not.toContain('CreateOutfit')
  await submit.click()
  await expect(reminder).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(reminder).toHaveCount(0)
  await expect(save).toBeVisible()
  await submit.click()
  await reminder.getByRole('button', { name: '그래도 저장', exact: true }).click()
  await expect(page).toHaveURL('/lookbook')
  expect(mockApi.outfits).toHaveLength(1)
})

for (const [kind, title] of [['combination', '최근에 입은 조합이에요'], ['item', '최근에 입은 옷이에요']] as const) {
  test(`${kind}: 해당 경고를 표시하고 확인 전에는 코디를 저장하지 않는다`, async ({ page, mockApi }) => {
    mockApi.outfits = []
    await installReminder(page, { kind })
    const save = await openSave(page)
    await save.getByRole('button', { name: '코디북에 저장', exact: true }).click()
    const reminder = page.getByRole('alertdialog', { name: title, exact: true })
    await expect(reminder).toBeVisible()
    await expect(reminder).toContainText('테스트 셔츠')
    expect(mockApi.outfits).toHaveLength(0)
    await reminder.getByRole('button', { name: '그래도 저장', exact: true }).click()
    await expect(page).toHaveURL('/lookbook')
    expect(mockApi.outfits).toHaveLength(1)
  })
}

for (const preferences of [{ enabled: false }, { combinationReminderEnabled: false, itemReminderEnabled: false }]) {
  test(`${JSON.stringify(preferences)}이면 최근 착용 조회와 경고 없이 저장한다`, async ({ page, mockApi }) => {
    mockApi.outfits = []
    const state = await installReminder(page, { preferences })
    const save = await openSave(page)
    await save.getByRole('button', { name: '코디북에 저장', exact: true }).click()
    await expect(page).toHaveURL('/lookbook')
    expect(state.queries).toHaveLength(0)
    expect(mockApi.outfits).toHaveLength(1)
  })
}

test('설정 기간보다 오래된 기록에는 경고 없이 저장한다', async ({ page, mockApi }) => {
  mockApi.outfits = []
  const state = await installReminder(page, { preferences: { intervalDays: 3 }, daysAgo: 5 })
  const save = await openSave(page)
  await save.getByRole('button', { name: '코디북에 저장', exact: true }).click()
  await expect(page).toHaveURL('/lookbook')
  expect(state.queries).toHaveLength(1)
  expect(state.queries[0]?.intervalDays).toBe(3)
  expect(mockApi.outfits).toHaveLength(1)
})

test('기록 조회 오류를 안내하면서 코디 저장은 계속할 수 있다', async ({ page, mockApi }) => {
  mockApi.outfits = []
  await installReminder(page, { loadError: true })
  const save = await openSave(page)
  await save.getByRole('button', { name: '코디북에 저장', exact: true }).click()
  await expect(page).toHaveURL('/lookbook')
  await expect(page.getByText('최근 착용 기록은 확인하지 못했지만 저장은 계속할 수 있어요.', { exact: true })).toBeVisible()
  expect(mockApi.outfits).toHaveLength(1)
})

test('주간 플래너도 확인을 취소하면 배정하지 않고 승인하면 배정한다', async ({ page, mockApi }) => {
  await installReminder(page)
  await page.goto('/plan?view=week')
  await page.getByRole('button', { name: '일주일 코디 설정', exact: true }).click()
  const editor = page.getByRole('dialog', { name: '주간 코디 편집', exact: true })
  await editor.getByRole('button', { name: /기본 코디/ }).click()
  const reminder = page.getByRole('alertdialog', { name: '같은 코디를 최근에 입었어요', exact: true })
  await expect(reminder).toBeVisible()
  await reminder.getByRole('button', { name: '다른 코디 고르기', exact: true }).click()
  expect(mockApi.operations).not.toContain('SetPlannerEntry')
  await editor.getByRole('button', { name: /기본 코디/ }).click()
  await reminder.getByRole('button', { name: '그래도 추가', exact: true }).click()
  await expect.poll(() => mockApi.plannerEntries.length).toBe(1)
  expect(mockApi.operations).toContain('SetPlannerEntry')
})

test('하루 코디북 배정도 선택한 날짜의 최근 착용 확인을 거친다', async ({ page, mockApi }) => {
  const date = '2026-11-04'
  const state = await installReminder(page)
  await page.goto(`/plan?view=today&date=${date}`)
  await page.getByRole('button', { name: '코디북에서 고르기', exact: true }).click()
  const picker = page.getByRole('dialog', { name: '하루 코디 선택' })
  const outfit = picker.getByRole('button', { name: /기본 코디/ })
  await outfit.click()
  const reminder = page.getByRole('alertdialog', { name: '같은 코디를 최근에 입었어요', exact: true })
  await expect(reminder).toBeVisible()
  expect(state.queries[0]).toMatchObject({ targetDate: date, includeTargetDate: false })
  await reminder.getByRole('button', { name: '다른 코디 고르기', exact: true }).click()
  await expect(picker).toBeVisible()
  expect(mockApi.operations).not.toContain('SetPlannerEntry')
  await outfit.click()
  await reminder.getByRole('button', { name: '그래도 추가', exact: true }).click()
  await expect(picker).toHaveCount(0)
  expect(mockApi.plannerEntries.map((entry) => entry.date)).toEqual([date])
})
