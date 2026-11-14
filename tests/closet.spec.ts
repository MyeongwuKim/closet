import { test, expect, createWardrobeItem } from './support/fixture'
import { readFileSync } from 'node:fs'

test.describe('옷장', () => {
  test('계절·카테고리·검색 조건을 적용하고 새로고침 후에도 유지한다', async ({ page, mockApi }) => {
    mockApi.wardrobeItems = [
      createWardrobeItem({ id: 'spring-shirt', name: '봄 셔츠', category: 'top', subcategory: '셔츠', seasons: ['spring'] }),
      createWardrobeItem({ id: 'winter-pants', name: '겨울 바지', category: 'bottom', subcategory: '슬랙스', seasons: ['winter'] }),
    ]

    await page.goto('/closet')
    await expect(page.getByRole('button', { name: '봄 셔츠 옷 상세 보기' })).toBeVisible()
    await expect(page.getByRole('button', { name: '겨울 바지 옷 상세 보기' })).toBeVisible()

    await page.getByRole('radiogroup', { name: '계절 필터' }).getByRole('radio', { name: '봄' }).click()
    await expect(page).toHaveURL(/\/closet\?season=spring/)
    await expect(page.getByRole('button', { name: '봄 셔츠 옷 상세 보기' })).toBeVisible()
    await expect(page.getByRole('button', { name: '겨울 바지 옷 상세 보기' })).toHaveCount(0)

    await page.getByRole('button', { name: '옷장 검색', exact: true }).click()
    await page.getByRole('searchbox', { name: '옷장 검색어' }).fill('봄 셔츠')
    await expect(page).toHaveURL(/(?:\?|&)q=%EB%B4%84\+%EC%85%94%EC%B8%A0/)
    await expect(page.getByRole('button', { name: '봄 셔츠 옷 상세 보기' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('radiogroup', { name: '계절 필터' }).getByRole('radio', { name: '봄' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('searchbox', { name: '옷장 검색어' })).toHaveValue('봄 셔츠')
    await expect(page.getByRole('button', { name: '봄 셔츠 옷 상세 보기' })).toBeVisible()
    await expect(page.getByRole('button', { name: '겨울 바지 옷 상세 보기' })).toHaveCount(0)

    await page.getByRole('button', { name: '옷장 검색 닫기' }).click()
    await page.getByRole('radiogroup', { name: '계절 필터' }).getByRole('radio', { name: '전체' }).click()
    await expect(page).toHaveURL('/closet')
    await page.getByLabel('옷 카테고리').getByRole('button', { name: '상의' }).click()
    await expect(page).toHaveURL(/(?:\?|&)category=top/)
    await expect(page.getByRole('button', { name: '봄 셔츠 옷 상세 보기' })).toBeVisible()
    await expect(page.getByRole('button', { name: '겨울 바지 옷 상세 보기' })).toHaveCount(0)
  })

  test('옷 정보를 수정하면 목록과 새로고침한 상세 화면에 반영된다', async ({ page, mockApi }) => {
    mockApi.wardrobeItems = [createWardrobeItem()]

    await page.goto('/closet')
    await page.getByRole('button', { name: '테스트 셔츠 옷 상세 보기' }).click()
    await expect(page.getByRole('dialog', { name: '테스트 셔츠 상세' })).toBeVisible()

    await page.getByRole('button', { name: '옷 정보 수정' }).click()
    const editDialog = page.getByRole('dialog', { name: '옷 정보 수정' })
    await editDialog.getByRole('textbox', { name: '아이템 이름' }).fill('수정한 셔츠')
    await editDialog.getByRole('button', { name: '변경사항 저장' }).click()

    await expect(editDialog).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: '수정한 셔츠 상세' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('dialog', { name: '수정한 셔츠 상세' })).toBeVisible()

    await page.getByRole('button', { name: '내 옷장으로 돌아가기' }).click()
    await expect(page.getByRole('button', { name: '수정한 셔츠 옷 상세 보기' })).toBeVisible()
  })

  test('기존 사진에서 찾은 형태를 저장하면 색이 다른 새 옷과 겹치는 후보로 표시된다', async ({ page, mockApi }) => {
    const photo = readFileSync('tests/support/mock-shirt.png')
    const originalPhotoUrl = 'https://closet-test.invalid/original.png'
    const displayPhotoUrl = 'https://closet-test.invalid/display.png'
    const legacyJacket = createWardrobeItem({
      id: 'legacy-jacket', name: '아이보리 재킷', brandName: '러프사이드',
      category: 'outer', subcategory: '재킷',
      colorName: '아이보리', colorDetailName: '웜 아이보리', colorHex: '#f2eee8',
      seasons: ['spring', 'fall'], tags: ['출근'], sizeLabel: '2', chestWidthCm: 60,
      originalImageAsset: { deliveryUrl: originalPhotoUrl },
      displayImageAsset: { deliveryUrl: displayPhotoUrl },
    })
    mockApi.wardrobeItems = [legacyJacket]

    const shape = {
      silhouette: 'relaxed', necklineStyle: 'collar', frontOpeningStyle: 'zipper', pocketStyle: 'patch',
    }
    await page.route('https://closet-test.invalid/*.png', (route) => route.fulfill({
      contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: photo,
    }))
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (!query.includes('mutation ClassifyWardrobeImage')) {
        await route.fallback()
        return
      }
      expect(variables.input).toMatchObject({
        mimeType: 'image/png', imageBase64: `data:image/png;base64,${photo.toString('base64')}`,
      })
      await route.fulfill({ json: { data: { classifyWardrobeImage: {
        category: 'outer', categoryLabel: '아우터', subcategory: 'jacket', subcategoryLabel: '재킷',
        suggestedName: '새 네이비 재킷', colorName: '네이비', colorDetailName: '네이비',
        colorHex: '#24364a', colorRgb: [36, 54, 74], colorMode: 'solid',
        fashionAttributes: {
          layerRole: 'outer', material: 'cotton', texture: 'smooth', pattern: 'solid',
          warmth: 'medium', formality: 0.6, confidence: 0.95, ...shape,
        },
        confidence: 0.95, model: 'e2e-mock', candidates: [], cutoutImageBase64: null, cutoutMimeType: null,
      } } } })
    })

    await page.goto('/closet/legacy-jacket')
    await page.getByRole('button', { name: '옷 정보 수정' }).click()
    const editDialog = page.getByRole('dialog', { name: '옷 정보 수정' })
    const originalRequest = page.waitForRequest((request) => (
      request.url() === originalPhotoUrl && request.resourceType() === 'fetch'
    ))
    await editDialog.getByRole('button', { name: '기존 사진으로 형태 분석' }).click()
    await originalRequest
    await expect(editDialog.getByText('형태 정보를 찾았어요. 저장하면 옷장에 반영돼요.')).toBeVisible()
    expect(mockApi.operations).not.toContain('UpdateWardrobeItem')
    expect(mockApi.wardrobeItems[0].fashionAttributes).toBeNull()

    await editDialog.getByRole('button', { name: '변경사항 저장' }).click()
    await expect(editDialog).toHaveCount(0)
    expect(mockApi.wardrobeItems).toEqual([{ ...legacyJacket, fashionAttributes: expect.objectContaining(shape) }])

    await page.getByRole('button', { name: '내 옷장으로 돌아가기' }).click()
    await page.getByRole('button', { name: '옷장에 옷 추가' }).click()
    const photoDialog = page.getByRole('dialog', { name: '옷 사진 추가' })
    const chooser = page.waitForEvent('filechooser')
    await photoDialog.getByRole('button', { name: '옷 사진 선택, 끌어다 놓기 또는 붙여넣기' }).click()
    await (await chooser).setFiles({ name: 'navy-jacket.png', mimeType: 'image/png', buffer: photo })

    const analysisDialog = page.getByRole('dialog', { name: 'AI 분석 결과' })
    const match = analysisDialog.getByRole('button', { name: '아이보리 재킷 상세정보 보기' })
    await expect(match).toContainText(/형태 \d+%/)
    await expect(match).toContainText('색상 다름')
  })

  test('옷을 보관 삭제하면 목록에서 사라지고 새로고침 후에도 다시 나타나지 않는다', async ({ page, mockApi }) => {
    mockApi.wardrobeItems = [
      createWardrobeItem(),
      createWardrobeItem({ id: 'item-2', name: '남길 바지', category: 'bottom', subcategory: '슬랙스' }),
    ]

    await page.goto('/closet')
    await page.getByRole('button', { name: '테스트 셔츠 옷 상세 보기' }).click()
    await page.getByRole('button', { name: '옷장에서 삭제', exact: true }).click()
    const confirm = page.getByRole('alertdialog', { name: '옷장에서 삭제할까요?' })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: '옷장에서 삭제' }).click()

    await expect(page).toHaveURL('/closet')
    await expect(page.getByRole('button', { name: '테스트 셔츠 옷 상세 보기' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '남길 바지 옷 상세 보기' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: '테스트 셔츠 옷 상세 보기' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '남길 바지 옷 상세 보기' })).toBeVisible()
  })

  test('코디로 선택한 옷을 삭제하면 선택도 비우고 같은 종류의 다른 옷을 고를 수 있다', async ({ page, mockApi }) => {
    mockApi.wardrobeItems = [
      createWardrobeItem({ name: '삭제할 셔츠' }),
      createWardrobeItem({ id: 'item-2', name: '남겨둘 셔츠' }),
    ]
    await page.goto('/closet')
    await page.getByRole('button', { name: '삭제할 셔츠 코디로 선택' }).click()
    await expect(page.getByRole('button', { name: '선택한 옷 모두 해제' })).toBeVisible()
    await page.getByRole('button', { name: '삭제할 셔츠 옷 상세 보기' }).click()
    await page.getByRole('button', { name: '옷장에서 삭제', exact: true }).click()
    await page.getByRole('alertdialog', { name: '옷장에서 삭제할까요?' }).getByRole('button', { name: '옷장에서 삭제' }).click()
    await expect(page).toHaveURL('/closet')
    await expect(page.getByRole('button', { name: '선택한 옷 모두 해제' })).toHaveCount(0)
    await page.getByRole('button', { name: '남겨둘 셔츠 코디로 선택' }).click()
    await expect(page.getByRole('button', { name: '남겨둘 셔츠 선택 해제' })).toBeVisible()
    await expect(page.getByText('상의는 한 개만 선택할 수 있어요.', { exact: true })).toHaveCount(0)
  })

  test('캐시 없는 상세 조회 실패는 화면을 유지하며 다시 시도할 수 있다', async ({ page, mockApi }) => {
    mockApi.wardrobeItems = []
    mockApi.outfits = []
    let shouldFail = true
    await page.route('**/graphql', async (route) => {
      if (route.request().postDataJSON().query.includes('query WardrobeItem(') && shouldFail) {
        await route.fulfill({ json: { errors: [{ message: '테스트 상세 조회 오류' }] } })
      } else await route.fallback()
    })
    await page.goto('/closet/retry-shirt')
    const errorDialog = page.getByRole('dialog', { name: '옷 상세 조회 오류' })
    await expect(errorDialog.getByRole('heading', { name: '옷을 불러오지 못했어요' })).toBeVisible()
    await expect(page).toHaveURL('/closet/retry-shirt')
    shouldFail = false
    mockApi.wardrobeItems = [createWardrobeItem({ id: 'retry-shirt', name: '다시 불러온 셔츠' })]
    await errorDialog.getByRole('button', { name: '다시 시도', exact: true }).click()
    await expect(page.getByRole('dialog', { name: '다시 불러온 셔츠 상세' })).toBeVisible()
  })

  test('삭제되거나 접근할 수 없는 상세는 일시 오류와 구분해 돌아갈 수 있다', async ({ page, mockApi }) => {
    mockApi.wardrobeItems = []
    mockApi.outfits = []
    await page.route('**/graphql', async (route) => {
      if (route.request().postDataJSON().query.includes('query WardrobeItem(')) {
        await route.fulfill({ json: { errors: [{ message: '옷장 아이템을 찾을 수 없어요.', extensions: { code: 'WARDROBE_ITEM_NOT_FOUND' } }] } })
      } else await route.fallback()
    })
    await page.goto('/closet/missing-shirt')
    const dialog = page.getByRole('dialog', { name: '옷 상세 조회 오류' })
    await expect(dialog.getByRole('heading', { name: '옷을 찾을 수 없어요' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '다시 시도', exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: '내 옷장으로 돌아가기' }).click()
    await expect(page).toHaveURL('/closet')
  })
})
