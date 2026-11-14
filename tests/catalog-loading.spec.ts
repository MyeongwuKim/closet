import { test, expect } from './support/fixture'
import { mkdirSync, writeFileSync } from 'node:fs'

test.use({ reducedMotion: 'reduce' })

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  for (const catalog of [
    { path: '/closet', module: 'closet/pages/ClosetPage.tsx', options: 'WardrobeFilterOptions', page: 'WardrobePage', loading: '옷장을 불러오는 중', routeLoading: '옷장 화면 로딩 중', card: '.collection-photo' },
    { path: '/closet?season=spring&category=top&q=테스트', module: 'closet/pages/ClosetPage.tsx', options: 'WardrobeFilterOptions', page: 'WardrobePage', loading: '옷장을 불러오는 중', routeLoading: '옷장 화면 로딩 중', card: '.collection-photo' },
    { path: '/closet?color=네이비&color=차콜', module: 'closet/pages/ClosetPage.tsx', options: 'WardrobeFilterOptions', page: 'WardrobePage', loading: '옷장을 불러오는 중', routeLoading: '옷장 화면 로딩 중', card: '.collection-photo' },
    { path: '/lookbook', module: 'lookbook/pages/LookbookPage.tsx', options: 'OutfitFilterOptions', page: 'OutfitPage', loading: '코디북을 불러오는 중', routeLoading: '코디북 화면 로딩 중', card: '.lookbook-cover-visual' },
  ]) {
    for (const optionsFirst of [true, false]) {
      test(`${viewport.width}px ${catalog.path}: ${optionsFirst ? '필터' : '목록'} 응답이 먼저 와도 코드 로딩부터 카드 위치를 유지한다`, async ({ page, mockApi }, testInfo) => {
        void mockApi
        await page.setViewportSize(viewport)
        let releaseModule!: () => void
        let releaseOptions!: () => void
        let releaseItems!: () => void
        const moduleGate = new Promise<void>((resolve) => { releaseModule = resolve })
        const optionsGate = new Promise<void>((resolve) => { releaseOptions = resolve })
        const itemsGate = new Promise<void>((resolve) => { releaseItems = resolve })
        await page.route(`**/src/features/${catalog.module}*`, async (route) => {
          await moduleGate
          await route.continue()
        })
        await page.route('**/graphql', async (route) => {
          const { query } = route.request().postDataJSON()
          if (query.includes(`query ${catalog.options}`)) await optionsGate
          if (query.includes(`query ${catalog.page}(`)) await itemsGate
          await route.fallback()
        })
        const loading = page.getByRole('status', { name: catalog.loading, exact: true })
        const top = () => page.locator(catalog.card).first().evaluate((element) => element.getBoundingClientRect().top)
        const proofDirectory = '.playwright-mcp/catalog-ui-review'
        const proofName = `${viewport.width}-${catalog.page === 'WardrobePage' ? 'closet' : 'lookbook'}${catalog.path.includes('?') ? '-search' : ''}-${optionsFirst ? 'options-first' : 'items-first'}`
        mkdirSync(proofDirectory, { recursive: true })
        try {
          await page.goto(catalog.path, { waitUntil: 'domcontentloaded' })
          await expect(loading).toBeVisible()
          const moduleTop = await top()
          if (optionsFirst && !catalog.path.includes('?')) await page.screenshot({ path: `${proofDirectory}/${proofName}-route-loading.png`, animations: 'disabled' })
          const itemsRequested = page.waitForRequest((request) => request.postData()?.includes(`query ${catalog.page}(`) ?? false)
          releaseModule()
          await itemsRequested
          await expect(page.getByLabel(catalog.routeLoading, { exact: true })).toHaveCount(0)
          const pendingTop = await top()
          if (optionsFirst && !catalog.path.includes('?')) await page.screenshot({ path: `${proofDirectory}/${proofName}-data-loading.png`, animations: 'disabled' })
          const optionsReceived = page.waitForResponse((response) => response.request().postData()?.includes(`query ${catalog.options}`) ?? false)
          await expect(page.getByRole('radiogroup', { name: '계절 필터' })).toBeVisible()
          if (optionsFirst) {
            releaseOptions()
            await optionsReceived
          } else {
            releaseItems()
            await expect(loading).toHaveCount(0)
          }
          const firstResponseTop = await top()
          if (optionsFirst) releaseItems()
          else {
            releaseOptions()
            await optionsReceived
          }
          await expect(loading).toHaveCount(0)
          await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
          const loadedTop = await top()
          const positions = { moduleTop, pendingTop, firstResponseTop, loadedTop }
          writeFileSync(`${proofDirectory}/${proofName}-positions.json`, JSON.stringify(positions))
          if (optionsFirst && !catalog.path.includes('?')) await page.screenshot({ path: `${proofDirectory}/${proofName}-loaded.png`, animations: 'disabled' })
          await testInfo.attach('catalog-card-positions', { body: JSON.stringify(positions), contentType: 'application/json' })
          await testInfo.attach('catalog-loaded', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' })
          for (const [stage, value] of Object.entries(positions)) {
            expect(Math.abs(value - loadedTop), `${stage}: ${JSON.stringify(positions)}`).toBeLessThanOrEqual(4)
          }
        } finally {
          releaseModule()
          releaseOptions()
          releaseItems()
        }
      })
    }
  }
}
