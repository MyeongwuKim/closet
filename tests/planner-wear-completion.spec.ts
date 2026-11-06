import { mkdirSync } from 'node:fs'
import type { Locator } from '@playwright/test'
import { createOutfit, createWardrobeItem, expect, test } from './support/fixture'

test.use({ timezoneId: 'Asia/Seoul' })
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
const dateOffset = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const outfitId = '000000000000000000000101'

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`${viewport.name}: 배정은 착용이 아니며 실제 착용 확인·취소가 저장되고 룩북에도 반영된다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    mockApi.outfits = [createOutfit({ id: outfitId, name: '실제 착용 테스트 코디' })]
    const outfit = { ...mockApi.outfits[0], plannerOnly: false }
    mockApi.plannerEntries = [{ date: today, title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null, outfit }]
    await page.goto('/plan')
    const action = page.getByRole('group', { name: '실제 착용 확인' })
    await expect(action.getByRole('button', { name: '입었어요', exact: true })).toBeVisible()
    expect(mockApi.plannerEntries[0].wornAt).toBeUndefined()
    await action.getByRole('button', { name: '입었어요', exact: true }).click()
    await expect(action.getByText('착용 완료', { exact: true })).toBeVisible()
    expect(mockApi.plannerEntries[0].wornAt).toBeTruthy()
    expect(mockApi.operations).toContain('SetPlannerEntryWorn')
    await page.reload()
    await expect(action.getByRole('button', { name: '착용 취소', exact: true })).toBeVisible()
    mkdirSync('.playwright-mcp/wear-completion', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/wear-completion/${viewport.name}-day.png`, animations: 'disabled' })
    await page.goto('/lookbook')
    await expect(page.getByRole('button', { name: `${outfit.name} 코디 상세 보기` }).getByText('오늘 착용', { exact: true })).toBeVisible()
    await page.goto(`/plan/${today}`)
    await expect(action.getByText('착용 완료', { exact: true })).toBeVisible()
    await page.screenshot({ path: `.playwright-mcp/wear-completion/${viewport.name}-detail.png`, animations: 'disabled' })
    await action.getByRole('button', { name: '착용 취소', exact: true }).click()
    await expect(action.getByRole('button', { name: '입었어요', exact: true })).toBeVisible()
    expect(mockApi.plannerEntries[0].wornAt).toBeNull()
    await page.goto('/lookbook')
    await expect(page.getByRole('button', { name: `${outfit.name} 코디 상세 보기` }).getByText(/착용 예정/)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('착용 완료 날짜에서는 구성을 보호하고 착용 취소 후에만 코디를 뺄 수 있다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const outfit = { ...createOutfit({ id: outfitId }), plannerOnly: true }
  const wornAt = `${today}T00:00:00.000Z`
  mockApi.plannerEntries = [{
    date: today, title: outfit.name, occasion: null, weatherSummary: null,
    temperatureC: null, outfit, wornAt, wearFeeling: 'cold', wearTemperatureC: 12,
  }]

  await page.goto(`/plan/${today}`)
  const detail = page.getByRole('dialog', { name: `${outfit.name} 상세` })
  await expect(detail.getByText('코디를 수정하거나 빼려면 먼저 ‘착용 취소’를 눌러주세요.')).toBeVisible()
  await expect(detail.getByRole('button', { name: '코디북에서 고르기' })).toBeDisabled()
  await expect(detail.getByRole('button', { name: '이 날짜에서 코디 빼기' })).toBeDisabled()
  await expect(detail.getByRole('button', { name: '상의 교체하기' })).toHaveCount(0)
  expect(mockApi.plannerEntries[0]).toMatchObject({ wornAt, wearFeeling: 'cold', wearTemperatureC: 12 })
  expect(mockApi.operations).not.toContain('ClearPlannerEntry')

  await detail.getByRole('button', { name: '착용 취소', exact: true }).click()
  await expect(detail.getByRole('button', { name: '상의 교체하기' })).toBeVisible()
  await detail.getByRole('button', { name: '이 날짜에서 코디 빼기' }).click()
  await page.getByRole('alertdialog', { name: '이 날짜에서 코디를 뺄까요?' }).getByRole('button', { name: '플래너에서 빼기' }).click()
  await expect(page).toHaveURL('/plan')
  expect(mockApi.plannerEntries).toEqual([])
})

for (const [action, operation] of [
  ['옷 구성 수정', 'SetDirectPlannerEntry'],
  ['코디북 코디로 교체', 'SetPlannerEntry'],
  ['일정에서 코디 빼기', 'ClearPlannerEntry'],
] as const) {
  test(`다른 기기에서 착용을 확정하면 열린 화면의 ${action} 요청을 거절하고 기록을 유지한다`, async ({ page, mockApi }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.clock.setFixedTime(new Date('2026-11-06T12:00:00+09:00'))
    const date = '2026-11-06'
    const outfit = { ...createOutfit({ id: outfitId, name: '기존 착용 코디' }), plannerOnly: true }
    const previous = { date, title: outfit.name, occasion: null, weatherSummary: null, temperatureC: 15, outfit }
    mockApi.plannerEntries = [previous]
    mockApi.wardrobeItems.push(createWardrobeItem({ id: 'replacement-top', name: '교체용 상의' }))
    mockApi.outfits = [createOutfit({
      name: '교체용 코디', items: [{ wardrobeItemId: 'replacement-top', layerOrder: 0 }, { wardrobeItemId: 'item-2', layerOrder: 1 }],
    })]

    await page.goto(`/plan/${date}`)
    await expect(page.getByRole('button', { name: '입었어요', exact: true })).toBeVisible()
    let submit: Locator
    let dismiss: Locator | undefined
    if (operation === 'SetDirectPlannerEntry') {
      await page.getByRole('button', { name: '상의 교체하기' }).click()
      const picker = page.getByRole('dialog', { name: '상의 옷 선택' })
      await picker.getByRole('button', { name: /교체용 상의/ }).click()
      await picker.getByRole('button', { name: '1개 선택 완료' }).click()
      submit = page.getByRole('button', { name: '변경사항 저장', exact: true })
    } else if (operation === 'SetPlannerEntry') {
      await page.getByRole('button', { name: '코디북에서 고르기' }).click()
      const picker = page.getByRole('dialog', { name: '하루 코디 선택' })
      submit = picker.getByRole('button', { name: /교체용 코디/ })
      dismiss = picker.getByRole('button', { name: '하루 코디 선택 닫기' })
    } else {
      await page.getByRole('button', { name: '이 날짜에서 코디 빼기' }).click()
      const confirm = page.getByRole('alertdialog', { name: '이 날짜에서 코디를 뺄까요?' })
      submit = confirm.getByRole('button', { name: '플래너에서 빼기', exact: true })
      dismiss = confirm.getByRole('button', { name: '취소', exact: true })
    }
    await expect(submit).toBeEnabled()

    // 열린 화면은 그대로 두고, 다른 기기의 착용 확인이 먼저 저장된 상태를 만든다.
    const confirmed = { ...previous, wornAt: '2026-11-06T02:00:00.000Z', wearFeeling: 'cold' as const, wearTemperatureC: 12 }
    mockApi.plannerEntries = [structuredClone(confirmed)]
    const [response] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/graphql') &&
        response.request().postDataJSON()?.query?.includes(`mutation ${operation}(`)),
      submit.click(),
    ])
    const result = await response.json()
    expect(result.errors?.[0]?.extensions?.code).toBe('PLANNER_WEAR_CONFIRMED')
    await expect(page.getByText(result.errors[0].message, { exact: true })).toBeVisible()
    if (dismiss) await dismiss.click()

    const detail = page.getByRole('dialog', { name: `${outfit.name} 상세` })
    await expect(detail.getByText('착용 완료', { exact: true })).toBeVisible()
    await expect(detail.getByRole('button', { name: '코디북에서 고르기' })).toBeDisabled()
    await expect(detail.getByRole('button', { name: '이 날짜에서 코디 빼기' })).toBeDisabled()
    await expect(detail.getByRole('button', { name: '상의 교체하기' })).toHaveCount(0)
    expect(mockApi.plannerEntries).toEqual([confirmed])
    await expect(page).toHaveURL(`/plan/${date}`)
    await page.reload()
    await expect(detail.getByRole('radio', { name: '추웠어요', exact: true })).toHaveAttribute('aria-checked', 'true')
  })
}

test('과거의 미확인 배정도 착용으로 집계하지 않고 미래에는 완료 버튼을 숨긴다', async ({ page, mockApi }) => {
  mockApi.outfits = [createOutfit({ id: outfitId, name: '미확인 코디' })]
  const outfit = { ...mockApi.outfits[0], plannerOnly: false }
  mockApi.plannerEntries = [{ date: dateOffset(-3), title: outfit.name, occasion: null, weatherSummary: null, temperatureC: null, outfit }]
  await page.goto('/lookbook')
  await expect(page.getByRole('button', { name: `${outfit.name} 코디 상세 보기` }).getByText('착용 0회', { exact: true })).toBeVisible()
  await page.goto(`/plan?view=today&date=${dateOffset(-3)}`)
  await expect(page.getByRole('button', { name: '입었어요', exact: true })).toBeVisible()
  mockApi.plannerEntries = [{ ...mockApi.plannerEntries[0], date: dateOffset(1) }]
  await page.goto(`/plan?view=today&date=${dateOffset(1)}`)
  await expect(page.getByRole('button', { name: '입었어요', exact: true })).toHaveCount(0)
  expect(mockApi.operations).not.toContain('SetPlannerEntryWorn')
})
