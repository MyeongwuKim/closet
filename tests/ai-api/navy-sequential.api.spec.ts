import { recommendOutfitColors, getColorMatchEvidence, type ColorRuleItem } from '../../apps/api/src/features/outfit/outfit-color-rules.js'
import { test, expect, expectGroundedProviderResponse } from './fixture.js'
import type { ColorApiCase } from './color-fixtures.js'

interface PaletteColor { name: string; hex: string; role: string; reason: string }

/** 실제 반환된 팔레트가 모든 선택 옷과 일치하는지 확인한다. 결과가 다르다는 이유만으로 정답이라고 보지는 않는다. */
function expectPalette(result: any, selected: ColorRuleItem[], category: 'bottom' | 'outer') {
  expect(result.source, 'AI 대신 기본 추천으로 대체되면 통과하지 않습니다.').toBe('ai')
  expect(result.targetCategory).toBe(category)
  expect(result.candidates, '컬러만 검사하므로 옷장에 없는 실제 옷을 만들면 안 됩니다.').toEqual([])
  expect(result.recommendedColors).toEqual(recommendOutfitColors(selected, category))
  expect(result.recommendedColors.length).toBeGreaterThan(0)
  expect(new Set(result.recommendedColors.map((color: PaletteColor) => color.role)).size).toBe(result.recommendedColors.length)
  for (const color of result.recommendedColors as PaletteColor[]) {
    // 무채색 받침 후보를 기존 두 네이비의 톤 관계로 설명하면 계산 함수끼리 일치해도 실패다.
    if (color.role === 'safe') expect(color.reason).not.toMatch(/톤온톤|톤인톤/)
    const candidate: ColorRuleItem = { name: color.name, category, colorName: color.name, colorHex: color.hex, colorMode: 'solid' }
    expect(color.reason).toBe(getColorMatchEvidence(selected, candidate).reason)
  }
}

/**
 * 네이비 상의→실제로 추천된 바지 컬러 선택→두 옷을 함께 기준으로 아우터 컬러 요청 순서를 검증한다.
 * 바지와 아우터는 각각 실제 응답의 harmony 역할을 고른다. 아우터의 결과색을 고정하거나 임의의 바지색을 끼워 넣지 않는다.
 */
test('네이비 순차 시나리오: 바지 컬러를 고른 뒤 상의·바지에 어울리는 아우터 컬러를 추천한다', async ({ colorApi }) => {
  const top: ColorApiCase['items'][number] = {
    id: 'navy-top', name: '네이비 상의', category: 'top', colorName: '네이비', colorHex: '#27394A', colorMode: 'solid',
  }
  let pants!: ColorApiCase['items'][number]
  let pantsResult: any
  let outerResult: any

  await test.step('1. 네이비 상의를 기준으로 바지 컬러를 추천받고 조화색을 선택한다', async () => {
    pantsResult = await colorApi.recommend({
      id: 'navy-choose-pants', title: '네이비 상의의 바지 컬러', kind: 'manual',
      items: [top], selectedId: top.id, targetCategory: 'bottom',
    })
    expectPalette(pantsResult, [top], 'bottom')
    expectGroundedProviderResponse(colorApi.calls)
    const picked = (pantsResult.recommendedColors as PaletteColor[]).find((color) => color.role === 'harmony')
    expect(picked, '첫 응답의 조화색을 실제 다음 단계의 바지색으로 사용합니다.').toBeDefined()
    pants = {
      id: 'picked-pants', name: `${picked!.name} 바지`, category: 'bottom',
      colorName: picked!.name, colorHex: picked!.hex, colorMode: 'solid',
    }
  })

  await test.step('2. 네이비 상의와 선택한 바지를 모두 넣어 아우터 컬러를 추천받는다', async () => {
    const previousCalls = colorApi.calls.length
    outerResult = await colorApi.recommend({
      id: 'navy-pants-choose-outer', title: '네이비 상의와 선택한 바지의 아우터 컬러', kind: 'manual',
      items: [top, pants], selectedId: top.id, selectedIds: [top.id, pants.id], targetCategory: 'outer',
    })
    const outerCalls = colorApi.calls.slice(previousCalls)
    expectGroundedProviderResponse(outerCalls)
    expectPalette(outerResult, [top, pants], 'outer')
    const successful = outerCalls.find((call) => call.status === 200)!
    const prompt = JSON.parse(successful.request.input.find((message: { role: string }) => message.role === 'user').content)
    expect(prompt.targetCategory).toBe('outer')
    expect(prompt.selectedItems.map((item: { id: string }) => item.id).sort()).toEqual([top.id, pants.id].sort())
    expect(prompt.selectedItems.find((item: { id: string }) => item.id === pants.id).colorHex).toBe(pants.colorHex)
    expect(colorApi.settlements).toHaveLength(2)
    expect(colorApi.settlements.every(Boolean)).toBe(true)
  })

  await test.info().attach('순차 추천 결과', {
    body: Buffer.from(JSON.stringify({
      top, pantsSelectionPolicy: '첫 실제 응답의 harmony 역할 선택', pantsChoices: pantsResult.recommendedColors,
      selectedPants: pants, outerChoices: outerResult.recommendedColors,
      selectedOuter: (outerResult.recommendedColors as PaletteColor[]).find((color) => color.role === 'harmony'),
      topOnlyOuterReference: recommendOutfitColors([top], 'outer'),
      note: '상의만 기준으로 계산한 참고값은 로컬 규칙 비교이며 추가 AI 호출 결과가 아닙니다.',
    }, null, 2)), contentType: 'application/json',
  })
})
