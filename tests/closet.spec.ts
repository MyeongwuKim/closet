import { test, expect, createWardrobeItem } from './support/fixture'

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
})
