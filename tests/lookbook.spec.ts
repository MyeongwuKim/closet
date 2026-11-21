import { createOutfit, expect, test } from './support/fixture'
import { mkdirSync, readFileSync } from 'node:fs'

test.describe('코디북', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    test(`${viewport.width}px: 코디를 보기로 열고 편집 취소는 초안을 버리며 저장 후 보기로 돌아간다`, async ({ page, mockApi }) => {
      await page.setViewportSize(viewport)
      await page.goto('/lookbook')
      await page.getByRole('button', { name: '기본 코디 코디 상세 보기' }).click()
      const detail = page.getByRole('dialog', { name: '기본 코디 코디 상세', exact: true })
      await expect(detail.getByRole('button', { name: /고르기|교체하기|변경사항 저장/ })).toHaveCount(0)
      const edit = detail.getByRole('button', { name: '코디 수정', exact: true })
      await edit.click()
      await expect(detail.getByRole('button', { name: '상의 교체하기', exact: true })).toBeVisible()
      const changeName = async (name: string) => {
        await detail.getByRole('button', { name: '코디 이름과 스타일 수정' }).click()
        const info = page.getByRole('dialog', { name: '코디 정보 수정', exact: true })
        await info.getByRole('textbox', { name: '코디 이름' }).fill(name)
        await info.getByRole('button', { name: '적용', exact: true }).click()
      }
      await changeName('취소할 이름')
      await detail.getByRole('button', { name: '취소', exact: true }).click()
      await expect(detail.getByRole('heading', { name: '기본 코디', exact: true })).toBeVisible()
      expect(mockApi.operations).not.toContain('UpdateOutfit')
      await edit.click()
      await changeName('저장한 코디')
      await detail.getByRole('button', { name: '변경사항 저장', exact: true }).click()
      const savedDetail = page.getByRole('dialog', { name: '저장한 코디 코디 상세', exact: true })
      await expect(savedDetail.getByRole('heading', { name: '저장한 코디', exact: true })).toBeVisible()
      await expect(savedDetail.getByRole('button', { name: '변경사항 저장', exact: true })).toHaveCount(0)
      expect(mockApi.outfits[0].name).toBe('저장한 코디')
      mkdirSync('.playwright-mcp/interface-refinements', { recursive: true })
      await page.screenshot({ path: `.playwright-mcp/interface-refinements/${viewport.width}-outfit-view.png`, animations: 'disabled' })
      await savedDetail.getByRole('button', { name: '코디 수정', exact: true }).click()
      await page.screenshot({ path: `.playwright-mcp/interface-refinements/${viewport.width}-outfit-edit.png`, animations: 'disabled' })
    })

    test(`${viewport.width}px: 저장된 AI 룩북은 잔액 없이 열고 이미지가 없을 때만 생성·사용권을 표시한다`, async ({ page, mockApi }) => {
      await page.setViewportSize(viewport)
      const imageUrl = `data:image/png;base64,${readFileSync('tests/support/mock-shirt.png').toString('base64')}`
      mockApi.outfits = [createOutfit({ generations: [{ status: 'completed', imageAsset: { deliveryUrl: imageUrl } }] })]
      await page.goto('/lookbook')
      await page.getByRole('button', { name: '기본 코디 코디 상세 보기' }).click()
      const detail = page.getByRole('dialog', { name: '기본 코디 코디 상세', exact: true })
      const view = detail.getByRole('button', { name: 'AI 룩북 보기', exact: true })
      await expect(view).toHaveText('AI 룩북 보기')
      await expect(view).not.toHaveAttribute('aria-description')
      await expect(detail.getByRole('button', { name: 'AI 사용권 안내', exact: true })).toHaveCount(0)
      mkdirSync('.playwright-mcp/ai-lookbook-button-review', { recursive: true })
      await page.screenshot({ path: `.playwright-mcp/ai-lookbook-button-review/${viewport.width}-view.png`, animations: 'disabled' })
      await view.click()
      const preview = page.getByRole('dialog', { name: 'AI 룩북', exact: true })
      await expect(preview.getByRole('img', { name: '기본 코디 AI 룩북 이미지' })).toHaveAttribute('src', imageUrl)
      await preview.getByRole('button', { name: '저장된 AI 룩북 닫기', exact: true }).click()
      expect(mockApi.operations).not.toContain('StartOutfitPreview')
      expect(mockApi.operations).not.toContain('StartPreviewReward')

      mockApi.outfits[0].generations = []
      await page.reload()
      await page.getByRole('button', { name: '기본 코디 코디 상세 보기' }).click()
      const create = detail.getByRole('button', { name: 'AI 룩북 만들기', exact: true })
      await expect(create).toHaveAttribute('aria-description', '남은 AI 사용권 5/5')
      await expect(create).toContainText('5/5')
      await expect(detail.getByRole('button', { name: 'AI 사용권 안내', exact: true })).toBeVisible()
      await expect(view).toHaveCount(0)
      await page.screenshot({ path: `.playwright-mcp/ai-lookbook-button-review/${viewport.width}-create.png`, animations: 'disabled' })
    })
  }

  for (const styles of [['캐주얼'], ['미니멀', '캐주얼']]) {
    test(`AI 룩북 생성 후 저장 화면에서 스타일을 ${styles.length}번 선택해도 이미지를 함께 저장한다`, async ({ page, mockApi }) => {
      mockApi.outfits = []
      const width = styles.length === 1 ? 390 : 1440
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      mockApi.wardrobeItems[0].name = '러프사이드 체크셔츠 라이트 올리브'
      mockApi.wardrobeItems[1].name = '레귤러 코듀로이 팬츠 (브라운)'
      const imageUrl = `data:image/png;base64,${readFileSync('tests/support/mock-shirt.png').toString('base64')}`
      mockApi.previewImages['new-look-preview'] = imageUrl
      const job = {
        id: 'new-look-job', status: 'completed', selectedItemIds: ['item-1', 'item-2'], style: null,
        imageAssetId: 'new-look-preview', model: 'fixture-model', errorCode: null, errorMessage: null,
        createdAt: new Date().toISOString(),
        path: '/lookbook/new?items=item-1,item-2&preview=open&previewAssetId=new-look-preview',
      }
      let startCalls = 0
      let finishGeneration = () => {}
      const generation = new Promise<void>(resolve => { finishGeneration = resolve })
      let createInput: Record<string, unknown> | undefined
      await page.route('**/graphql', async (route) => {
        const { query, variables } = route.request().postDataJSON()
        let data: unknown
        if (query.includes('mutation StartOutfitPreview')) {
          startCalls++
          await generation
          data = { startOutfitPreview: job }
        } else if (query.includes('query OutfitPreviewJobs')) {
          data = { outfitPreviewJobs: startCalls > 0 ? [job] : [] }
        } else if (query.includes('query OutfitPreviewJob(')) {
          data = { outfitPreviewJob: job }
        } else {
          if (query.includes('mutation CreateOutfit')) createInput = variables.input
          await route.fallback()
          return
        }
        await route.fulfill({ json: { data } })
      })

      await page.goto('/lookbook/new?items=item-1,item-2')
      await page.getByRole('button', { name: 'AI 룩북 만들기', exact: true }).click()
      const preview = page.getByRole('dialog', { name: 'AI 룩북 미리보기', exact: true })
      const loadingPreview = page.getByRole('dialog', { name: 'AI가 룩북을 만들고 있어요', exact: true })
      const closePreview = loadingPreview.getByRole('button', { name: 'AI 룩북 미리보기 닫기' })
      const progress = page.getByRole('button', { name: '진행 상태 보기', exact: true })
      try {
        await expect(loadingPreview).toHaveAttribute('aria-busy', 'true')
        await closePreview.click()
        await progress.click()
        await expect(loadingPreview).toHaveAttribute('aria-busy', 'true')
        await closePreview.click()
      } finally {
        finishGeneration()
      }
      const viewLookbook = page.getByRole('button', { name: 'AI 룩북 보기', exact: true })
      await expect(viewLookbook).toBeEnabled()
      await expect(preview).toHaveCount(0)
      await viewLookbook.click()
      expect(startCalls).toBe(1)
      await expect(preview.getByAltText('선택한 옷으로 생성한 AI 룩북 미리보기')).toHaveAttribute('src', imageUrl)
      await preview.getByRole('button', { name: '코디북에 추가', exact: true }).click()
      const save = page.getByRole('dialog', { name: '이 코디를 저장할까요?', exact: true })
      await save.getByRole('textbox', { name: '코디 이름' }).fill('AI 이미지 포함 코디')
      await expect(save.getByText('AI 룩북도 함께 저장돼요.')).toBeVisible()
      for (const style of styles) await save.getByRole('button', { name: style, exact: true }).click()
      await expect(save.getByText('AI 룩북도 함께 저장돼요.')).toBeVisible()
      await save.getByText('IN THIS LOOK', { exact: true }).scrollIntoViewIfNeeded()
      mkdirSync('.playwright-mcp/layout-review', { recursive: true })
      await page.screenshot({ path: `.playwright-mcp/layout-review/save-${width}.png`, animations: 'disabled' })
      await save.getByRole('button', { name: 'AI 룩북과 함께 저장', exact: true }).click()

      await expect(page).toHaveURL('/lookbook')
      expect(createInput?.previewImageAssetId).toBe('new-look-preview')
      await expect(page.getByAltText('AI 이미지 포함 코디 AI 룩북 이미지')).toBeVisible()
      await page.reload()
      await expect(page.getByAltText('AI 이미지 포함 코디 AI 룩북 이미지')).toBeVisible()
      expect(mockApi.outfits[0].generations[0].imageAsset?.id).toBe('new-look-preview')

      let releaseLoading = () => {}
      const loading = new Promise<void>((resolve) => { releaseLoading = resolve })
      await page.route('**/graphql', async (route) => {
        const { query, variables } = route.request().postDataJSON()
        if (query.includes('query Outfits(') && variables?.wardrobeItemIds?.includes('item-1')) await loading
        await route.fallback()
      })
      try {
        await page.goto('/closet/item-1')
        const related = page.getByRole('region', { name: '이 아이템이 포함된 코디' })
        await expect(related.getByRole('status', { name: '저장한 코디를 불러오는 중' })).toBeVisible()
        await related.scrollIntoViewIfNeeded()
        await page.screenshot({ path: `.playwright-mcp/layout-review/loading-${width}.png`, animations: 'disabled' })
        releaseLoading()
        await expect(related.getByRole('status')).toHaveCount(0)
        await expect(related.getByRole('button', { name: 'AI 이미지 포함 코디 코디 상세 보기' })).toBeVisible()
      } finally {
        releaseLoading()
      }
    })
  }

  test('옷장에서 두 아이템을 골라 AI 룩북 없이 저장하고 새로고침 후 조회한다', async ({ page, mockApi }) => {
    mockApi.outfits = []

    await page.goto('/closet')
    await expect(page.getByRole('button', { name: '테스트 셔츠 옷 상세 보기' })).toBeVisible()
    await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '코디북' }).click()
    await page.getByRole('button', { name: '새 코디 만들기' }).click()

    const composer = page.getByRole('dialog', { name: '코디 맞춰보기' })
    await composer.getByRole('button', { name: '테스트 셔츠 코디에 추가' }).click()
    await composer.getByRole('button', { name: '하의 아이템 고르기' }).click()
    await composer.getByRole('button', { name: '테스트 바지 코디에 추가' }).click()
    await composer.getByRole('button', { name: '코디 저장하기' }).click()

    const saveDialog = page.getByRole('dialog', { name: '이 코디를 저장할까요?' })
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

  test('같은 조합은 목록 첫 페이지에 없어도 기존 코디 상세를 바로 연다', async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const duplicate = mockApi.outfits[0]
    await page.route('**/graphql', async (route) => {
      const { query } = route.request().postDataJSON()
      if (query.includes('query OutfitPage')) {
        await route.fulfill({ json: { data: { outfitPage: { items: [], totalCount: 1, hasNextPage: false, nextCursor: null } } } })
      } else await route.fallback()
    })

    await page.goto('/lookbook/new?items=item-1,item-2')
    const composer = page.getByRole('dialog', { name: '코디 맞춰보기' })
    const existingOutfitLink = composer.getByRole('link', { name: '기존 코디 열기' })
    await expect(existingOutfitLink).toBeVisible()
    await expect(composer.getByRole('button', { name: '코디 저장하기' })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('open-existing-outfit.png'), animations: 'disabled' })
    await existingOutfitLink.click()
    await expect(page.getByRole('dialog', { name: `${duplicate.name} 코디 상세` })).toBeVisible()
    expect(mockApi.operations).toContain('Outfit')
    expect(mockApi.operations).not.toContain('CreateOutfit')
    await page.getByRole('button', { name: '코디북으로 돌아가기' }).click()
    await expect(page).toHaveURL('/lookbook')
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
    await page.getByRole('button', { name: '코디북 필터', exact: true }).click()
    const viewSwitch = page.getByRole('switch', { name: 'AI 룩북으로 보기' })
    await expect(viewSwitch).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: '코디 보기', exact: true }).click()
    await expect(page.getByRole('img', { name: '기본 코디 AI 룩북 이미지' })).toBeVisible()

    await page.getByRole('button', { name: '코디북 필터', exact: true }).click()
    await viewSwitch.click()
    await expect(viewSwitch).toHaveAttribute('aria-checked', 'false')
    await expect(page).toHaveURL(/\/lookbook\?view=items$/)
    await page.getByRole('button', { name: '코디 보기', exact: true }).click()
    await expect(page.getByLabel('기본 코디 코디 아이템')).toBeVisible()
    await expect(page.getByRole('img', { name: '기본 코디 AI 룩북 이미지' })).toHaveCount(0)

    await page.reload()
    await page.getByRole('button', { name: '코디북 필터', exact: true }).click()
    await expect(viewSwitch).toHaveAttribute('aria-checked', 'false')
    await page.getByRole('button', { name: '코디 보기', exact: true }).click()
    await expect(page.getByLabel('기본 코디 코디 아이템')).toBeVisible()
  })

  test('코디 이름을 수정하면 목록과 다시 연 상세 화면에 반영된다', async ({ page, mockApi }) => {
    await page.goto('/lookbook')
    await page.getByRole('button', { name: '기본 코디 코디 상세 보기' }).click()

    const detail = page.getByRole('dialog', { name: '기본 코디 코디 상세' })
    await detail.getByRole('button', { name: '코디 수정', exact: true }).click()
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
