import { test, expect, createWardrobeItem } from './support/fixture'
import { mkdirSync, readFileSync } from 'node:fs'

test.use({ reducedMotion: 'reduce' })

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 세부 필터를 한 서랍에서 고르고 새로고침·초기화하며 상단 계절·종류·검색은 유지한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    const image = (path: string) => ({ deliveryUrl: `data:image/png;base64,${readFileSync(path).toString('base64')}` })
    mockApi.wardrobeItems = [
      createWardrobeItem({ name: '네이비 셔츠', brandName: 'COS', tags: ['출근'], displayImageAsset: image('tests/support/mock-shirt.png') }),
      createWardrobeItem({ id: 'item-2', name: '베이지 팬츠', category: 'bottom', subcategory: '팬츠', brandName: 'COS', colorName: '베이지', colorHex: '#c4b393', tags: ['출근'] }),
      createWardrobeItem({ id: 'item-3', name: '가을 재킷', category: 'outer', subcategory: '재킷', brandName: '다른 브랜드', seasons: ['autumn'], tags: ['주말'] }),
    ]
    const requests: Array<Record<string, unknown>> = []
    page.on('request', (request) => {
      if (!request.url().endsWith('/graphql') || request.method() !== 'POST') return
      const { query, variables } = request.postDataJSON()
      if (query.includes('query WardrobePage(')) requests.push(variables.input)
    })
    await page.goto('/closet')
    await expect(page.getByRole('button', { name: '네이비 셔츠 옷 상세 보기' })).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: '계절 필터' })).toBeVisible()
    await expect(page.getByLabel('옷 카테고리').getByRole('button', { name: '상의', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '브랜드 필터', exact: true })).toHaveCount(0)
    await expect(page.getByText('태그로 빠르게 보기', { exact: true })).toHaveCount(0)
    mkdirSync('.playwright-mcp/catalog-ui-review', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/catalog-ui-review/${viewport.width}-closet-filters.png`, animations: 'disabled' })
    await testInfo.attach('closet-consolidated-filters', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })

    await page.getByRole('radiogroup', { name: '계절 필터' }).getByRole('radio', { name: '봄', exact: true }).click()
    await page.getByLabel('옷 카테고리').getByRole('button', { name: '상의', exact: true }).click()
    await page.getByRole('button', { name: '옷장 검색', exact: true }).click()
    await page.getByRole('searchbox', { name: '옷장 검색어' }).fill('셔츠')

    const trigger = page.getByRole('button', { name: '옷장 필터', exact: true })
    await trigger.click()
    const filters = page.getByRole('dialog', { name: '옷장 필터', exact: true })
    await filters.getByRole('button', { name: '네이비', exact: true }).click()
    await expect(filters.getByRole('button', { name: '네이비', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await filters.getByRole('tab', { name: /^브랜드/ }).click()
    await filters.getByRole('button', { name: 'COS', exact: true }).click()
    await filters.getByRole('tab', { name: /^태그/ }).click()
    await filters.getByRole('button', { name: '#출근', exact: true }).click()
    await filters.getByRole('button', { name: '오래된순', exact: true }).click()
    await expect.poll(() => requests.at(-1)).toMatchObject({
      category: 'top', season: 'spring', search: '셔츠', colors: ['네이비'], brandNames: ['COS'], tags: ['출근'], sort: 'oldest',
    })
    await testInfo.attach('closet-filter-drawer', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
    await page.screenshot({ path: `.playwright-mcp/catalog-ui-review/${viewport.width}-closet-drawer.png`, animations: 'disabled' })
    await filters.getByRole('button', { name: '옷 보기', exact: true }).click()
    await expect(filters).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(trigger).toContainText('4')
    await page.reload()
    await expect(trigger).toContainText('4')
    await expect(page.getByRole('searchbox', { name: '옷장 검색어' })).toHaveValue('셔츠')
    await trigger.click()
    await filters.getByRole('button', { name: '초기화', exact: true }).click()
    await expect.poll(() => requests.at(-1)).toMatchObject({ category: 'top', season: 'spring', search: '셔츠', colors: [], brandNames: [], tags: [], includeUnbranded: false, sort: 'latest' })
    await expect(filters.getByRole('button', { name: '초기화', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(filters).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
