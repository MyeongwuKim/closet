import { colorApiCases } from './color-fixtures.js'
import { test, expect, expectGroundedProviderResponse } from './fixture.js'

/** 고정 기대값·실제 API 호출·근거 일치·기본 추천 대체 여부를 케이스마다 확인한다. */
for (const fixture of colorApiCases) {
  test(fixture.title, async ({ colorApi }) => {
    test.info().annotations.push({ type: '검증 범위', description: '실제 GraphQL·추천 서비스·OpenAI 호출. 로그인과 DB 저장은 테스트 데이터.' })
    if (fixture.qualityRegression) test.info().annotations.push({ type: '알려진 품질 회귀', description: '촬영 편차로 톤인톤이 누락되던 사례. 실패를 무시하지 않는다.' })
    const result = await colorApi.recommend(fixture)
    expect(result.source, 'AI 실패 후 기본 추천으로 대체되면 통과가 아닙니다.').toBe('ai')
    expectGroundedProviderResponse(colorApi.calls)
    expect(colorApi.settlements).toHaveLength(1)
    expect(colorApi.settlements[0]).not.toBeNull()

    if (fixture.kind === 'today') {
      expect(result.ready).toBe(true)
      expect(result.items.map((item: { id: string }) => item.id).sort()).toEqual(fixture.items.map((item) => item.id).sort())
      expect(result.items.some((item: { id: string }) => item.id === fixture.selectedId)).toBe(true)
      expect(result.colorSchemeApplied, 'API 응답 성공과 별개로 요청한 색감 조건 적용 여부를 검사합니다.').toBe(fixture.expectedApplied)
      if (fixture.expectedApplied) expect([result.summary, ...result.reasons].join(' ')).toContain(fixture.expectedPhrase)
      else expect(result.summary).toContain('선택한 색감 조건을 충족하지 못해')
    } else {
      const candidate = fixture.items.find((item) => item.id !== fixture.selectedId)!
      expect(result.candidates).toHaveLength(1)
      expect(result.candidates[0].item.id).toBe(candidate.id)
      expect(result.candidates[0].relation).toBe(fixture.expectedRelation)
      expect(result.candidates[0].reason).toContain(fixture.expectedPhrase)
      expect(result.recommendedColors.length).toBeGreaterThan(0)
      expect(result.recommendedColors.length).toBeLessThanOrEqual(3)
      expect(result.recommendedColors.some((color: { role: string }) => color.role === 'safe')).toBe(true)
      expect(new Set(result.recommendedColors.map((color: { role: string }) => color.role)).size).toBe(result.recommendedColors.length)
      for (const color of result.recommendedColors) expect(color.hex).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })
}
