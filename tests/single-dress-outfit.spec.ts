import { createWardrobeItem, expect, test } from './support/fixture'

const dress = createWardrobeItem({ id: 'dress', name: '네이비 원피스', category: 'dress', subcategory: '원피스' })

test('옷장에서 원피스만 골라도 코디북에 저장하고 다시 열 수 있다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  mockApi.wardrobeItems.push(dress)
  mockApi.outfits = []

  await page.goto('/closet')
  await page.getByRole('button', { name: `${dress.name} 코디로 선택` }).click()
  await page.getByRole('button', { name: '코디 만들기', exact: true }).click()
  const composer = page.getByRole('dialog', { name: '코디 맞춰보기' })
  await composer.getByRole('button', { name: '코디 저장하기', exact: true }).click()
  const save = page.getByRole('dialog', { name: '이 Look으로 저장할까요?' })
  await save.getByRole('textbox', { name: '코디 이름' }).fill('원피스 한 벌 코디')
  await save.getByRole('button', { name: '캐주얼', exact: true }).click()
  await save.getByRole('button', { name: '코디북에 저장', exact: true }).click()

  await expect(page).toHaveURL('/lookbook')
  expect(mockApi.outfits[0]?.items.map((item) => item.wardrobeItemId)).toEqual([dress.id])
  await page.reload()
  const savedOutfit = page.getByRole('button', { name: '원피스 한 벌 코디 코디 상세 보기' })
  await expect(savedOutfit).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('single-dress-lookbook.png'), animations: 'disabled' })
  await savedOutfit.click()
  const detail = page.getByRole('dialog', { name: '원피스 한 벌 코디 코디 상세', exact: true })
  await expect(detail.getByText(/옷 1개$/)).toBeVisible()
  await expect(detail.getByText('원피스', { exact: true })).toBeVisible()
})

test('추천한 원피스 한 벌을 코디 상세에서 오늘 일정에 담을 수 있다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  mockApi.wardrobeItems = [dress]
  mockApi.outfits = []
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('query TodayOutfitRecommendation')) {
      await route.fallback()
      return
    }
    const { date, season, colorScheme } = variables.input
    await route.fulfill({ json: { data: { todayOutfitRecommendation: {
      date, season, colorScheme, colorSchemeApplied: true, ready: true,
      headline: '추천 원피스 코디', summary: '원피스 한 벌로 입어보세요.',
      items: [dress], reasons: [], profileSummary: [], style: null,
      source: 'fallback', model: null, weather: null,
    } } } })
  })

  await page.goto('/plan')
  await page.getByRole('button', { name: 'AI 코디 추천', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: '오늘의 AI 코디 추천' })
  await sheet.getByRole('button', { name: '조건 바꾸기', exact: true }).click()
  await sheet.getByRole('button', { name: '봄', exact: true }).click()
  await sheet.getByRole('button', { name: '자동', exact: true }).click()
  await sheet.getByRole('button', { name: '추천 코디 구성 변경하기' }).click()
  const detail = page.getByRole('dialog', { name: '오늘의 추천 코디 상세' })
  await detail.getByRole('button', { name: '오늘 일정에 추가', exact: true }).click()

  await expect(detail).toHaveCount(0)
  await expect(page.getByRole('link', { name: /추천 원피스 코디, 옷 설정하기/ })).toBeVisible()
  expect(mockApi.plannerEntries[0]?.outfit?.items.map((item) => item.wardrobeItemId)).toEqual([dress.id])
})
