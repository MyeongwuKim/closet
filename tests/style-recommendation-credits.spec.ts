import { test, expect, createWardrobeItem } from './support/fixture'
import type { Page } from '@playwright/test'
import type { ClosetNativeBridge } from '../apps/web/src/native-bridge/types'

/** 실제 광고·AI·계정 대신 테스트 잔액을 사용하고, 추천 요청과 보상 지급 횟수를 기록한다. */
async function installStyleCredits(page: Page, candidate: unknown, initial = 1, grounded?: Record<string, unknown>) {
  const state = { balance: initial, ads: 0, requests: [] as Array<{ selectedItemIds: string[]; targetCategory: string; mode?: string }>, failNext: false, responseGate: null as Promise<void> | null }
  const nextRefillAt = new Date(Date.now() + 60 * 60_000).toISOString()
  const session = { id: 'style-reward', mode: 'test', adUnitId: 'fixture', status: 'pending', watchedAt: null, validUntil: new Date(Date.now() + 600_000).toISOString() }
  await page.exposeFunction('earnStyleCredit', () => { state.balance++; state.ads++ })
  await page.addInitScript(() => {
    window.ClosetRuntimeConfig = { isNativeWebView: true }
    window.ClosetNative = {
      getAppInfo: async () => ({ capabilities: ['rewarded-ad'], platform: 'ios' }),
      showRewardedAd: async (sessionId: string) => {
        await (window as unknown as { earnStyleCredit: () => Promise<void> }).earnStyleCredit()
        return { status: 'earned', sessionId }
      },
    } as unknown as ClosetNativeBridge
  })
  await page.route('**/graphql', async (route) => {
    const { query, variables = {} } = route.request().postDataJSON()
    let data: unknown
    if (query.includes('query PreviewCredits')) {
      data = { previewCredits: { freeRemaining: state.balance, rewardRemaining: 0, totalRemaining: state.balance, capacity: 5,
        nextRefillAt: state.balance < 5 ? nextRefillAt : null, serverNow: new Date().toISOString(), adRewardsRemaining: null,
        rewardMode: 'test', resetsAt: new Date(Date.now() + 86_400_000).toISOString(), pendingRewardSessionId: null } }
    } else if (query.includes('query OutfitRecommendation(')) {
      state.requests.push(variables.input)
      if (state.failNext) {
        state.failNext = false
        await route.fulfill({ json: { errors: [{ message: '테스트 일시 오류' }] } })
        return
      }
      expect(state.balance).toBeGreaterThan(0)
      state.balance--
      await state.responseGate
      data = { outfitRecommendation: { targetCategory: variables.input.targetCategory, headline: '함께 추천', summary: '옷과 색을 함께 골랐어요.', model: 'fixture', source: 'ai',
        recommendedColors: [
          { name: '화이트', hex: '#FFFFFF', role: 'safe', reason: '밝게 연결해요.' },
          { name: '그레이', hex: '#808080', role: 'harmony', reason: '차분하게 이어져요.' },
          { name: '레드', hex: '#FF0000', role: 'accent', reason: '포인트가 돼요.' },
        ], candidates: [{ item: typeof candidate === 'function' ? candidate() : candidate, reason: '차분한 색감이 어울려요.', relation: 'tone-on-tone' }],
        ...grounded,
      } }
    } else if (query.includes('mutation StartPreviewReward')) {
      expect(variables.kind).toBe('recommendation')
      data = { startPreviewReward: session }
    } else if (query.includes('query PreviewRewardSession')) data = { previewRewardSession: { ...session, status: state.ads > 0 ? 'granted' : 'pending' } }
    else { await route.fallback(); return }
    await route.fulfill({ json: { data } })
  })
  return state
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 검증된 톤인톤 관계와 포인트 없는 팔레트를 표시한다`, async ({ page, mockApi }, testInfo) => {
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    const reason = '서로 다른 색 계열의 밝기와 채도가 비슷한 톤인톤 조합이에요.'
    await installStyleCredits(page, mockApi.wardrobeItems[1], 1, {
      candidates: [{ item: mockApi.wardrobeItems[1], reason, relation: 'tone-in-tone' }],
      recommendedColors: [
        { name: '그레이', hex: '#777872', role: 'safe', reason: '무채색을 함께 사용해 새로운 색 계열이 늘어나는 것을 줄였어요.' },
        { name: '블루', hex: '#8CAEBE', role: 'harmony', reason: '같은 색 계열에서 밝기를 달리한 톤온톤 조합이에요.' },
      ],
    })
    const choice = await openStyleChoice(page)
    await choice.getByRole('button', { name: '컬러·옷장 함께 추천받기' }).click()
    const result = page.getByRole('region', { name: '스타일 추천', exact: true })
    await expect(result.getByText('톤인톤', { exact: true })).toBeVisible()
    await expect(result.getByText(reason, { exact: true })).toBeVisible()
    await result.getByRole('tab', { name: '어울리는 컬러 찾기' }).click()
    await expect(result.getByRole('button', { name: /색상의 하의 아이템 옷장에서 보기/ })).toHaveCount(2)
    await expect(result.getByText('포인트로', { exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
    await testInfo.attach(`color-palette-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' })
  })
}

async function openStyleChoice(page: Page, navigate = true) {
  if (navigate) await page.goto('/#/lookbook')
  await page.getByRole('button', { name: '새 코디 만들기' }).click()
  const composer = page.getByRole('dialog', { name: '코디 맞춰보기' })
  const shirt = composer.getByRole('button', { name: '테스트 셔츠 Look에 추가' })
  if (!await shirt.isVisible()) await composer.getByRole('button', { name: '상의·원피스 아이템 고르기' }).click()
  await shirt.click()
  await composer.getByRole('button', { name: '하의 아이템 고르기' }).click()
  await composer.getByRole('button', { name: '스타일 제안', exact: true }).click()
  return page.getByRole('dialog', { name: '컬러와 옷을 함께 추천해요' })
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`${viewport.width}px: 공통 사용권 1개로 두 추천을 받고 0개에서도 전환·다시 보기는 무료다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    const state = await installStyleCredits(page, mockApi.wardrobeItems[1])
    const choice = await openStyleChoice(page)
    await expect(choice.getByText('AI 사용권 1/5', { exact: true })).toBeVisible()
    expect(state.requests).toHaveLength(0)
    await choice.getByRole('button', { name: '컬러·옷장 함께 추천받기' }).click()
    const result = page.getByRole('region', { name: '스타일 추천', exact: true })
    await expect(result.getByText('차분한 색감이 어울려요.', { exact: true })).toBeVisible()
    for (let index = 0; index < 3; index++) {
      await result.getByRole('tab', { name: '어울리는 컬러 찾기' }).click()
      await expect(result.getByRole('button', { name: '화이트 색상의 하의 아이템 옷장에서 보기' })).toBeVisible()
      await result.getByRole('tab', { name: '내 옷장에서 찾기' }).click()
    }
    await result.getByRole('button', { name: '옷장으로 돌아가기' }).click()
    const closeWardrobe = page.getByRole('button', { name: '옷장 닫기', exact: true })
    if (await closeWardrobe.isVisible()) {
      await closeWardrobe.click()
      await page.getByRole('button', { name: '하의 아이템 고르기' }).click()
    }
    await page.getByRole('button', { name: '스타일 제안', exact: true }).click()
    await expect(choice.getByText('AI 사용권 0/5', { exact: true })).toBeVisible()
    await choice.getByRole('button', { name: '추천 결과 다시 보기' }).click()
    await expect(result.getByText('차분한 색감이 어울려요.', { exact: true })).toBeVisible()
    expect(state.requests).toHaveLength(1)
    expect(state.requests[0].mode).toBeUndefined()
    expect(state.balance).toBe(0)
    expect(state.ads).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test(`${viewport.width}px: 0개면 충전 선택을 보여주고 광고 지급 후 다음 클릭에서 함께 추천한다`, async ({ page, mockApi }) => {
    await page.setViewportSize(viewport)
    const state = await installStyleCredits(page, mockApi.wardrobeItems[1], 0)
    const choice = await openStyleChoice(page)
    await choice.getByRole('button', { name: '광고 보고 충전' }).click()
    const reward = page.getByRole('dialog', { name: 'AI 사용권이 부족해요', exact: true })
    await reward.getByRole('button', { name: /기다리기/ }).click()
    await expect(reward).toHaveCount(0)
    expect(state.requests).toHaveLength(0)
    expect(state.ads).toBe(0)
    await choice.getByRole('button', { name: '광고 보고 충전' }).click()
    await reward.getByRole('button', { name: /광고 보고.*즉시 받기/ }).click()
    await expect(reward).toHaveCount(0)
    await expect(choice.getByText('AI 사용권 1/5', { exact: true })).toBeVisible()
    expect(state.requests).toHaveLength(0)
    await choice.getByRole('button', { name: '컬러·옷장 함께 추천받기' }).click()
    await expect(page.getByRole('region', { name: '스타일 추천', exact: true }).getByRole('tab', { name: '내 옷장에서 찾기' })).toBeVisible()
    expect(state.requests).toHaveLength(1)
    expect(state.ads).toBe(1)
    expect(state.balance).toBe(0)
  })
}

test('추천 오류는 자동 재요청하지 않고 사용자가 다시 누른 뒤 성공 결과를 공유한다', async ({ page, mockApi }) => {
  const state = await installStyleCredits(page, mockApi.wardrobeItems[1])
  state.failNext = true
  const choice = await openStyleChoice(page)
  await choice.getByRole('button', { name: '컬러·옷장 함께 추천받기' }).click()
  const result = page.getByRole('region', { name: '스타일 추천', exact: true })
  await expect(result.getByText('추천을 불러오지 못했어요')).toBeVisible()
  await result.getByRole('tab', { name: '어울리는 컬러 찾기' }).click()
  expect(state.requests).toHaveLength(1)
  await result.getByRole('button', { name: '다시 추천받기' }).click()
  await expect(result.getByRole('button', { name: '화이트 색상의 하의 아이템 옷장에서 보기' })).toBeVisible()
  expect(state.requests).toHaveLength(2)
  expect(state.balance).toBe(0)
})

test('옷 수정·보관 후 예전 스타일 후보를 숨기며 다음 클릭 전에는 사용권을 쓰지 않는다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  mockApi.wardrobeItems.push(createWardrobeItem({ id: 'replacement-pants', name: '남겨둘 바지', category: 'bottom', subcategory: '슬랙스' }))
  const state = await installStyleCredits(page, () => mockApi.wardrobeItems.find((item) => item.category === 'bottom' && !item.archivedAt), 3)
  let choice = await openStyleChoice(page)
  await choice.getByRole('button', { name: '컬러·옷장 함께 추천받기' }).click()
  const result = page.getByRole('region', { name: '스타일 추천', exact: true })
  await expect(result.getByText('테스트 바지', { exact: true })).toBeVisible()

  const returnToCloset = async () => {
    await result.getByRole('button', { name: '옷장으로 돌아가기' }).click()
    await page.getByRole('button', { name: 'Look 만들기 닫기' }).click()
    await page.getByRole('alertdialog', { name: 'Look 만들기를 닫을까요?' }).getByRole('button', { name: '닫기', exact: true }).click()
    await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '옷장', exact: true }).click()
  }
  const reopenChoice = async () => {
    await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '코디북', exact: true }).click()
    choice = await openStyleChoice(page, false)
    await expect(choice.getByRole('button', { name: '컬러·옷장 함께 추천받기' })).toBeVisible()
    await expect(choice.getByRole('button', { name: '추천 결과 다시 보기' })).toHaveCount(0)
  }

  await returnToCloset()
  await page.getByRole('button', { name: '테스트 바지 옷 상세 보기' }).click()
  await page.getByRole('button', { name: '옷 정보 수정' }).click()
  const edit = page.getByRole('dialog', { name: '옷 정보 수정' })
  await edit.getByRole('textbox', { name: '아이템 이름' }).fill('수정한 바지')
  await edit.getByRole('button', { name: '변경사항 저장' }).click()
  await page.getByRole('button', { name: '내 옷장으로 돌아가기' }).click()
  await reopenChoice()
  expect(state.requests).toHaveLength(1)
  expect(state.balance).toBe(2)
  await choice.getByRole('button', { name: '컬러·옷장 함께 추천받기' }).click()
  await expect(result.getByText('수정한 바지', { exact: true })).toBeVisible()
  await expect(result.getByText('테스트 바지', { exact: true })).toHaveCount(0)

  await returnToCloset()
  await page.getByRole('button', { name: '수정한 바지 옷 상세 보기' }).click()
  await page.getByRole('button', { name: '옷장에서 삭제', exact: true }).click()
  await page.getByRole('alertdialog', { name: '옷장에서 삭제할까요?' }).getByRole('button', { name: '옷장에서 삭제' }).click()
  await expect(page.getByRole('button', { name: '수정한 바지 옷 상세 보기' })).toHaveCount(0)
  await reopenChoice()
  expect(state.requests).toHaveLength(2)
  expect(state.balance).toBe(1)
  await choice.getByRole('button', { name: '컬러·옷장 함께 추천받기' }).click()
  await expect(result.getByText('남겨둘 바지', { exact: true })).toBeVisible()
  await expect(result.getByText('수정한 바지', { exact: true })).toHaveCount(0)
  expect(state.requests).toHaveLength(3)
  expect(state.balance).toBe(0)
})

test('추천 중 화면을 닫고 다시 열어도 진행 중인 요청 하나의 결과를 보관한다', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await installStyleCredits(page, mockApi.wardrobeItems[1])
  let release!: () => void
  state.responseGate = new Promise<void>((resolve) => { release = resolve })
  try {
    const choice = await openStyleChoice(page)
    await choice.getByRole('button', { name: '컬러·옷장 함께 추천받기' }).click()
    await expect.poll(() => state.requests.length).toBe(1)
    const result = page.getByRole('region', { name: '스타일 추천', exact: true })
    await result.getByRole('button', { name: '옷장으로 돌아가기' }).click()
    await page.getByRole('button', { name: '옷장 닫기', exact: true }).click()
    await page.getByRole('button', { name: '하의 아이템 고르기' }).click()
    await page.getByRole('button', { name: '스타일 제안', exact: true }).click()
    await choice.getByRole('button', { name: '추천 결과 다시 보기' }).click()
    release()
    await expect(result.getByText('차분한 색감이 어울려요.', { exact: true })).toBeVisible()
    expect(state.requests).toHaveLength(1)
    expect(state.balance).toBe(0)
  } finally { release() }
})
