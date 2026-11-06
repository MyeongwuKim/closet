import { expect, test } from './support/fixture'

test('옷장 조회 전에는 빈 옷장으로 표시하지 않고 첫 사진 추가를 바로 연다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  mockApi.wardrobeItems = []
  mockApi.outfits = []

  let releaseWardrobe = () => {}
  const wardrobeReady = new Promise<void>((resolve) => { releaseWardrobe = resolve })
  await page.route('**/graphql', async (route) => {
    if (route.request().postDataJSON().query.includes('query WardrobeItems')) await wardrobeReady
    await route.fallback()
  })

  try {
    await page.goto('/plan')
    const firstPhoto = page.getByRole('link', { name: '첫 옷 사진 추가', exact: true })
    await expect(page.getByText('옷장과 코디북을 확인하고 있어요.')).toBeVisible()
    await expect(firstPhoto).toHaveCount(0)
    releaseWardrobe()

    await expect(firstPhoto).toBeInViewport({ ratio: 1 })
    await expect(page.getByRole('button', { name: '코디북에서 고르기' })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('planner-first-photo.png'), animations: 'disabled' })
    await firstPhoto.click()
    await expect(page).toHaveURL('/closet')
    const picker = page.getByRole('dialog', { name: '옷 사진 추가' })
    await expect(picker).toBeVisible()
    await picker.getByRole('button', { name: '옷 사진 추가창 닫기' }).click()

    const emptyClosetAction = page.getByRole('button', { name: '첫 옷 사진 추가', exact: true })
    await expect(emptyClosetAction).toBeInViewport({ ratio: 1 })
    await page.screenshot({ path: testInfo.outputPath('closet-first-photo.png'), animations: 'disabled' })
    await emptyClosetAction.click()
    await expect(picker).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(emptyClosetAction).toBeFocused()
    await page.reload()
    await expect(emptyClosetAction).toBeVisible()
    await expect(picker).toHaveCount(0)
  } finally {
    releaseWardrobe()
  }
})

test('옷만 있으면 선택한 날짜의 코디를 직접 구성할 수 있다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  mockApi.outfits = []
  const date = '2026-11-04'
  const route = `/plan?view=today&date=${date}`
  await page.goto(route)

  const compose = page.getByRole('link', { name: '내 옷으로 코디 만들기', exact: true })
  await expect(compose).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('button', { name: '코디북에서 고르기' })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('planner-compose-first.png'), animations: 'disabled' })
  await compose.click()
  await expect(page).toHaveURL(`/plan/${date}?from=${encodeURIComponent(route)}`)
  await page.getByRole('button', { name: '플래너로 돌아가기' }).click()
  await expect(page).toHaveURL(route)
})

test('옷장이 비어도 보관된 옷의 기존 코디는 배정할 수 있다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = mockApi.wardrobeItems.map((item) => ({ ...item, archivedAt: '2026-11-03T00:00:00.000Z' }))
  await page.goto('/plan')

  await expect(page.getByRole('link', { name: '첫 옷 사진 추가' })).toBeVisible()
  await page.getByRole('button', { name: '코디북에서 고르기' }).click()
  const picker = page.getByRole('dialog', { name: '하루 코디 선택' })
  await picker.getByRole('button', { name: /기본 코디/ }).click()
  await expect(picker).toHaveCount(0)
  await expect(page.getByRole('link', { name: /기본 코디, 옷 설정하기/ })).toBeVisible()
})

test('코디북 조회 실패는 빈 코디북으로 처리하지 않고 다시 조회할 수 있다', async ({ page, mockApi }) => {
  let shouldFail = true
  await page.route('**/graphql', async (route) => {
    if (shouldFail && route.request().postDataJSON().query.includes('query Outfits(')) {
      await route.fulfill({ json: { errors: [{ message: '코디북 조회 실패' }] } })
      return
    }
    await route.fallback()
  })
  await page.goto('/plan')

  const retry = page.getByRole('button', { name: '다시 불러오기', exact: true })
  await expect(retry).toBeVisible()
  await expect(page.getByRole('link', { name: '내 옷으로 코디 만들기' })).toHaveCount(0)
  shouldFail = false
  await retry.click()
  await expect(page.getByRole('button', { name: '코디북에서 고르기' })).toBeVisible()
  expect(mockApi.operations).toContain('Outfits')
})
