import { mkdirSync } from 'node:fs'
import { createOutfit, createWardrobeItem, expect, test } from './support/fixture'

test.use({ reducedMotion: 'reduce' })

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 코디북 제목 옆 필터에서 정렬·색상을 고르고 기존 계절·스타일·보기를 유지한다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    mockApi.wardrobeItems = [
      createWardrobeItem(),
      createWardrobeItem({ id: 'item-2', colorName: '베이지', colorHex: '#c4b393' }),
    ]
    mockApi.outfits = [
      createOutfit({ name: '네이비 코디', items: [{ wardrobeItemId: 'item-1', layerOrder: 0 }] }),
      createOutfit({ id: 'outfit-2', name: '베이지 코디', items: [{ wardrobeItemId: 'item-2', layerOrder: 0 }] }),
    ]
    const requests: Array<Record<string, unknown>> = []
    page.on('request', (request) => {
      if (!request.url().endsWith('/graphql') || request.method() !== 'POST') return
      const { query, variables } = request.postDataJSON()
      if (query.includes('query OutfitPage(')) requests.push(variables.input)
    })
    await page.goto('/lookbook?view=items')
    await page.getByRole('radiogroup', { name: '계절 필터' }).getByRole('radio', { name: '봄' }).click()
    await page.locator('[aria-label="코디 스타일 필터"]').getByRole('button', { name: '캐주얼', exact: true }).click()
    const trigger = page.getByRole('button', { name: '코디북 필터', exact: true })
    await expect(page.getByRole('switch', { name: 'AI 룩북으로 보기' })).toHaveCount(0)
    await expect(trigger.locator('xpath=ancestor::header')).toHaveCount(1)
    await expect(page.getByRole('button', { name: /^최신순 정렬 중/ })).toHaveCount(0)
    await trigger.click()
    const drawer = page.getByRole('dialog', { name: '코디북 필터', exact: true })
    const height = (await drawer.boundingBox())!.height
    await expect(drawer.getByRole('button', { name: '코디북 필터 닫기' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(drawer.getByRole('button', { name: '코디 보기', exact: true })).toBeFocused()
    await drawer.getByRole('button', { name: '베이지', exact: true }).click()
    await drawer.getByRole('button', { name: '오래된순', exact: true }).click()
    await expect(drawer.getByRole('button', { name: '오래된순', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(drawer.getByRole('button', { name: '베이지', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const viewSwitch = drawer.getByRole('switch', { name: 'AI 룩북으로 보기' })
    await expect(viewSwitch).toHaveAttribute('aria-checked', 'false')
    await viewSwitch.click()
    await expect(viewSwitch).toHaveAttribute('aria-checked', 'true')
    await expect(page).toHaveURL('/lookbook?sort=oldest')
    await expect(drawer.getByRole('button', { name: '베이지', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await viewSwitch.click()
    await expect(viewSwitch).toHaveAttribute('aria-checked', 'false')
    expect((await drawer.boundingBox())!.height).toBe(height)
    await expect(page).toHaveURL(/sort=oldest/)
    mkdirSync('.playwright-mcp/catalog-filter-height-review', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/catalog-filter-height-review/${viewport.width}-lookbook-filter.png` })
    await drawer.getByRole('button', { name: '코디 보기', exact: true }).click()
    await expect(trigger).toBeFocused()
    await expect(page.getByRole('button', { name: '베이지 코디 코디 상세 보기' })).toBeVisible()
    await expect(page.getByRole('button', { name: '네이비 코디 코디 상세 보기' })).toHaveCount(0)
    await page.screenshot({ path: `.playwright-mcp/catalog-filter-height-review/${viewport.width}-lookbook.png` })
    expect(requests.at(-1)).toMatchObject({ season: 'spring', style: 'casual', color: '베이지', sort: 'oldest' })
    await trigger.click()
    await drawer.getByRole('button', { name: '초기화', exact: true }).click()
    await expect(drawer.getByRole('button', { name: '전체 색상', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(drawer.getByRole('button', { name: '최신순', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(viewSwitch).toHaveAttribute('aria-checked', 'false')
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(page.getByRole('button', { name: '네이비 코디 코디 상세 보기' })).toBeVisible()
    await expect(page).toHaveURL('/lookbook?view=items')
    await expect(page.getByRole('radiogroup', { name: '계절 필터' }).getByRole('radio', { name: '봄' })).toBeChecked()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
