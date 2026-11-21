import { mkdirSync } from 'node:fs'
import { test, expect, createWardrobeItem } from './support/fixture'

test.use({ reducedMotion: 'reduce' })

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 필터 탭·선택·검색·초기화에도 서랍과 탭 위치를 유지한다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    mockApi.wardrobeItems = Array.from({ length: 30 }, (_, index) => createWardrobeItem({
      id: `height-${index}`, brandName: `브랜드 ${index}`, tags: [`태그 ${index}`],
    }))
    await page.goto('/closet')
    await page.getByRole('button', { name: '옷장 필터', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: '옷장 필터', exact: true })
    const geometry = () => drawer.evaluate((element) => [element, element.querySelector('[role="tablist"]')!, element.querySelector('footer > button')!].flatMap((node) => {
      const { top, height } = node.getBoundingClientRect()
      return [top, height]
    }))
    const initial = await geometry()
    await expect(drawer.getByRole('list', { name: '선택한 필터' })).toHaveCount(0)
    const expectStable = async () => {
      const current = await geometry()
      current.forEach((value, index) => expect(Math.abs(value - initial[index])).toBeLessThanOrEqual(1))
    }
    await drawer.getByRole('button', { name: '네이비', exact: true }).click()
    await expectStable()
    await expect(drawer.locator('footer').getByRole('list', { name: '선택한 필터' })).toBeVisible()
    for (const tab of ['브랜드', '태그', '색상']) {
      await drawer.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
      await expectStable()
    }
    await drawer.getByRole('tab', { name: /^브랜드/ }).click()
    await expect(drawer.getByRole('button', { name: '브랜드 29', exact: true })).toHaveCount(1)
    const panel = drawer.getByRole('tabpanel')
    expect(await panel.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
    await drawer.getByRole('searchbox').fill('없는 브랜드')
    await expect(drawer.getByText('검색한 브랜드가 없어요.')).toBeVisible()
    await expectStable()
    await drawer.getByRole('button', { name: '초기화', exact: true }).click()
    await expectStable()
    await drawer.getByRole('searchbox').fill('')
    await drawer.getByRole('button', { name: '브랜드 29', exact: true }).click()
    await expectStable()
    mkdirSync('.playwright-mcp/catalog-filter-height-review', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/catalog-filter-height-review/${viewport.width}-brands.png` })
    await drawer.getByRole('tab', { name: /^색상/ }).click()
    await expectStable()
    await page.screenshot({ path: `.playwright-mcp/catalog-filter-height-review/${viewport.width}-colors.png` })
    await page.setViewportSize({ width: viewport.width, height: 480 })
    const bounds = await drawer.boundingBox()
    expect(bounds!.height).toBeLessThanOrEqual(456)
    await drawer.getByRole('button', { name: '옷 보기', exact: true }).click()
    await expect(drawer).toHaveCount(0)
  })

  test(`${viewport.width}px: 복수 색상·브랜드·태그를 순서대로 가로에 쌓고 다시 눌러 해제·복원한다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    mockApi.wardrobeItems = [
      createWardrobeItem({ name: 'COS 네이비 셔츠', brandName: 'COS', tags: ['출근'] }),
      createWardrobeItem({ id: 'item-2', name: 'Arket 베이지 셔츠', brandName: 'Arket', colorName: '베이지', colorHex: '#c4b393', tags: ['주말'] }),
      createWardrobeItem({ id: 'item-3', name: 'COS 브라운 셔츠', brandName: 'COS', colorName: '브라운', colorHex: '#805e42', tags: ['운동'] }),
      createWardrobeItem({ id: 'item-4', name: '다른 브랜드 셔츠', brandName: '다른 브랜드', tags: ['출근'] }),
      createWardrobeItem({ id: 'item-5', name: '미지정 셔츠', tags: ['주말'] }),
    ]
    await page.goto('/closet?season=spring&category=top')
    const trigger = page.getByRole('button', { name: '옷장 필터', exact: true })
    await expect(trigger.locator('xpath=ancestor::header')).toHaveCount(1)
    await expect(page.locator('.closet-filter-row').getByRole('button', { name: '옷장 필터' })).toHaveCount(0)
    await trigger.click()
    const filters = page.getByRole('dialog', { name: '옷장 필터', exact: true })
    await filters.getByRole('button', { name: '네이비', exact: true }).click()
    await filters.getByRole('tab', { name: /^브랜드/ }).click()
    await filters.getByRole('button', { name: 'COS', exact: true }).click()
    await filters.getByRole('tab', { name: /^색상/ }).click()
    await filters.getByRole('button', { name: '베이지', exact: true }).click()
    await expect(filters.getByRole('button', { name: '네이비', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await filters.getByRole('tab', { name: /^브랜드/ }).click()
    await filters.getByRole('button', { name: 'Arket', exact: true }).click()
    await filters.getByRole('tab', { name: /^태그/ }).click()
    await filters.getByRole('button', { name: '#출근', exact: true }).click()
    await filters.getByRole('button', { name: '#주말', exact: true }).click()
    await filters.getByRole('tab', { name: /^브랜드/ }).click()
    const selected = filters.getByRole('list', { name: '선택한 필터', exact: true })
    await expect(filters.getByRole('button', { name: '브랜드 미지정', exact: true })).toHaveCount(0)
    await expect(selected.getByRole('button')).toHaveText(['네이비', 'COS', '베이지', 'Arket', '#출근', '#주말'])
    await expect.poll(() => selected.evaluate((element) => element.scrollLeft + element.clientWidth >= element.scrollWidth - 2)).toBe(true)
    mkdirSync('.playwright-mcp/catalog-multifilter-review', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/catalog-multifilter-review/${viewport.width}-drawer.png`, animations: 'disabled' })
    await filters.getByRole('button', { name: '옷 보기', exact: true }).click()
    await expect(page.getByRole('button', { name: 'COS 네이비 셔츠 옷 상세 보기' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Arket 베이지 셔츠 옷 상세 보기' })).toBeVisible()
    await expect(page.getByRole('button', { name: '미지정 셔츠 옷 상세 보기' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'COS 브라운 셔츠 옷 상세 보기' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '다른 브랜드 셔츠 옷 상세 보기' })).toHaveCount(0)
    const applied = page.getByRole('list', { name: '적용한 옷장 필터', exact: true })
    await applied.getByRole('button', { name: '네이비 색상 해제', exact: true }).click()
    await expect(page.getByRole('button', { name: 'COS 네이비 셔츠 옷 상세 보기' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Arket 베이지 셔츠 옷 상세 보기' })).toBeVisible()
    await trigger.click()
    await filters.getByRole('button', { name: '네이비', exact: true }).click()
    await expect(filters.getByRole('list', { name: '선택한 필터' }).getByRole('button').last()).toHaveText('네이비')
    await page.keyboard.press('Escape')
    await expect(filters).toHaveCount(0)
    await page.reload()
    await expect(applied.getByRole('button')).toHaveText(['COS', '베이지', 'Arket', '#출근', '#주말', '네이비'])
    await page.screenshot({ path: `.playwright-mcp/catalog-multifilter-review/${viewport.width}-closet.png`, animations: 'disabled' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('선택한 브랜드를 삭제하면 다른 브랜드 조건만 유지한다', async ({ page, mockApi }) => {
  mockApi.wardrobeItems = [createWardrobeItem({ brandName: 'COS' }), createWardrobeItem({ id: 'item-2', brandName: 'Arket' })]
  await page.goto('/closet?brand=COS&brand=Arket')
  await page.getByRole('button', { name: '옷장 필터', exact: true }).click()
  const filters = page.getByRole('dialog', { name: '옷장 필터', exact: true })
  await filters.getByRole('tab', { name: /^브랜드/ }).click()
  await filters.getByRole('button', { name: '관리', exact: true }).click()
  await filters.getByRole('button', { name: 'COS 브랜드 삭제' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(filters).toBeVisible()
  await filters.getByRole('button', { name: 'COS 브랜드 삭제' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '브랜드 삭제', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(filters.getByRole('list', { name: '선택한 필터' }).getByRole('button')).toHaveText(['Arket'])
  expect(mockApi.wardrobeItems[0].brandName).toBeNull()
  expect(mockApi.wardrobeItems[1].brandName).toBe('Arket')
})
