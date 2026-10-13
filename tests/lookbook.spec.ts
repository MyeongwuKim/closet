import { createOutfit, expect, test } from './support/fixture'

test.describe('코디북', () => {
  test('옷장에서 두 아이템을 골라 AI 룩 없이 저장하고 새로고침 후 조회한다', async ({ page, mockApi }) => {
    mockApi.outfits = []

    await page.goto('/closet')
    await expect(page.getByRole('button', { name: '테스트 셔츠 옷 상세 보기' })).toBeVisible()
    await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '코디북' }).click()
    await page.getByRole('button', { name: '새 코디 만들기' }).click()

    const composer = page.getByRole('dialog', { name: '코디 맞춰보기' })
    await composer.getByRole('button', { name: '테스트 셔츠 Look에 추가' }).click()
    await composer.getByRole('button', { name: '하의 아이템 고르기' }).click()
    await composer.getByRole('button', { name: '테스트 바지 Look에 추가' }).click()
    await composer.getByRole('button', { name: 'Look 확인하기' }).click()

    const saveDialog = page.getByRole('dialog', { name: '이 Look으로 저장할까요?' })
    await saveDialog.getByRole('textbox', { name: '코디 이름' }).fill('새 테스트 코디')
    await saveDialog.getByRole('button', { name: '캐주얼' }).click()
    await expect(saveDialog.getByRole('group', { name: '입을 계절' }).getByRole('button', { name: '봄' })).toHaveAttribute('aria-pressed', 'true')
    await saveDialog.getByRole('button', { name: '코디북에 저장' }).click()

    await expect(page).toHaveURL('/lookbook')
    await expect(page.getByRole('button', { name: '새 테스트 코디 코디 상세 보기' })).toBeVisible()
    expect(mockApi.outfits).toHaveLength(1)
    expect(mockApi.outfits[0].items.map((item) => item.wardrobeItemId)).toEqual(['item-1', 'item-2'])
    expect(mockApi.operations).toContain('CreateOutfit')
    expect(mockApi.operations).not.toContain('GenerateOutfitPreview')

    await page.reload()
    await expect(page.getByRole('button', { name: '새 테스트 코디 코디 상세 보기' })).toBeVisible()
  })

  test('계절·스타일·검색 조건으로 저장한 코디를 찾는다', async ({ page, mockApi }) => {
    mockApi.outfits = [
      createOutfit(),
      createOutfit({
        id: 'outfit-2',
        name: '여름 클래식 코디',
        style: 'classic',
        seasons: ['summer'],
        createdAt: '2026-08-01T00:00:00.000Z',
      }),
    ]

    await page.goto('/lookbook')
    const springOutfit = page.getByRole('button', { name: '기본 코디 코디 상세 보기' })
    const summerOutfit = page.getByRole('button', { name: '여름 클래식 코디 코디 상세 보기' })
    await expect(springOutfit).toBeVisible()
    await expect(summerOutfit).toBeVisible()

    await page.getByRole('radiogroup', { name: '계절 필터' }).getByRole('radio', { name: '여름' }).click()
    await expect(summerOutfit).toBeVisible()
    await expect(springOutfit).toHaveCount(0)

    const styleFilter = page.locator('[aria-label="코디 스타일 필터"]')
    await styleFilter.getByRole('button', { name: '캐주얼' }).click()
    await expect(page.getByText('여름 코디가 없어요')).toBeVisible()
    await styleFilter.getByRole('button', { name: '클래식' }).click()
    await expect(summerOutfit).toBeVisible()

    await page.getByRole('button', { name: '코디 검색' }).click()
    await page.getByRole('searchbox', { name: '코디 검색어' }).fill('존재하지 않는 코디')
    await expect(page.getByText('검색 결과가 없어요')).toBeVisible()
    await page.getByRole('searchbox', { name: '코디 검색어' }).fill('여름 클래식')
    await expect(summerOutfit).toBeVisible()
  })

  test('AI 룩북 보기 옵션을 전환하고 새로고침 후에도 유지한다', async ({ page, mockApi }) => {
    mockApi.outfits = [createOutfit({
      generations: [{
        status: 'completed',
        imageAsset: {
          deliveryUrl: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E',
        },
      }],
    })]

    await page.goto('/lookbook')
    const viewSwitch = page.getByRole('switch', { name: 'AI 룩북으로 보기' })
    await expect(viewSwitch).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('img', { name: '기본 코디 AI 룩북 이미지' })).toBeVisible()

    await viewSwitch.click()
    await expect(viewSwitch).toHaveAttribute('aria-checked', 'false')
    await expect(page).toHaveURL(/\/lookbook\?view=items$/)
    await expect(page.getByLabel('기본 코디 코디 아이템')).toBeVisible()
    await expect(page.getByRole('img', { name: '기본 코디 AI 룩북 이미지' })).toHaveCount(0)

    await page.reload()
    await expect(viewSwitch).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByLabel('기본 코디 코디 아이템')).toBeVisible()
  })

  test('코디 이름을 수정하면 목록과 다시 연 상세 화면에 반영된다', async ({ page, mockApi }) => {
    await page.goto('/lookbook')
    await page.getByRole('button', { name: '기본 코디 코디 상세 보기' }).click()

    const detail = page.getByRole('dialog', { name: '기본 코디 코디 상세' })
    await detail.getByRole('button', { name: '코디 이름과 스타일 수정' }).click()
    const infoDialog = page.getByRole('dialog', { name: '코디 정보 수정' })
    await infoDialog.getByRole('textbox', { name: '코디 이름' }).fill('수정한 코디')
    await infoDialog.getByRole('button', { name: '적용' }).click()
    await detail.getByRole('button', { name: '변경사항 저장' }).click()

    await expect.poll(() => mockApi.outfits[0]?.name).toBe('수정한 코디')
    await page.getByRole('button', { name: '코디북으로 돌아가기' }).click()
    await expect(page.getByRole('button', { name: '수정한 코디 코디 상세 보기' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: '수정한 코디 코디 상세 보기' })).toBeVisible()
    await page.getByRole('button', { name: '수정한 코디 코디 상세 보기' }).click()
    await expect(page.getByRole('dialog', { name: '수정한 코디 코디 상세' })).toBeVisible()
  })

  test('삭제 확인을 취소할 수 있고 확인하면 코디북에서 제거된다', async ({ page, mockApi }) => {
    await page.goto('/lookbook')
    await page.getByRole('button', { name: '기본 코디 코디 상세 보기' }).click()
    const detail = page.getByRole('dialog', { name: '기본 코디 코디 상세' })

    await detail.getByRole('button', { name: '코디북에서 삭제' }).click()
    const confirmDialog = page.getByRole('alertdialog', { name: '코디북에서 삭제할까요?' })
    await confirmDialog.getByRole('button', { name: '취소' }).click()
    await expect(detail).toBeVisible()
    expect(mockApi.outfits).toHaveLength(1)

    await detail.getByRole('button', { name: '코디북에서 삭제' }).click()
    await confirmDialog.getByRole('button', { name: '코디 삭제' }).click()
    await expect(page.getByRole('button', { name: '기본 코디 코디 상세 보기' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: '아직 저장한 코디가 없어요' })).toBeVisible()
    expect(mockApi.outfits).toHaveLength(0)
  })
})
