import { test, expect, createWardrobeItem } from './support/fixture'
import type { Page } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import type { ClosetNativeBridge } from '../apps/web/src/native-bridge/types'

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9s1gAAAABJRU5ErkJggg==',
  'base64',
)

async function selectWardrobePhoto(page: Page, count = 1, buffer = onePixelPng) {
  await page.getByRole('button', { name: '옷장에 옷 추가' }).click()

  const photoDialog = page.getByRole('dialog', { name: '옷 사진 추가' })
  await expect(photoDialog).toBeVisible()
  const fileChooserPromise = page.waitForEvent('filechooser')
  await photoDialog.getByRole('button', { name: '옷 사진 선택, 끌어다 놓기 또는 붙여넣기' }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(Array.from({ length: count }, (_, index) => ({
    name: `e2e-shirt-${index}.png`,
    mimeType: 'image/png',
    buffer,
  })))
}

const shirtShape = {
  layerRole: 'base', silhouette: 'regular', material: 'cotton', texture: 'smooth',
  pattern: 'solid', warmth: 'medium', formality: 0.7, confidence: 0.95,
  necklineStyle: 'collar', frontOpeningStyle: 'buttons', pocketStyle: 'patch',
}

async function mockRegistrationAnalysis(
  page: Page,
  result: Record<string, unknown>,
) {
  await page.route('**/graphql', async (route) => {
    if (!route.request().postDataJSON().query.includes('mutation ClassifyWardrobeImage')) {
      await route.fallback()
      return
    }
    await route.fulfill({
      json: {
        data: {
          classifyWardrobeImage: {
            category: 'top', categoryLabel: '상의', subcategory: 'shirt', subcategoryLabel: '셔츠',
            suggestedName: '새 셔츠', colorName: '네이비', colorDetailName: '네이비',
            colorHex: '#24364a', colorRgb: [36, 54, 74], colorMode: 'solid',
            fashionAttributes: shirtShape, confidence: 0.95, model: 'e2e-mock', candidates: [],
            cutoutImageBase64: null, cutoutMimeType: null,
            ...result,
          },
        },
      },
    })
  })
}

test('웹 옷장에 캡처 사진을 놓으면 파일 선택 없이 AI 분석 결과가 열린다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  await page.goto('/closet')
  await page.getByRole('button', { name: '옷장에 옷 추가' }).click()
  const dialog = page.getByRole('dialog', { name: '옷 사진 추가' })
  const dropZone = dialog.getByRole('button', { name: '옷 사진 선택, 끌어다 놓기 또는 붙여넣기' })
  await expect(dropZone).toBeVisible()
  const screenshot = await page.evaluateHandle((bytes) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File([new Uint8Array(bytes)], '옷-부분-캡처.png', { type: 'image/png' }))
    return dataTransfer
  }, Array.from(onePixelPng))
  await dropZone.dispatchEvent('dragenter', { dataTransfer: screenshot })
  await expect(dropZone).toHaveAttribute('data-dragging', 'true')
  await dropZone.dispatchEvent('drop', { dataTransfer: screenshot })
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'AI 분석 결과' })).toBeVisible()
  expect(mockApi.operations).toContain('ClassifyWardrobeImage')
})

test('네이티브 WebView 사진 추가 창에 스크린샷을 놓으면 AI 분석으로 전달한다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  await page.addInitScript(() => { window.ClosetRuntimeConfig = { isNativeWebView: true, routerMode: 'hash' } })
  await page.goto('/#/closet')
  await page.getByRole('button', { name: '옷장에 옷 추가' }).click()
  const dialog = page.getByRole('dialog', { name: '옷 사진 추가' })
  const screenshot = await page.evaluateHandle((bytes) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File([new Uint8Array(bytes)], '스크린샷.png', { type: 'image/png' }))
    return dataTransfer
  }, Array.from(onePixelPng))
  await dialog.dispatchEvent('drop', { dataTransfer: screenshot })
  await expect(page.getByRole('dialog', { name: 'AI 분석 결과' })).toBeVisible({ timeout: 4000 })
  expect(mockApi.operations).toContain('ClassifyWardrobeImage')
})

test('사진 분석 결과를 확인해 옷을 등록하고 새로고침 후에도 조회한다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (query.includes('mutation ClassifyWardrobeImage')) expect(variables.input.includeCutout).toBe(false)
    await route.fallback()
  })

  await page.goto('/closet')
  await expect(page.getByText('옷장이 비어 있어요')).toBeVisible()
  await selectWardrobePhoto(page)

  const classificationDialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
  await expect(classificationDialog).toBeVisible()
  await expect(classificationDialog.getByText('겹치는 옷은 없어요')).toBeVisible()
  await classificationDialog.getByRole('textbox', { name: '아이템 이름' }).fill('새로 등록한 셔츠')
  await classificationDialog.getByRole('group', { name: '입을 계절' }).getByRole('button', { name: '봄' }).click()
  await classificationDialog.getByRole('button', { name: '옷장에 추가' }).click()

  await expect(classificationDialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '새로 등록한 셔츠 옷 상세 보기' })).toBeVisible()
  expect(mockApi.operations).not.toContain('RemoveWardrobeImageBackground')
  expect(mockApi.uploadKinds).toEqual(['wardrobeOriginal'])
  expect(mockApi.wardrobeItems[0].displayImageAsset?.id).toBe(mockApi.wardrobeItems[0].originalImageAsset?.id)

  await page.reload()
  await expect(page.getByRole('button', { name: '새로 등록한 셔츠 옷 상세 보기' })).toBeVisible()
})

test('전체 옷장 조회가 늦거나 실패하면 비교 상태를 안내하고 다시 확인할 수 있다', async ({ page, mockApi }) => {
  const firstPage = Array.from({ length: 20 }, (_, index) => createWardrobeItem({
    id: `white-${index}`, name: `흰색 셔츠 ${index}`, colorName: '화이트', colorHex: '#ffffff',
  }))
  const match = createWardrobeItem({
    id: 'navy-match', name: '이전에 등록한 네이비 셔츠', createdAt: '2025-12-15T00:00:00.000Z',
  })
  mockApi.wardrobeItems = [...firstPage, match]

  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  let fullQueryStarted = false
  let failFullQuery = true

  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (query.includes('query WardrobePage(') && !variables.input.cursor) {
      await route.fulfill({ json: { data: { wardrobePage: {
        items: firstPage, totalCount: 21, hasNextPage: true, nextCursor: firstPage[19].id,
      } } } })
      return
    }
    if (query.includes('query WardrobeItems {')) {
      fullQueryStarted = true
      await gate
      if (failFullQuery) {
        await route.fulfill({ json: { data: null, errors: [{
          message: '옷장을 불러오지 못했어요.',
          extensions: { code: 'WARDROBE_LOAD_FAILED', cause: 'Test catalog unavailable' },
        }] } })
        return
      }
    }
    await route.fallback()
  })

  try {
    await page.goto('/closet')
    await expect(page.getByRole('button', { name: '흰색 셔츠 0 옷 상세 보기' })).toBeVisible()
    await selectWardrobePhoto(page)
    const dialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
    await expect.poll(() => fullQueryStarted).toBe(true)
    await expect(dialog.getByText('옷장과 비교하는 중이에요')).toBeVisible()
    await expect(dialog.getByText('겹치는 옷은 없어요')).toHaveCount(0)
    release()

    await expect(dialog.getByText('옷장과 비교하지 못했어요')).toBeVisible()
    await expect(dialog.getByText('겹치는 옷은 없어요')).toHaveCount(0)
    await dialog.getByRole('textbox', { name: '아이템 이름' }).fill('수정한 이름')
    failFullQuery = false
    await dialog.getByRole('button', { name: '다시 확인' }).click()
    await expect(dialog.getByRole('button', { name: `${match.name} 상세정보 보기` })).toContainText('색상 100%')
    await expect(dialog.getByRole('textbox', { name: '아이템 이름' })).toHaveValue('수정한 이름')
  } finally {
    release()
  }
})

test('겹치는 옷 전체 개수와 상위 네 개를 표시하고 기존 옷의 상세를 연다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const colorMatches = ['#27394d', '#25374b', '#24364a', '#283a4e'].map((colorHex, index) =>
    createWardrobeItem({ id: `color-${index}`, name: `색만 비슷한 셔츠 ${index}`, colorHex }),
  )
  mockApi.wardrobeItems = [
    ...colorMatches,
    createWardrobeItem({
      id: 'shape', name: '형태만 같은 셔츠', colorName: '화이트', colorHex: '#ffffff',
      fashionAttributes: shirtShape,
    }),
    createWardrobeItem({ id: 'both', name: '색과 형태가 같은 셔츠', fashionAttributes: shirtShape }),
    createWardrobeItem({ id: 'neither', name: '색과 형태가 다른 셔츠', colorName: '화이트', colorHex: '#ffffff' }),
  ]
  await mockRegistrationAnalysis(page, {})
  await page.goto('/closet')
  await selectWardrobePhoto(page)
  const dialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
  await expect(dialog.getByText('옷장에 색상이나 형태가 겹치는 아이템이 6개 있어요.')).toBeVisible()
  await expect(dialog.getByText('유사도가 높은 4개를 보여드려요.')).toBeVisible()
  const comparison = dialog.getByRole('region', { name: '잠깐만요!' })
  expect((await comparison.boundingBox())?.width).toBeLessThan(390)

  const cards = dialog.getByRole('button', { name: /상세정보 보기$/ })
  await expect(cards).toHaveCount(4)
  await expect(cards.nth(0)).toHaveAccessibleName('색과 형태가 같은 셔츠 상세정보 보기')
  await expect(cards.nth(0)).toContainText('종합 100%')
  await expect(cards.nth(1)).toHaveAccessibleName('형태만 같은 셔츠 상세정보 보기')
  await expect(cards.nth(1)).toContainText('형태 100%')
  await expect(cards.nth(1)).toContainText('색상 다름')
  await expect(cards.nth(2)).toHaveAccessibleName('색만 비슷한 셔츠 2 상세정보 보기')
  await expect(cards.nth(2)).toContainText('색상 100%')
  await expect(cards.nth(3)).toHaveAccessibleName('색만 비슷한 셔츠 1 상세정보 보기')
  await cards.nth(1).click()
  await expect(page.getByRole('dialog', { name: '형태만 같은 셔츠' })).toBeVisible()
  await page.getByRole('button', { name: '아이템 상세정보 닫기' }).click()
  await expect(dialog).toBeVisible()
  await cards.nth(3).scrollIntoViewIfNeeded()
  await expect(cards.nth(3)).toBeInViewport()
})

test('패턴 옷은 같은 바탕색을 전체 색이나 종합 일치로 표시하지 않는다', async ({ page, mockApi }) => {
  const color = { colorName: '화이트', colorHex: '#ffffff', colorMode: 'patterned' }
  const stripe = { ...shirtShape, pattern: 'stripe' }
  mockApi.wardrobeItems = [
    createWardrobeItem({ id: 'stripe', name: '흰 바탕 빨강 줄무늬 셔츠', ...color, fashionAttributes: stripe }),
    createWardrobeItem({
      id: 'check', name: '흰 바탕 파랑 체크 셔츠', ...color, fashionAttributes: { ...stripe, pattern: 'check' },
    }),
  ]
  await mockRegistrationAnalysis(page, {
    suggestedName: '흰 바탕 검정 줄무늬 셔츠', ...color, colorDetailName: '화이트',
    colorRgb: [255, 255, 255], fashionAttributes: stripe,
  })
  await page.goto('/closet')
  await selectWardrobePhoto(page)
  const dialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
  const stripeCard = dialog.getByRole('button', { name: '흰 바탕 빨강 줄무늬 셔츠 상세정보 보기' })
  const checkCard = dialog.getByRole('button', { name: '흰 바탕 파랑 체크 셔츠 상세정보 보기' })
  await expect(stripeCard).toContainText('대표색 100%')
  await expect(checkCard).toContainText('대표색 100%')
  await expect(checkCard).toContainText('형태 다름')
  await expect(dialog.getByText('색상·형태 매우 유사')).toHaveCount(0)
  await expect(dialog.getByText(/^종합 \d+%$/)).toHaveCount(0)
})

test('신발의 형태 정보가 부족하면 색이 겹치는 후보만 보여준다', async ({ page, mockApi }) => {
  const shape = {
    layerRole: 'single', silhouette: 'unknown', material: 'unknown', texture: 'unknown',
    pattern: 'solid', warmth: 'unknown', formality: 0.3, confidence: 0.2,
  }
  const sneakers = { category: 'shoes', subcategory: '스니커즈', fashionAttributes: shape }
  mockApi.wardrobeItems = [
    createWardrobeItem({ id: 'dark', name: '검정 하이탑', ...sneakers, colorName: '블랙', colorHex: '#000000' }),
    createWardrobeItem({ id: 'light', name: '흰색 하이탑', ...sneakers, colorName: '화이트', colorHex: '#ffffff' }),
  ]
  await mockRegistrationAnalysis(page, {
    ...sneakers, categoryLabel: '신발', subcategory: 'sneakers', subcategoryLabel: '스니커즈',
    suggestedName: '흰색 로우탑', colorName: '화이트', colorDetailName: '화이트',
    colorHex: '#ffffff', colorRgb: [255, 255, 255],
  })
  await page.goto('/closet')
  await selectWardrobePhoto(page)
  const dialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
  const lightCard = dialog.getByRole('button', { name: '흰색 하이탑 상세정보 보기' })
  await expect(lightCard).toContainText('색상 100%')
  await expect(lightCard).toContainText('형태 정보 부족')
  await expect(dialog.getByRole('button', { name: '검정 하이탑 상세정보 보기' })).toHaveCount(0)
})

test('기기에서 만든 누끼는 확인 화면에 표시하고 저장하면 원본과 함께 연결한다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript((imageBase64) => {
    window.ClosetNative = { removeWardrobePhotoBackground: async () => ({ imageBase64 }) } as unknown as ClosetNativeBridge
  }, readFileSync('tests/support/mock-shirt.png').toString('base64'))

  await page.goto('/closet')
  await selectWardrobePhoto(page)

  const classificationDialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
  await expect(classificationDialog.getByText('AI 분석 완료')).toBeVisible()
  const preview = classificationDialog.getByRole('img', { name: '새 셔츠' })
  await expect(preview).toBeVisible()
  await expect(preview).toHaveJSProperty('naturalWidth', 1)
  await classificationDialog.getByRole('button', { name: '배경 제거', exact: true }).click()
  await expect(preview).toHaveJSProperty('naturalWidth', 280)
  await classificationDialog.getByRole('button', { name: '원본으로 돌아가기' }).click()
  await expect(preview).toHaveJSProperty('naturalWidth', 1)
  await classificationDialog.getByRole('button', { name: '배경 제거', exact: true }).click()
  await expect(preview).toHaveJSProperty('naturalWidth', 280)
  expect(mockApi.operations).not.toContain('CreateWardrobeItem')
  expect(mockApi.uploadKinds).toEqual([])

  await expect(page.getByText('AI가 옷 사진을 살펴보고 있어요 👀')).toHaveCount(0)
  mkdirSync('.playwright-mcp', { recursive: true })
  await page.screenshot({ path: '.playwright-mcp/registration-cutout-preview.png', animations: 'disabled' })
  await classificationDialog.getByRole('group', { name: '입을 계절' }).getByRole('button', { name: '봄' }).click()
  await classificationDialog.getByRole('button', { name: '옷장에 추가' }).click()
  await expect(classificationDialog).toHaveCount(0)
  expect(mockApi.uploadKinds).toEqual(['wardrobeOriginal', 'wardrobeCutout'])
  expect(mockApi.wardrobeItems[0].originalImageAsset?.id).toBe('e2e-upload-1')
  expect(mockApi.wardrobeItems[0].displayImageAsset?.id).toBe('e2e-upload-2')
  expect(mockApi.operations).not.toContain('RemoveWardrobeImageBackground')
})

test('AI 분류가 실패해도 옷 정보를 직접 입력해 원본으로 등록한다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  mockApi.classificationFailureMessage = 'AI 분류 요청에 실패했습니다.'

  await page.goto('/closet')
  await selectWardrobePhoto(page)

  const classificationDialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
  await expect(classificationDialog.getByText('옷 정보를 직접 확인해주세요')).toBeVisible()
  mkdirSync('.playwright-mcp', { recursive: true })
  await page.screenshot({ path: '.playwright-mcp/registration-manual.png', animations: 'disabled' })
  await classificationDialog.getByRole('textbox', { name: '아이템 이름' }).fill('직접 등록한 셔츠')
  await classificationDialog.getByRole('button', { name: '카테고리' }).click()
  const categoryDialog = page.getByRole('dialog', { name: '카테고리 선택' })
  await categoryDialog.getByRole('button', { name: '상의' }).click()
  await categoryDialog.getByRole('button', { name: '1개 카테고리 적용' }).click()
  await classificationDialog.getByRole('textbox', { name: '대표 색상' }).fill('네이비')
  await classificationDialog.getByRole('group', { name: '입을 계절' }).getByRole('button', { name: '봄' }).click()
  await classificationDialog.getByRole('button', { name: '옷장에 추가' }).click()

  await expect(page.getByRole('button', { name: '직접 등록한 셔츠 옷 상세 보기' })).toBeVisible()
  expect(mockApi.uploadKinds).toEqual(['wardrobeOriginal'])
})

test('기기 배경 제거에 실패해도 원본으로 등록할 수 있다', async ({ page, mockApi }) => {
  await page.addInitScript(() => {
    window.ClosetNative = { removeWardrobePhotoBackground: async () => { throw new Error('Vision processing failed') } } as unknown as ClosetNativeBridge
  })
  await page.goto('/closet')
  await selectWardrobePhoto(page)
  const dialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
  await dialog.getByRole('button', { name: '배경 제거' }).click()
  await expect(dialog.getByText('배경을 제거하지 못했어요. 원본으로 등록할 수 있어요.')).toBeVisible()
  await dialog.getByRole('group', { name: '입을 계절' }).getByRole('button', { name: '봄' }).click()
  await dialog.getByRole('button', { name: '옷장에 추가' }).click()
  await expect(dialog).toHaveCount(0)
  expect(mockApi.uploadKinds).toEqual(['wardrobeOriginal'])
  expect(mockApi.operations).not.toContain('RemoveWardrobeImageBackground')
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 일시 분류 실패를 팝업으로 알리고 같은 사진을 다시 시도한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    mockApi.classificationFailureMessage = '다른 AI 작업이 진행 중이에요.'
    mockApi.classificationFailureCode = 'AI_BUSY'
    await page.goto('/closet')
    await selectWardrobePhoto(page, 1, readFileSync('tests/support/mock-shirt.png'))

    const failure = page.getByRole('dialog', { name: '사진을 처리하지 못했어요' })
    await expect(failure.getByText('다른 AI 작업이 진행 중이에요.')).toBeVisible()
    await expect(failure.getByRole('img', { name: '선택한 옷 사진' })).toHaveJSProperty('naturalWidth', 280)
    await expect(page.getByRole('dialog', { name: 'AI 분석 결과' })).toHaveCount(0)
    expect(mockApi.operations).not.toContain('RemoveWardrobeImageBackground')
    expect(mockApi.uploadKinds).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('wardrobe-photo-failure.png'), animations: 'disabled' })

    await page.keyboard.press('Escape')
    await expect(failure).toHaveCount(0)
    await page.getByRole('link', { name: '플래너', exact: true }).click()
    await page.getByRole('link', { name: '옷장', exact: true }).click()
    await expect(failure).toHaveCount(0)
    await page.getByRole('button', { name: '처리하지 못한 사진 1장' }).click()
    await expect(failure).toBeVisible()
    mockApi.classificationFailureMessage = null
    await failure.getByRole('button', { name: 'e2e-shirt-0.png 다시 시도' }).click()
    await expect(failure).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'AI 분석 결과' })).toBeVisible()
    expect(mockApi.operations.filter((operation) => operation === 'ClassifyWardrobeImage')).toHaveLength(2)
    expect(mockApi.operations).not.toContain('CreateWardrobeItem')
    expect(mockApi.uploadKinds).toEqual([])
  })
}

test('여러 사진을 처리하지 못하면 한 팝업에서 각각 제외할 수 있다', async ({ page, mockApi }) => {
  mockApi.classificationFailureMessage = '다른 AI 작업이 진행 중이에요.'
  mockApi.classificationFailureCode = 'AI_BUSY'
  await page.goto('/closet')
  await selectWardrobePhoto(page, 2)

  const failure = page.getByRole('dialog', { name: '사진을 처리하지 못했어요' })
  await expect(failure.getByRole('listitem')).toHaveCount(2)
  await failure.getByRole('button', { name: 'e2e-shirt-0.png 제외' }).click()
  await expect(failure.getByRole('listitem')).toHaveCount(1)
  await failure.getByRole('button', { name: 'e2e-shirt-1.png 제외' }).click()
  await expect(failure).toHaveCount(0)
  await expect(page.getByRole('button', { name: /처리하지 못한 사진/ })).toHaveCount(0)
})

test('원본 URL이 없는 저장 후보는 업로드 전에 거절한다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  await page.goto('/closet')
  await page.evaluate(async () => {
    const storePath = '/src/stores/useUiStore.ts'
    const { useUiStore } = await import(/* @vite-ignore */ storePath)
    useUiStore.getState().enqueueClassification({
      itemId: 'original-only',
      imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9s1gAAAABJRU5ErkJggg==',
      originalFilename: 'original.png',
      itemName: '원본만 있는 셔츠',
      category: 'top',
      subcategory: '셔츠',
      colorName: '네이비',
      colorDetailName: '네이비',
      colorHex: '#24364a',
      colorRgb: [36, 54, 74],
      colorMode: 'solid',
      fashionAttributes: null,
      confidence: 0.9,
      model: 'e2e-mock',
      candidates: [],
      analysisFailed: false,
    })
  })

  const classificationDialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
  await classificationDialog.getByRole('group', { name: '입을 계절' }).getByRole('button', { name: '봄' }).click()
  await classificationDialog.getByRole('button', { name: '옷장에 추가' }).click()

  await expect(page.getByText('원본 사진을 읽지 못했어요. 사진을 다시 추가해주세요.')).toBeVisible()
  await expect(classificationDialog).toBeVisible()
  expect(mockApi.operations).not.toContain('PrepareImageUpload')
  expect(mockApi.operations).not.toContain('CreateWardrobeItem')
  expect(mockApi.uploadKinds).toEqual([])
})


test('여러 사진을 골라도 분류 요청은 한 번에 하나씩 실행한다', async ({ page, mockApi }) => {
  let active = 0
  let peak = 0
  let completed = 0
  await page.route('**/graphql', async (route) => {
    if (!route.request().postDataJSON().query.includes('mutation ClassifyWardrobeImage')) {
      await route.fallback()
      return
    }
    mockApi.operations.push('ClassifyWardrobeImage')
    active += 1
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 80))
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ data: { classifyWardrobeImage: {
      category: 'top', categoryLabel: '상의', subcategory: 'shirt', subcategoryLabel: '셔츠',
      suggestedName: '분석한 셔츠', colorName: '화이트', colorDetailName: '화이트', colorHex: '#ffffff', colorRgb: [255, 255, 255],
      colorMode: 'solid', fashionAttributes: null, confidence: 0.9, model: 'e2e-mock', candidates: [],
      cutoutImageBase64: onePixelPng.toString('base64'), cutoutMimeType: 'image/png',
    } } }) })
    active -= 1
    completed += 1
  })
  await page.goto('/closet')
  await selectWardrobePhoto(page, 3)
  await expect.poll(() => completed).toBe(3)
  expect(peak).toBe(1)
  expect(mockApi.operations).not.toContain('RemoveWardrobeImageBackground')
  await expect(page.getByRole('dialog', { name: '옷 여러 벌 등록' })).toBeVisible()
})

test('세 장 중 일시 실패한 사진만 원본 선택 없이 다시 등록할 수 있다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  const requests: string[] = []
  await page.route('**/graphql', async (route) => {
    const { query, variables } = route.request().postDataJSON()
    if (!query.includes('mutation ClassifyWardrobeImage')) {
      await route.fallback()
      return
    }

    const filename = variables.input.filename as string
    const firstAttempt = !requests.includes(filename)
    requests.push(filename)
    if (filename === 'e2e-shirt-1.png' && firstAttempt) {
      await route.fulfill({ json: { errors: [{ message: '다른 AI 작업이 진행 중이에요.', extensions: { code: 'AI_BUSY' } }] } })
      return
    }
    await route.fulfill({ json: { data: { classifyWardrobeImage: {
      category: 'top', categoryLabel: '상의', subcategory: 'shirt', subcategoryLabel: '셔츠',
      suggestedName: filename, colorName: '네이비', colorDetailName: '네이비', colorHex: '#24364a',
      colorRgb: [36, 54, 74], colorMode: 'solid', fashionAttributes: null,
      confidence: 0.9, model: 'e2e-mock', candidates: [],
      cutoutImageBase64: onePixelPng.toString('base64'), cutoutMimeType: 'image/png',
    } } } })
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/closet')
  await selectWardrobePhoto(page, 3)
  const dialog = page.getByRole('dialog', { name: '옷 여러 벌 등록' })
  const failure = page.getByRole('dialog', { name: '사진을 처리하지 못했어요' })
  await expect(dialog.getByRole('textbox', { name: '아이템 이름' })).toHaveCount(2)
  await expect(failure).toHaveCount(0)
  await dialog.getByRole('group', { name: '선택한 옷의 계절' }).getByRole('button', { name: '봄' }).click()
  await dialog.getByRole('button', { name: '선택한 2벌 저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)

  const retry = failure.getByRole('button', { name: 'e2e-shirt-1.png 다시 시도' })
  await expect(retry).toBeVisible()
  await expect(failure.getByText('다른 AI 작업이 진행 중이에요.', { exact: true })).toBeVisible()
  await retry.click()
  await expect(dialog.getByRole('textbox', { name: '아이템 이름' })).toHaveValue('e2e-shirt-1.png')
  await dialog.getByRole('group', { name: '선택한 옷의 계절' }).getByRole('button', { name: '봄' }).click()
  await dialog.getByRole('button', { name: '선택한 1벌 저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(retry).toHaveCount(0)
  expect(requests).toEqual(['e2e-shirt-0.png', 'e2e-shirt-1.png', 'e2e-shirt-2.png', 'e2e-shirt-1.png'])
  expect(mockApi.wardrobeItems.map((item) => item.name)).toEqual(expect.arrayContaining(requests))
  expect(mockApi.wardrobeItems).toHaveLength(3)
})

test('AI 사용량 제한 응답에는 추가 컷아웃 요청을 보내지 않는다', async ({ page, mockApi }) => {
  await page.route('**/graphql', async (route) => {
    if (!route.request().postDataJSON().query.includes('mutation ClassifyWardrobeImage')) {
      await route.fallback()
      return
    }
    mockApi.operations.push('ClassifyWardrobeImage')
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ errors: [{ message: 'AI 사용 횟수 제한에 도달했어요.', extensions: { code: 'AI_RATE_LIMITED' } }] }) })
  })
  await page.goto('/closet')
  await selectWardrobePhoto(page)
  await expect(page.getByText('AI 사용 횟수 제한에 도달했어요.')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'AI 분석 결과' })).toHaveCount(0)
  expect(mockApi.operations).not.toContain('RemoveWardrobeImageBackground')
})

test('여러 사진 등록에서 저장 중 Esc를 눌러도 다음 사진을 잃지 않는다', async ({ page, mockApi }) => {
  let classified = 0
  let isSaving = false
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    if (query.includes('mutation ClassifyWardrobeImage')) {
      classified += 1
      await route.fulfill({ json: { data: { classifyWardrobeImage: {
        category: 'top', categoryLabel: '상의', subcategory: 'shirt', subcategoryLabel: '셔츠',
        suggestedName: classified === 1 ? '첫 번째 셔츠' : '두 번째 셔츠',
        colorName: '네이비', colorDetailName: '네이비', colorHex: '#24364a', colorRgb: [36, 54, 74],
        colorMode: 'solid', fashionAttributes: null, confidence: 0.9, model: 'e2e-mock', candidates: [],
        cutoutImageBase64: onePixelPng.toString('base64'), cutoutMimeType: 'image/png',
      } } } })
    } else {
      if (query.includes('mutation CreateWardrobeItem')) {
        isSaving = true
        await gate
      }
      await route.fallback()
    }
  })
  try {
    await page.goto('/closet')
    await selectWardrobePhoto(page, 2)
    const dialog = page.getByRole('dialog', { name: '옷 여러 벌 등록' })
    await expect.poll(() => classified).toBe(2)
    await expect(dialog.getByRole('textbox', { name: '아이템 이름' })).toHaveCount(2)
    await dialog.getByRole('group', { name: '선택한 옷의 계절' }).getByRole('button', { name: '봄' }).click()
    await dialog.getByRole('button', { name: '선택한 2벌 저장', exact: true }).click()
    await expect.poll(() => isSaving).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialog.getByRole('textbox', { name: '아이템 이름' }).first()).toHaveValue('첫 번째 셔츠')
    await expect(dialog.getByRole('button', { name: '옷 추가 취소' })).toBeDisabled()
    release()
    await expect(dialog).toHaveCount(0)
    expect(mockApi.wardrobeItems.map((item) => item.name)).toEqual(expect.arrayContaining(['첫 번째 셔츠', '두 번째 셔츠']))
  } finally {
    release()
  }
})
