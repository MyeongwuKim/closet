import { test, expect } from './support/fixture'
import type { Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9s1gAAAABJRU5ErkJggg==',
  'base64',
)

async function selectWardrobePhoto(page: Page) {
  await page.getByRole('button', { name: '옷장에 옷 추가' }).click()

  const photoDialog = page.getByRole('dialog', { name: '옷 사진 추가' })
  await expect(photoDialog).toBeVisible()
  const fileChooserPromise = page.waitForEvent('filechooser')
  await photoDialog.getByRole('button', { name: '옷 사진 선택, 끌어다 놓기 또는 붙여넣기' }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'e2e-shirt.png',
    mimeType: 'image/png',
    buffer: onePixelPng,
  })
}

test('사진 분석 결과를 확인해 옷을 등록하고 새로고침 후에도 조회한다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []

  await page.goto('/closet')
  await expect(page.getByText('옷장이 비어 있어요')).toBeVisible()
  await selectWardrobePhoto(page)

  const classificationDialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
  await expect(classificationDialog).toBeVisible()
  await classificationDialog.getByRole('textbox', { name: '아이템 이름' }).fill('새로 등록한 셔츠')
  await classificationDialog.getByRole('group', { name: '입을 계절' }).getByRole('button', { name: '봄' }).click()
  await classificationDialog.getByRole('button', { name: '옷장에 추가' }).click()

  await expect(classificationDialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '새로 등록한 셔츠 옷 상세 보기' })).toBeVisible()
  expect(mockApi.operations).toContain('RemoveWardrobeImageBackground')
  expect(mockApi.uploadKinds).toEqual(['wardrobeCutout'])

  await page.reload()
  await expect(page.getByRole('button', { name: '새로 등록한 셔츠 옷 상세 보기' })).toBeVisible()
})

test('신규 등록 전에 배경이 제거된 옷 미리보기를 보여준다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/closet')
  await selectWardrobePhoto(page)

  const classificationDialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
  await expect(classificationDialog.getByText('AI 분석 완료')).toBeVisible()
  const preview = classificationDialog.getByRole('img', { name: '새 셔츠' })
  await expect(preview).toBeVisible()
  await expect(preview).toHaveJSProperty('naturalWidth', 280)
  expect(mockApi.operations).not.toContain('CreateWardrobeItem')
  expect(mockApi.uploadKinds).toEqual([])

  await expect(page.getByText('AI가 옷 사진을 살펴보고 있어요 👀')).toHaveCount(0)
  mkdirSync('.playwright-mcp', { recursive: true })
  await page.screenshot({ path: '.playwright-mcp/registration-cutout-preview.png', animations: 'disabled' })
})

test('AI 분류가 실패해도 컷아웃이 있으면 옷 정보를 직접 입력해 등록한다', async ({ page, mockApi }) => {
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
  expect(mockApi.uploadKinds).toEqual(['wardrobeCutout'])
})

test('배경 제거까지 실패하면 원본 사진을 옷장에 저장하지 않는다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = []
  mockApi.cutoutFailureMessage = '배경 제거 실패'

  await page.goto('/closet')
  await selectWardrobePhoto(page)

  await expect(page.getByText('사진의 배경을 제거하지 못했어요. 사진을 다시 추가해 주세요.')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'AI 분석 결과' })).toHaveCount(0)
  expect(mockApi.operations).toContain('RemoveWardrobeImageBackground')
  expect(mockApi.operations).not.toContain('CreateWardrobeItem')
  expect(mockApi.uploadKinds).toEqual([])
})

test('컷아웃이 없는 저장 후보는 업로드 전에 거절한다', async ({ page, mockApi }) => {
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

  await expect(page.getByText('사진의 배경 제거가 끝나지 않았어요. 사진을 다시 추가해 주세요.')).toBeVisible()
  await expect(classificationDialog).toBeVisible()
  expect(mockApi.operations).not.toContain('PrepareImageUpload')
  expect(mockApi.operations).not.toContain('CreateWardrobeItem')
  expect(mockApi.uploadKinds).toEqual([])
})
