import { test, expect, createWardrobeItem } from './support/fixture'

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 옷장 다음 페이지 실패 시 기존 목록을 유지하고 재시도로 나머지 옷을 표시한다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    mockApi.wardrobeItems = Array.from({ length: 21 }, (_, index) => createWardrobeItem({
      id: `page-item-${index + 1}`, name: `페이지 셔츠 ${index + 1}`,
    }))
    let failNextPage = true
    const cursors: Array<string | null> = []
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (!query.includes('query WardrobePage(')) return route.fallback()
      expect(variables.input.limit).toBe(20)
      const cursor = variables.input.cursor
      cursors.push(cursor)
      if (cursor && failNextPage) {
        await route.fulfill({ json: {
          data: null, errors: [{ message: '테스트 다음 페이지 오류', extensions: { code: 'INTERNAL_SERVER_ERROR' } }],
        } })
        return
      }
      const start = cursor ? Number(cursor) : 0
      await route.fulfill({ json: { data: { wardrobePage: {
        items: mockApi.wardrobeItems.slice(start, start + 20), totalCount: 21,
        hasNextPage: start === 0, nextCursor: start === 0 ? '20' : null,
      } } } })
    })

    await page.goto('/closet')
    await expect(page.getByRole('button', { name: '페이지 셔츠 1 옷 상세 보기', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '페이지 셔츠 20 옷 상세 보기', exact: true }).scrollIntoViewIfNeeded()
    const retry = page.getByRole('button', { name: '불러오지 못했어요 · 다시 시도', exact: true })
    await expect(retry).toBeVisible()
    await expect(page.getByRole('button', { name: '페이지 셔츠 1 옷 상세 보기', exact: true })).toHaveCount(1)
    await expect(page.getByRole('button', { name: '페이지 셔츠 21 옷 상세 보기', exact: true })).toHaveCount(0)
    failNextPage = false
    await retry.click()
    await expect(page.getByRole('button', { name: '페이지 셔츠 21 옷 상세 보기', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '더 보기', exact: true })).toHaveCount(0)
    expect(cursors[0]).toBeNull()
    expect(cursors).toContain('20')
    expect(cursors.filter((cursor) => cursor !== null).every((cursor) => cursor === '20')).toBe(true)
  })
}
