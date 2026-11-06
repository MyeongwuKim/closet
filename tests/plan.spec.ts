import { test, expect, createOutfit } from './support/fixture'

test('주간 날짜 상세에서 뒤로 가면 열었던 주를 유지한다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'))
  const date = '2026-10-28'
  const outfit = createOutfit({ name: '지난주 수요일 코디' })
  mockApi.plannerEntries = [{
    date,
    title: outfit.name,
    occasion: null,
    weatherSummary: null,
    temperatureC: null,
    outfit: { ...outfit, plannerOnly: true },
  }]
  await page.goto('/plan?view=week')
  await page.getByRole('button', { name: '이전 주' }).click()
  const previousWednesday = page.locator(`[data-plan-date="${date}"]`).getByRole('link')
  await expect(previousWednesday.getByTitle('테스트 셔츠', { exact: true })).toBeVisible()
  await previousWednesday.click()
  const detail = page.getByRole('dialog', { name: `${outfit.name} 상세` })
  await detail.getByRole('button', { name: '플래너로 돌아가기' }).click()
  await expect(page.getByRole('radio', { name: '주간' })).toHaveAttribute('aria-checked', 'true')
  await expect(previousWednesday).toBeVisible()
})

test('월간 보기에서 같은 주로 돌아와도 저장한 코디가 주간에 표시된다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'))
  const date = '2026-11-04'
  const outfit = createOutfit({ name: '수요일 코디' })
  mockApi.plannerEntries = [{
    date,
    title: outfit.name,
    occasion: null,
    weatherSummary: null,
    temperatureC: null,
    outfit: { ...outfit, plannerOnly: true },
  }]

  await page.goto('/plan?view=week')
  const viewToggle = page.getByRole('radiogroup', { name: '플래너 보기 방식' })
  const wednesdayRow = page.locator(`[data-plan-date="${date}"]`)
  await expect(wednesdayRow.getByTitle('테스트 셔츠', { exact: true })).toBeVisible()

  await viewToggle.getByRole('radio', { name: '월간' }).click()
  await expect(page.getByRole('link', { name: `${date}, ${outfit.name}` })).toBeVisible()
  await viewToggle.getByRole('radio', { name: '주간' }).click()
  await expect(wednesdayRow.getByTitle('테스트 셔츠', { exact: true })).toBeVisible()
})

test('주간 플래너에 코디를 배치하고 비운 상태가 새로고침 후에도 유지된다', async ({ page, mockApi }) => {
  mockApi.outfits = [createOutfit({ id: '507f1f77bcf86cd799439011', name: '주간 테스트 코디' })]

  await page.goto('/plan?view=week')
  await expect(page.getByRole('radiogroup', { name: '플래너 보기 방식' }).getByRole('radio', { name: '주간' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: '일주일 코디 설정' }).click()

  let editor = page.getByRole('dialog', { name: '주간 코디 편집' })
  await expect(editor).toBeVisible()
  let firstDay = editor.getByLabel('설정할 요일').getByRole('button').first()
  await expect(firstDay).toHaveAttribute('aria-label', /저장된 코디 없음/)
  await editor.getByRole('button', { name: /주간 테스트 코디/ }).click()
  await expect(firstDay).toHaveAttribute('aria-label', /주간 테스트 코디, 설정됨/)
  expect(mockApi.operations).toContain('SetPlannerEntry')

  await editor.getByRole('button', { name: '주간 옷 설정 닫기' }).click()
  await page.reload()
  await page.getByRole('button', { name: '일주일 코디 설정' }).click()

  editor = page.getByRole('dialog', { name: '주간 코디 편집' })
  firstDay = editor.getByLabel('설정할 요일').getByRole('button').first()
  await expect(firstDay).toHaveAttribute('aria-label', /주간 테스트 코디, 설정됨/)

  await editor.getByRole('button', { name: '비우기' }).click()
  await expect(firstDay).toHaveAttribute('aria-label', /저장된 코디 없음/)
  expect(mockApi.operations).toContain('ClearPlannerEntry')

  await editor.getByRole('button', { name: '주간 옷 설정 닫기' }).click()
  await page.reload()
  await page.getByRole('button', { name: '일주일 코디 설정' }).click()
  await expect(page.getByRole('dialog', { name: '주간 코디 편집' }).getByLabel('설정할 요일').getByRole('button').first())
    .toHaveAttribute('aria-label', /저장된 코디 없음/)
})

test('주간 편집에서는 착용 완료 날짜를 옮기거나 빠르게 비울 수 없다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'))
  const date = '2026-11-02'
  const outfit = createOutfit({ id: '507f1f77bcf86cd799439012', name: '월요일에 입은 코디' })
  const wornEntry = {
    date, title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null,
    wornAt: `${date}T10:00:00Z`, wearFeeling: 'cold' as const, wearTemperatureC: 12,
    outfit: { ...outfit, plannerOnly: true },
  }
  mockApi.plannerEntries = [wornEntry]

  await page.goto('/plan?view=week')
  await expect(page.getByRole('button', { name: '월요일은 착용 완료하여 옮길 수 없습니다' })).toBeDisabled()
  await expect(page.getByText('착용 완료 날짜를 포함한 범위는 옮길 수 없어요.')).toBeVisible()
  await page.getByRole('button', { name: '일주일 코디 설정' }).click()
  const editor = page.getByRole('dialog', { name: '주간 코디 편집' })
  await expect(editor.getByText('코디를 바꾸거나 비우려면 날짜 상세에서 먼저 착용을 취소해 주세요.')).toBeVisible()
  await expect(editor.getByRole('button', { name: '비우기', exact: true })).toHaveCount(0)
  expect(mockApi.operations).not.toContain('ClearPlannerEntry')
  expect(mockApi.operations).not.toContain('MovePlannerEntry')
  expect(mockApi.plannerEntries).toEqual([wornEntry])
})
