import { mkdirSync, readFileSync } from 'node:fs'
import { expect, test, createWardrobeItem } from './support/fixture'

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
  test(`${viewport.name}: 묻힌 옷을 먼저 보여주고 그 옷을 고정해 코디 추천으로 연결한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    const oldShirt = createWardrobeItem({ id: 'forgotten-shirt', name: '잊고 있던 네이비 셔츠', displayImageAsset: { deliveryUrl: `data:image/png;base64,${readFileSync('tests/support/mock-shirt.png').toString('base64')}` } })
    mockApi.wardrobeItems = [oldShirt,
      createWardrobeItem({ id: 'pants', name: '오래된 데님', category: 'bottom' }),
      createWardrobeItem({ id: 'jacket', name: '가을 재킷', category: 'outer' }),
    ]
    mockApi.rediscoveryItems = mockApi.wardrobeItems.map((item, index) => ({ item, reason: index === 0 ? 'no_wear_record' : 'long_unworn', daysSinceLastWorn: index === 0 ? null : 90, lastWornTemperatureC: index === 0 ? null : 12.5 }))
    const recommendationInputs: Array<{ baseItemId: string }> = []
    await page.route('**/graphql', async (route) => {
      const { query, variables } = route.request().postDataJSON()
      if (query.includes('query WardrobePage')) {
        // 하이라이트 옷은 현재 목록 페이지에 없어도 표시되고 추천 기준으로 전달되어야 한다.
        await route.fulfill({ json: { data: { wardrobePage: { items: mockApi.wardrobeItems.slice(1), totalCount: 50, hasNextPage: false, nextCursor: null } } } })
      } else if (query.includes('query TodayOutfitRecommendation')) {
        recommendationInputs.push(variables.input)
        await route.fulfill({ json: { data: { todayOutfitRecommendation: {
          date: variables.input.date, season: 'spring', ready: true, headline: '셔츠를 다시 입는 코디',
          summary: '옷장 속 셔츠를 기준으로 구성했어요.', style: null, colorScheme: 'auto', colorSchemeApplied: true,
          items: mockApi.wardrobeItems.slice(0, 2), reasons: ['등록된 옷의 색을 비교했어요.'], profileSummary: [], source: 'fallback', model: null, weather: null,
        } } } })
      } else await route.fallback()
    })
    await page.goto('/closet')
    const toggle = page.getByRole('button', { name: '잊고 있던 옷 확인하기', exact: true })
    await expect(toggle).toHaveAttribute('aria-haspopup', 'dialog')
    expect(mockApi.operations).not.toContain('WardrobeRediscovery')
    mkdirSync('.playwright-mcp/rediscovery', { recursive: true })
    await page.screenshot({ path: `.playwright-mcp/rediscovery/collapsed-${viewport.name}.png`, animations: 'disabled' })
    await toggle.click()
    await expect(page).toHaveURL(/\/closet\/rediscovery$/)
    const section = page.getByRole('dialog', { name: '잊고 있던 옷', exact: true })
    await expect(section).toBeVisible()
    await expect(section.getByText('아직 착용 기록이 없어요')).toBeVisible()
    await expect(section.getByRole('button', { name: `${oldShirt.name} 다시 보기` })).toBeInViewport()
    await expect.poll(() => mockApi.rediscoverySeenIds.includes(oldShirt.id)).toBe(true)
    await section.getByRole('button', { name: '잊고 있던 옷 닫기' }).click()
    await expect(section.getByRole('button', { name: `${oldShirt.name} 다시 보기` })).toHaveCount(0)
    await toggle.click()
    await expect(section.getByRole('button', { name: `${oldShirt.name} 다시 보기` })).toBeVisible()
    expect(mockApi.rediscoverySeenIds).not.toContain('jacket')
    await section.getByRole('button', { name: '다음 옷', exact: true }).click()
    await expect(section.getByRole('status')).toHaveText('2 / 3')
    await expect(section.getByText('그날 평균 기온').first()).toBeVisible()
    await expect(section.getByText('12.5℃', { exact: true }).first()).toBeVisible()
    await section.getByRole('button', { name: '다음 옷', exact: true }).click()
    await expect(section.getByRole('status')).toHaveText('3 / 3')
    await expect.poll(() => mockApi.rediscoverySeenIds.includes('jacket')).toBe(true)
    const rail = section.getByRole('region', { name: '잊고 있던 옷 목록' })
    await rail.focus()
    await page.keyboard.press('Home')
    await expect(section.getByRole('status')).toHaveText('1 / 3')
    await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`rediscovery-${viewport.name}.png`), animations: 'disabled' })
    await page.screenshot({ path: `.playwright-mcp/rediscovery/manual-${viewport.name}.png`, animations: 'disabled' })
    expect(mockApi.operations).not.toContain('TodayOutfitRecommendation')
    await section.getByRole('button', { name: `${oldShirt.name} 코디 추천` }).click()
    const sheet = page.getByRole('dialog', { name: '이 옷으로 AI 코디 추천' })
    await expect(sheet.getByText(oldShirt.name, { exact: true })).toBeVisible()
    await sheet.getByRole('button', { name: '봄', exact: true }).click()
    await sheet.getByRole('button', { name: /자동/ }).click()
    await expect(sheet.getByText('셔츠를 다시 입는 코디')).toBeVisible()
    expect(recommendationInputs).toHaveLength(1)
    expect(recommendationInputs[0].baseItemId).toBe(oldShirt.id)
    await sheet.getByRole('button', { name: 'AI 코디 추천 닫기' }).click()
    await section.getByRole('button', { name: `${oldShirt.name} 다시 보기` }).click()
    await expect(page.getByRole('dialog', { name: `${oldShirt.name} 상세` })).toBeVisible()
  })
}

test('검색 중에는 숨기고 조회 실패 후에는 다시 불러올 수 있다', async ({ page, mockApi }) => {
  mockApi.rediscoveryItems = [{ item: mockApi.wardrobeItems[0], reason: 'no_wear_record', daysSinceLastWorn: null }]
  let failRediscovery = true
  await page.route('**/graphql', async (route) => {
    if (route.request().postDataJSON().query.includes('query WardrobeRediscovery') && failRediscovery) {
      await route.fulfill({ json: { errors: [{ message: '일시적인 테스트 오류' }] } })
    } else await route.fallback()
  })
  await page.goto('/closet')
  await page.getByRole('button', { name: '잊고 있던 옷 확인하기', exact: true }).click()
  const section = page.getByRole('dialog', { name: '잊고 있던 옷', exact: true })
  await expect(section.getByRole('button', { name: '다시 시도' })).toBeVisible()
  failRediscovery = false
  await section.getByRole('button', { name: '다시 시도' }).click()
  await expect(section.getByRole('button', { name: '테스트 셔츠 다시 보기' })).toBeVisible()
  await section.getByRole('button', { name: '잊고 있던 옷 닫기' }).click()
  await page.getByRole('button', { name: '옷장 검색', exact: true }).click()
  await page.getByRole('searchbox', { name: '옷장 검색어' }).fill('셔츠')
  await expect(section).toHaveCount(0)
})

test('한 벌은 고정하고 0℃를 표시하며 과거 기온·착용 기록이 없으면 추정하지 않는다', async ({ page, mockApi }) => {
  mockApi.rediscoveryItems = [{ item: mockApi.wardrobeItems[0], reason: 'long_unworn', daysSinceLastWorn: 45, lastWornTemperatureC: 0 }]
  await page.goto('/closet/rediscovery')
  const dialog = page.getByRole('dialog', { name: '잊고 있던 옷', exact: true })
  await expect(dialog.getByText('45일 전', { exact: true })).toBeVisible()
  await expect(dialog.getByText('0℃', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '다음 옷' })).toHaveCount(0)
  await page.clock.install()
  await page.clock.fastForward(30_000)
  await expect(dialog.getByRole('button', { name: '테스트 셔츠 다시 보기' })).toBeVisible()
  expect(mockApi.operations).not.toContain('TodayOutfitRecommendation')
  mockApi.rediscoveryItems[0].lastWornTemperatureC = null
  await page.reload()
  await expect(dialog.getByText('45일 전', { exact: true })).toBeVisible()
  await expect(dialog.getByText('그날 평균 기온')).toHaveCount(0)
  mockApi.rediscoveryItems[0] = { item: mockApi.wardrobeItems[0], reason: 'no_wear_record', daysSinceLastWorn: null }
  await page.reload()
  await expect(dialog.getByText('아직 착용 기록이 없어요')).toBeVisible()
  await expect(dialog.getByText(/일 전/)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/closet$/)
  await expect.poll(() => page.locator('#root').evaluate((element) => (element as HTMLElement).inert)).toBe(false)
})

test('후보가 사라진 푸시 진입은 빈 화면을 안내하고 보류 설정은 목록에 즉시 반영된다', async ({ page, mockApi }) => {
  await page.goto('/closet/rediscovery')
  await expect(page.getByText('지금 다시 꺼낼 옷이 없어요')).toBeVisible()
  mockApi.rediscoveryItems = [{ item: mockApi.wardrobeItems[0], reason: 'no_wear_record', daysSinceLastWorn: null }]
  await page.reload()
  await page.getByRole('button', { name: '당분간 안 보기', exact: true }).click()
  const preference = page.getByRole('dialog', { name: '안 입는 이유', exact: true })
  await preference.getByRole('radio', { name: /사이즈가 안 맞아요/ }).click()
  await preference.getByRole('button', { name: '이유 저장' }).click()
  await expect(preference).toHaveCount(0)
  await expect(page.getByText('지금 다시 꺼낼 옷이 없어요')).toBeVisible()
  expect(mockApi.operations).not.toContain('TodayOutfitRecommendation')
})

test('옷 상세에서 돌아오면 방금 보던 카드로 복귀한다', async ({ page, mockApi }) => {
  mockApi.rediscoveryItems = mockApi.wardrobeItems.map((item) => ({ item, reason: 'no_wear_record', daysSinceLastWorn: null }))
  await page.goto('/closet/rediscovery')
  await page.getByRole('button', { name: '다음 옷', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('2 / 2')
  await page.getByRole('button', { name: '테스트 바지 다시 보기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '테스트 바지 상세' })).toBeVisible()
  await page.getByRole('button', { name: '내 옷장으로 돌아가기' }).click()
  await expect(page.getByRole('status')).toHaveText('2 / 2')
  await expect(page.getByRole('button', { name: '테스트 바지 다시 보기', exact: true })).toBeInViewport()
})

test('네이티브 푸시 경로에서 목록을 열고 별도 수신 동의를 저장·복원·해제한다', async ({ page, mockApi }) => {
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ capabilities: [], permissions: { notifications: 'granted', location: 'denied' } }),
    } as unknown as NonNullable<Window['ClosetNative']>
  })
  await page.goto('/#/closet/rediscovery')
  await expect(page.getByRole('dialog', { name: '잊고 있던 옷', exact: true })).toBeVisible()
  await page.goto('/#/settings/notifications')
  const toggle = page.getByRole('switch', { name: '잊고 있던 옷 알림', exact: true })
  await expect(toggle).not.toBeChecked()
  await toggle.click()
  await expect(toggle).toBeChecked()
  expect(mockApi.rediscoveryPushEnabled).toBe(true)
  await page.reload()
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  expect(mockApi.rediscoveryPushEnabled).toBe(false)
})

test('기기 알림 권한이 없으면 주간 수신 선택을 유지하고 허용 후에만 변경한다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ capabilities: [], permissions: { notifications: 'denied', location: 'denied' } }),
      openAppSettings: async () => {},
    } as unknown as NonNullable<Window['ClosetNative']>
  })
  await page.goto('/#/settings/notifications')
  const toggle = page.getByRole('switch', { name: '잊고 있던 옷 알림', exact: true })
  await expect(toggle).toBeDisabled()
  await expect(page.getByText('알림 권한을 허용해야 받을 수 있어요.', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('notifications-denied.png'), animations: 'disabled' })
  await expect(toggle).not.toBeChecked()
  expect(mockApi.operations).not.toContain('SetWardrobeRediscoveryPushEnabled')
  mockApi.rediscoveryPushEnabled = true
  await page.reload()
  await expect(toggle).toBeChecked()
  await expect(toggle).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('notifications-consent-on-permission-denied.png'), animations: 'disabled' })
  expect(mockApi.operations).not.toContain('SetWardrobeRediscoveryPushEnabled')
  await page.evaluate(() => {
    const native = window.ClosetNative!
    const original = native.getAppInfo
    native.getAppInfo = async () => {
      const info = await original()
      return { ...info, permissions: { ...info.permissions, notifications: 'granted' } }
    }
    window.dispatchEvent(new Event('closet:native-app-active'))
  })
  await expect(toggle).toBeEnabled()
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  expect(mockApi.rediscoveryPushEnabled).toBe(false)
})

test('하이라이트는 사용권 없이 볼 수 있고 코디 추천은 기존 사용권 확인을 거친다', async ({ page, mockApi }) => {
  mockApi.rediscoveryItems = [{ item: mockApi.wardrobeItems[0], reason: 'no_wear_record', daysSinceLastWorn: null }]
  let recommendationCalls = 0
  await page.route('**/graphql', async (route) => {
    const { query } = route.request().postDataJSON()
    if (query.includes('query PreviewCredits')) {
      await route.fulfill({ json: { data: { previewCredits: {
        freeRemaining: 0, rewardRemaining: 0, totalRemaining: 0, capacity: 5,
        nextRefillAt: new Date(Date.now() + 3_600_000).toISOString(), serverNow: new Date().toISOString(),
        rewardMode: 'test', pendingRewardSessionId: null, resetsAt: new Date(Date.now() + 86_400_000).toISOString(), adRewardsRemaining: null,
      } } } })
    } else if (query.includes('query TodayOutfitRecommendation')) {
      recommendationCalls += 1
      await route.fulfill({ json: { errors: [{ message: '추천이 실행되면 안 됩니다.' }] } })
    } else await route.fallback()
  })
  await page.goto('/closet')
  await page.getByRole('button', { name: '잊고 있던 옷 확인하기', exact: true }).click()
  await page.getByRole('button', { name: '테스트 셔츠 코디 추천' }).click()
  const sheet = page.getByRole('dialog', { name: '이 옷으로 AI 코디 추천' })
  await sheet.getByRole('button', { name: '봄', exact: true }).click()
  await sheet.getByRole('button', { name: /자동/ }).click()
  await expect(page.getByRole('dialog', { name: 'AI 사용권이 부족해요', exact: true })).toBeVisible()
  expect(recommendationCalls).toBe(0)
})

test('짧은 모바일 화면에서도 착용 기록과 알림 설정이 세로 스크롤 없이 보인다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 })
  mockApi.rediscoveryItems = mockApi.wardrobeItems.map(item => ({
    item: { ...item, name: '여러 계절에 입는 차콜 클래식 울 블렌드 오버핏 재킷' },
    reason: 'long_unworn',
    daysSinceLastWorn: 120,
    lastWornTemperatureC: 12.5,
  }))
  await page.goto('/closet/rediscovery')
  const dialog = page.getByRole('dialog', { name: '잊고 있던 옷', exact: true })
  await expect(dialog.getByRole('button', { name: '다음 옷' })).toBeInViewport({ ratio: 1 })
  await expect(dialog.getByRole('link', { name: '잊고 있던 옷 알림 설정' })).toBeInViewport({ ratio: 1 })
  const body = dialog.locator('.rediscovery-body')
  await expect.poll(() => body.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: testInfo.outputPath('rediscovery-compact-mobile.png'), animations: 'disabled' })
})

test('응답을 기다리는 동안 실제 카드와 같은 자리를 보여준다', async ({ page, mockApi }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  mockApi.rediscoveryItems = [{ item: mockApi.wardrobeItems[0], reason: 'no_wear_record', daysSinceLastWorn: null }]
  let release = () => {}
  const response = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/graphql', async (route) => {
    if (route.request().postDataJSON().query.includes('query WardrobeRediscovery')) await response
    await route.fallback()
  })

  try {
    await page.goto('/closet/rediscovery')
    const dialog = page.getByRole('dialog', { name: '잊고 있던 옷', exact: true })
    await expect(dialog.getByRole('status')).toHaveText('잊고 있던 옷을 불러오는 중')
    await expect(dialog.getByText('지금 다시 꺼낼 옷이 없어요')).toHaveCount(0)
    await expect(dialog.getByRole('button')).toHaveCount(1)
    await dialog.evaluate(async (node) => { await Promise.all(node.getAnimations().map((animation) => animation.finished)) })
    const loadingPhoto = await dialog.locator('.rediscovery-card-visual').boundingBox()
    await page.screenshot({ path: testInfo.outputPath('rediscovery-loading.png'), animations: 'disabled' })
    release()
    const photo = dialog.getByRole('button', { name: '테스트 셔츠 다시 보기' })
    await expect(photo).toBeVisible()
    expect(await photo.boundingBox()).toEqual(loadingPhoto)
    await dialog.getByRole('button', { name: '잊고 있던 옷 닫기' }).click()
    await expect(dialog).toHaveCount(0)
  } finally {
    release()
  }
})
