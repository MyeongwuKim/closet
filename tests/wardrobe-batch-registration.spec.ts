import { test, expect } from './support/fixture'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9s1gAAAABJRU5ErkJggg==', 'base64')

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 여러 옷을 확인해 저장하고 실패한 옷만 같은 요청으로 재시도한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    mockApi.wardrobeItems = []
    let failFirst = true
    const requestIds: string[] = []
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (query.includes('mutation CreateWardrobeItem')) {
        requestIds.push(variables.input.registrationRequestId)
        if (failFirst) {
          failFirst = false
          await route.fulfill({ json: { data: null, errors: [{ message: '일시적인 저장 오류예요.', extensions: { code: 'WARDROBE_CREATE_FAILED' } }] } })
          return
        }
      }
      await route.fallback()
    })
    await page.goto('/closet')
    await page.getByRole('button', { name: '옷장에 옷 추가' }).click()
    await page.locator('input[type=file][multiple]').setInputFiles([
      { name: 'first.png', mimeType: 'image/png', buffer: png },
      { name: 'second.png', mimeType: 'image/png', buffer: png },
    ])
    const dialog = page.getByRole('dialog', { name: '옷 여러 벌 등록' })
    await expect(dialog.getByRole('textbox', { name: '아이템 이름' })).toHaveCount(2)
    await dialog.getByRole('textbox', { name: '아이템 이름' }).nth(0).fill('첫 셔츠')
    await dialog.getByRole('textbox', { name: '아이템 이름' }).nth(1).fill('둘째 셔츠')
    await dialog.getByRole('group', { name: '선택한 옷의 계절' }).getByRole('button', { name: '봄', exact: true }).click()
    await page.screenshot({ path: testInfo.outputPath(`batch-${viewport.width}.png`), fullPage: true, animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await dialog.getByRole('button', { name: '선택한 2벌 저장', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('일시적인 저장 오류')
    await expect(dialog.getByRole('textbox', { name: '아이템 이름' })).toHaveCount(1)
    await expect(dialog.getByRole('textbox', { name: '아이템 이름' })).toHaveValue('첫 셔츠')
    await expect(page.getByText('1벌을 저장했어요. 실패한 1벌은 다시 저장해주세요.', { exact: true })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath(`batch-error-${viewport.width}.png`), fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: '선택한 1벌 저장', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(mockApi.wardrobeItems.map((item) => item.name).sort()).toEqual(['둘째 셔츠', '첫 셔츠'])
    expect(requestIds[2]).toBe(requestIds[0])
    expect(mockApi.uploadKinds).toHaveLength(2)
  })
}

test('뒤늦은 분석 결과가 편집한 이름을 덮지 않고 현재 저장 대상에도 끼어들지 않는다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (query.includes('mutation ClassifyWardrobeImage') && variables.input.filename === 'late.png') await gate
    await route.fallback()
  })
  try {
    await page.goto('/closet')
    await page.getByRole('button', { name: '옷장에 옷 추가' }).click()
    await page.locator('input[type=file][multiple]').setInputFiles([
      { name: 'early.png', mimeType: 'image/png', buffer: png }, { name: 'late.png', mimeType: 'image/png', buffer: png },
    ])
    const dialog = page.getByRole('dialog', { name: '옷 여러 벌 등록' })
    await dialog.getByRole('textbox', { name: '아이템 이름' }).fill('먼저 수정한 셔츠')
    await dialog.getByRole('group', { name: '선택한 옷의 계절' }).getByRole('button', { name: '봄', exact: true }).click()
    await dialog.getByRole('button', { name: '선택한 1벌 저장' }).click()
    await expect.poll(() => mockApi.wardrobeItems.length).toBe(1)
    await expect(dialog).toBeVisible()
    release()
    await expect(dialog.getByRole('textbox', { name: '아이템 이름' })).toHaveValue('새 셔츠')
    await expect(dialog.getByRole('button', { name: '선택한 1벌 저장' })).toBeEnabled()
    expect(mockApi.wardrobeItems[0].name).toBe('먼저 수정한 셔츠')
    await dialog.getByRole('button', { name: '선택한 1벌 저장' }).click()
    await expect(dialog).toHaveCount(0)
    expect(mockApi.wardrobeItems).toHaveLength(2)
  } finally { release() }
})

test('공통 계절은 선택한 행만 바꾸고 제외한 행은 기존 값을 유지한다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  await page.goto('/closet')
  await page.getByRole('button', { name: '옷장에 옷 추가' }).click()
  await page.locator('input[type=file][multiple]').setInputFiles([
    { name: 'selected.png', mimeType: 'image/png', buffer: png }, { name: 'excluded.png', mimeType: 'image/png', buffer: png },
  ])
  const dialog = page.getByRole('dialog', { name: '옷 여러 벌 등록' })
  await expect(dialog.getByRole('textbox', { name: '아이템 이름' })).toHaveCount(2)
  const selected = dialog.getByRole('article', { name: 'selected.png 등록 정보' })
  const excluded = dialog.getByRole('article', { name: 'excluded.png 등록 정보' })
  await selected.getByRole('textbox', { name: '아이템 이름' }).fill('봄 셔츠')
  await excluded.getByRole('checkbox').uncheck()
  await dialog.getByRole('group', { name: '선택한 옷의 계절' }).getByRole('button', { name: '봄', exact: true }).click()
  await expect(selected.getByText('봄', { exact: true })).toBeVisible()
  await expect(excluded.getByText('봄', { exact: true })).toHaveCount(0)
  await excluded.getByRole('checkbox').check()
  await expect(dialog.getByRole('button', { name: '선택한 2벌 저장' })).toBeDisabled()
  await excluded.getByRole('button', { name: /정보 수정/ }).click()
  const editor = page.getByRole('dialog', { name: '옷 정보 확인' })
  await editor.getByRole('textbox', { name: '아이템 이름' }).fill('겨울 셔츠')
  await editor.getByRole('group', { name: '입을 계절' }).getByRole('button', { name: '겨울', exact: true }).click()
  await editor.getByRole('button', { name: '목록에 적용' }).click()
  expect(mockApi.wardrobeItems).toHaveLength(0)
  await dialog.getByRole('button', { name: '선택한 2벌 저장' }).click()
  await expect(dialog).toHaveCount(0)
  expect(mockApi.wardrobeItems.find((item) => item.name === '봄 셔츠')?.seasons).toEqual(['spring'])
  expect(mockApi.wardrobeItems.find((item) => item.name === '겨울 셔츠')?.seasons).toEqual(['winter'])
})
