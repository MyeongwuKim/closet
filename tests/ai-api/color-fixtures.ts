import type { ColorRuleItem } from '../../apps/api/src/features/outfit/outfit-color-rules.js'
import type { OutfitMatchRelation, TodayOutfitColorScheme } from '../../packages/types/src/index.js'

interface FixtureItem extends ColorRuleItem {
  id: string
  category: 'top' | 'bottom' | 'outer'
}

export interface ColorApiCase {
  id: string
  title: string
  kind: 'today' | 'manual'
  items: FixtureItem[]
  selectedId: string
  selectedIds?: string[]
  targetCategory?: 'bottom' | 'outer'
  scheme?: TodayOutfitColorScheme
  expectedApplied?: boolean
  expectedRelation?: OutfitMatchRelation
  expectedPhrase?: string
  qualityRegression?: boolean
}

function item(id: string, category: FixtureItem['category'], hex: string, name: string): FixtureItem {
  const categoryName = { top: '상의', bottom: '하의', outer: '아우터' }[category]
  return { id, category, name: `${name} ${categoryName}`, colorName: name, colorHex: hex, colorMode: 'solid' }
}

const blue = () => item('blue-top', 'top', '#254F82', '블루')
const lightBlue = () => item('blue-bottom', 'bottom', '#82ACE0', '블루')
const pastelBlue = () => item('pastel-top', 'top', '#A8B3C5', '블루')
const lavender = () => item('lavender-bottom', 'bottom', '#B5A4BB', '퍼플')
const white = () => item('white-top', 'top', '#F2F1EC', '화이트')
const black = () => item('black-bottom', 'bottom', '#242424', '블랙')
const deepRed = () => item('red-top', 'top', '#8B2F36', '레드')

/**
 * 기대값은 실행 중 색 판정 함수로 만들지 않고 제품 기준과 확인한 회귀 사례로 고정한다.
 * 마지막 품질 사례는 현재 알려진 촬영 편차 문제이며, 실패를 숨기거나 기대 실패로 처리하지 않는다.
 * 사진에서 색을 추정하는 정확도와 취향 만족도는 이 고정 HEX 기반 API 검사 범위에 포함하지 않는다.
 */
export const colorApiCases: ColorApiCase[] = [
  { id: 'today-tone-on', title: '오늘의 코디: 같은 블루 계열의 밝기 차이를 톤온톤으로 적용한다', kind: 'today',
    items: [blue(), lightBlue()], selectedId: 'blue-top', scheme: 'tone-on-tone', expectedApplied: true, expectedPhrase: '톤온톤' },
  { id: 'today-tone-in', title: '오늘의 코디: 파스텔 블루·라벤더를 톤인톤으로 적용한다', kind: 'today',
    items: [pastelBlue(), lavender()], selectedId: 'pastel-top', scheme: 'tone-in-tone', expectedApplied: true, expectedPhrase: '톤인톤' },
  { id: 'today-achromatic', title: '오늘의 코디: 흰색·검정을 무채색으로 적용한다', kind: 'today',
    items: [white(), black()], selectedId: 'white-top', scheme: 'achromatic', expectedApplied: true, expectedPhrase: '무채색' },
  { id: 'today-accent', title: '오늘의 코디: 실제 AI가 추정한 짙은 빨강도 검정 위 포인트로 적용한다', kind: 'today',
    items: [deepRed(), black()], selectedId: 'red-top', scheme: 'accent', expectedApplied: true, expectedPhrase: '포인트' },
  { id: 'not-tone-on', title: '반례: 흰색·검정을 톤온톤이라고 설명하지 않는다', kind: 'today',
    items: [white(), black()], selectedId: 'white-top', scheme: 'tone-on-tone', expectedApplied: false },
  { id: 'not-tone-in', title: '반례: 밝기 차이가 큰 두 블루를 톤인톤이라고 설명하지 않는다', kind: 'today',
    items: [blue(), lightBlue()], selectedId: 'blue-top', scheme: 'tone-in-tone', expectedApplied: false },
  { id: 'pattern-uncertain', title: '반례: 패턴 대표색 하나로 톤온톤을 확정하지 않는다', kind: 'today',
    items: [{ ...blue(), colorMode: 'patterned' }, lightBlue()], selectedId: 'blue-top', scheme: 'tone-on-tone', expectedApplied: false },
  { id: 'manual-tone-on', title: '컬러·옷 추천: 실제 후보에 톤온톤 관계와 근거를 붙인다', kind: 'manual',
    items: [blue(), lightBlue()], selectedId: 'blue-top', expectedRelation: 'tone-on-tone', expectedPhrase: '톤온톤' },
  { id: 'manual-tone-in', title: '컬러·옷 추천: 실제 후보에 톤인톤 관계와 근거를 붙인다', kind: 'manual',
    items: [pastelBlue(), lavender()], selectedId: 'pastel-top', expectedRelation: 'tone-in-tone', expectedPhrase: '톤인톤' },
  { id: 'manual-accent', title: '컬러·옷 추천: 검정에 짙은 빨강 후보를 포인트로 제안한다', kind: 'manual',
    items: [item('black-top', 'top', '#242424', '블랙'), item('red-bottom', 'bottom', '#8B2F36', '레드')],
    selectedId: 'black-top', expectedRelation: 'accent', expectedPhrase: '포인트' },
  { id: 'lighting-tone-in', title: '품질 회귀: 야외 촬영의 버건디·네이비에서도 톤인톤 요청을 유지한다', kind: 'today',
    items: [item('captured-red', 'top', '#7A1717', '레드'), item('captured-navy', 'bottom', '#13183A', '네이비')],
    selectedId: 'captured-red', scheme: 'tone-in-tone', expectedApplied: true, expectedPhrase: '톤인톤', qualityRegression: true },
]
