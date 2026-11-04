import type { ClothingCategory, OutfitMatchRelation, OutfitRecommendationColor, TodayOutfitColorScheme } from '@closet/types'
import { colorHexToRgb } from '../classification/color.js'
import { fashionColorLabels } from '../classification/taxonomy.js'
import { OUTFIT_COLOR_RULES_VERSION } from '@closet/types/outfit-colors'

export interface ColorRuleItem {
  name: string
  category: ClothingCategory | null
  colorName: string | null
  colorHex: string | null
  colorMode: string | null
}

interface OklchColor {
  lightness: number
  chroma: number
  hue: number
}

/** 추천·표시·설명 및 저장된 AI 결과를 같은 색 판정 버전으로 구분한다. */
export const COLOR_RULES_VERSION = OUTFIT_COLOR_RULES_VERSION

/**
 * OKLab 변환은 https://bottosson.github.io/posts/oklab/ 의 sRGB 공식을 사용한다.
 * 아래 허용 차이는 제품의 명시적인 조합 기준이며, 취향의 정답이나 학술적으로 검증된 궁합 점수가 아니다.
 * 낮은 채도의 파스텔도 색으로 비교하도록 무채색 허용 오차와 포인트 받침색 범위를 구분한다.
 */
const rules = {
  neutralChroma: 0.012,
  sameHueDegrees: 30,
  differentHueDegrees: 35,
  toneLightnessDifference: 0.08,
  similarLightnessDifference: 0.14,
  similarChromaDifference: 0.08,
  darkLightness: 0.45,
  darkToneLightnessDifference: 0.18,
  accentChroma: 0.13,
  supportChroma: 0.08,
  relativeAccentChroma: 0.10,
  relativeSupportChroma: 0.04,
  accentChromaDifference: 0.08,
  darkAccentChroma: 0.075,
  darkAccentColorfulness: 0.25,
  darkAccentChromaDifference: 0.06,
} as const

const mainCategories = new Set<ClothingCategory>(['top', 'bottom', 'dress', 'outer', 'midlayer'])
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const isComplex = (item: ColorRuleItem) => item.colorMode !== 'solid'

function toLinear(value: number) {
  const channel = value / 255
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function toOklch(hex: string | null): OklchColor | null {
  const rgb = colorHexToRgb(hex)
  if (!rgb) return null
  const [red, green, blue] = rgb.map(toLinear)
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { lightness, chroma: Math.hypot(a, b), hue: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 }
}

function hueDistance(left: number, right: number) {
  const distance = Math.abs(left - right)
  return Math.min(distance, 360 - distance)
}

function getPaletteColorName(color: OklchColor) {
  if (color.chroma <= rules.neutralChroma) {
    return color.lightness < 0.35 ? '블랙' : color.lightness > 0.88 ? '화이트' : '그레이'
  }
  // 저장된 넓은 색상명이 HEX와 어긋나더라도 생성한 팔레트의 이름은 실제 색에서 정한다.
  const references = fashionColorLabels.filter((entry) => entry.name !== '다색').map((entry) => ({ ...entry, color: toOklch(entry.hex)! }))
  return references.filter((entry) => entry.color.chroma > rules.neutralChroma)
    .sort((left, right) => {
      const distance = (reference: OklchColor) => hueDistance(color.hue, reference.hue) / 180 * 0.6 +
        Math.abs(color.lightness - reference.lightness) * 0.25 + Math.abs(color.chroma - reference.chroma) * 0.15
      return distance(left.color) - distance(right.color)
    })[0].name
}

function colorPairs(colors: OklchColor[]) {
  return colors.flatMap((left, index) => colors.slice(index + 1).map((right) => ({
    hue: hueDistance(left.hue, right.hue),
    lightness: Math.abs(left.lightness - right.lightness),
    chroma: Math.abs(left.chroma - right.chroma),
  })))
}

/** 밝은 선명색 또는 명도 대비 채도가 충분한 짙은 유채색 하나가 저채도 받침과 구분될 때 포인트로 인정한다. */
function getAccentColor(colors: OklchColor[]) {
  if (colors.length < 2) return null
  const [accent, ...support] = [...colors].sort((left, right) => right.chroma - left.chroma)
  const supportChroma = Math.max(...support.map((color) => color.chroma))
  const vivid = accent.chroma >= rules.accentChroma && supportChroma <= rules.supportChroma
  // 짙은 빨강처럼 절대 채도가 낮아져도 무채색에 가까운 받침과의 차이가 충분하면 포인트다.
  const relative = accent.chroma >= rules.relativeAccentChroma &&
    supportChroma <= rules.relativeSupportChroma && accent.chroma - supportChroma >= rules.accentChromaDifference
  // 어두운 원단은 절대 채도가 작아지므로 명도 대비 색의 선명도도 확인한다. 흐린 갈색·네이비는 최소 채도로 제외한다.
  const dark = accent.lightness <= rules.darkLightness && accent.chroma >= rules.darkAccentChroma &&
    accent.chroma / accent.lightness >= rules.darkAccentColorfulness &&
    supportChroma <= rules.relativeSupportChroma && accent.chroma - supportChroma >= rules.darkAccentChromaDifference
  return vivid || relative || dark ? accent : null
}

function matchesScheme(colors: OklchColor[], scheme: TodayOutfitColorScheme) {
  if (scheme === 'auto') return true
  if (colors.length === 0) return false
  const chromatic = colors.filter((color) => color.chroma > rules.neutralChroma)
  if (scheme === 'achromatic') return chromatic.length === 0
  if (colors.length < 2) return false
  if (scheme === 'accent') return getAccentColor(colors) !== null
  if (chromatic.length < 2) return false
  const pairs = colorPairs(chromatic)
  if (scheme === 'tone-on-tone') {
    return pairs.every((pair) => pair.hue <= rules.sameHueDegrees) &&
      pairs.some((pair) => pair.lightness >= rules.toneLightnessDifference) &&
      pairs.every((pair) => pair.lightness <= 0.5)
  }
  // 두 색 모두 짙을 때만 촬영에 따른 명도 편차를 허용한다. 밝은 색과 큰 채도 차이는 기존 한계를 유지한다.
  const lightnessLimit = chromatic.every((color) => color.lightness <= rules.darkLightness)
    ? rules.darkToneLightnessDifference : rules.similarLightnessDifference
  return pairs.every((pair) => pair.lightness <= lightnessLimit && pair.chroma <= rules.similarChromaDifference) &&
    pairs.some((pair) => pair.hue >= rules.differentHueDegrees)
}

/**
 * 실제 HEX가 있는 단색의 주요 옷과 확인된 보조 아이템으로 색감 충족 여부를 반환한다.
 * 패턴·다색·색 구성 미확인은 대표색 하나로 조합을 확정하지 않는다. 보조 아이템의 미등록 색은 제외한다.
 */
export function getColorSchemeFitScore(items: ColorRuleItem[], scheme: TodayOutfitColorScheme): number {
  if (scheme === 'auto') return 1
  const main = items.filter((item) => item.category && mainCategories.has(item.category))
  if (main.length === 0 || main.some((item) => isComplex(item) || !toOklch(item.colorHex))) return 0
  if (items.some(isComplex)) return 0
  const colors = items.map((item) => toOklch(item.colorHex)).filter((color): color is OklchColor => color !== null)
  return Number(matchesScheme(colors, scheme))
}

function resolveColor(item: ColorRuleItem) {
  const measured = toOklch(item.colorHex)
  if (measured) return { color: measured, measured: true }
  const named = fashionColorLabels.find((color) => color.name === item.colorName?.trim() && color.name !== '다색')
  const color = toOklch(named?.hex ?? null)
  return color ? { color, measured: false } : null
}

/** 두 옷의 명도·채도·색상 관계를 1~6의 후보 정렬 점수로 바꾼다. 색상명 대체값과 패턴은 확신을 낮춘다. */
export function getColorHarmonyScore(left: ColorRuleItem, right: ColorRuleItem) {
  const first = resolveColor(left)
  const second = resolveColor(right)
  if (!first || !second) return 3
  const colors = [first.color, second.color]
  const [pair] = colorPairs(colors)
  const neutralCount = colors.filter((color) => color.chroma <= rules.neutralChroma).length
  let score = 3
  if (neutralCount > 0) score = 5 + Math.min(pair.lightness / 0.24, 1) * 0.65
  else if (matchesScheme(colors, 'tone-on-tone')) score = 5.7
  else if (matchesScheme(colors, 'tone-in-tone')) score = 5.4
  else if (pair.hue <= 55) score = 5
  else if (pair.hue >= 145) score = 4.85
  else if (pair.hue >= 105 && pair.hue <= 135) score = 4.4
  if (neutralCount === 0 && colors.every((color) => color.chroma > 0.17) && pair.hue > 55 && pair.hue < 145) score -= 0.75
  if (!first.measured || !second.measured || isComplex(left) || isComplex(right)) score = 3 + (score - 3) * 0.65
  return clamp(score, 1, 6)
}

/** 선택한 모든 옷과 후보의 실제 대표색으로 표시할 관계와 계산으로 뒷받침되는 설명을 반환한다. */
export function getColorMatchEvidence(selected: ColorRuleItem[], candidate: ColorRuleItem): {
  relation: OutfitMatchRelation
  reason: string
} {
  const items = [...selected, candidate]
  const colors = items.map((item) => toOklch(item.colorHex))
  if (selected.length === 0 || colors.some((color) => !color) || items.some(isComplex)) {
    return { relation: 'soft-balance', reason: '색 정보가 부족하거나 단색으로 확인되지 않아 세부 색 관계를 확정하지 않았어요.' }
  }
  const known = colors as OklchColor[]
  const candidateColor = known.at(-1)!
  // 새 후보도 유채색일 때만 그 후보와의 톤 관계를 붙인다. 기존 선택끼리의 관계를 무채색 후보에 옮기지 않는다.
  const chromaticCandidate = candidateColor.chroma > rules.neutralChroma
  if (matchesScheme(known, 'achromatic')) return { relation: 'soft-balance', reason: '확인된 대표색은 검정·흰색·회색 범위의 무채색 조합이에요.' }
  if (chromaticCandidate && matchesScheme(known, 'tone-on-tone')) return { relation: 'tone-on-tone', reason: '같은 색 계열에서 밝기를 달리한 톤온톤 조합이에요.' }
  if (chromaticCandidate && matchesScheme(known, 'tone-in-tone')) return { relation: 'tone-in-tone', reason: '서로 다른 색 계열의 밝기와 채도가 비슷한 톤인톤 조합이에요.' }
  if (getAccentColor(known) === known.at(-1)) {
    return { relation: 'accent', reason: '차분한 색들에 이 아이템의 상대적으로 채도가 높은 색 하나가 포인트를 더해요.' }
  }
  const comparisons = known.slice(0, -1).map((color) => ({
    lightness: Math.abs(color.lightness - candidateColor.lightness),
    hue: hueDistance(color.hue, candidateColor.hue),
    neutral: color.chroma <= rules.neutralChroma || candidateColor.chroma <= rules.neutralChroma,
  }))
  if (comparisons.every((pair) => pair.lightness >= 0.2)) return { relation: 'clean-contrast', reason: '고른 옷들과 이 아이템의 대표색 사이에 밝기 대비가 있어요.' }
  if (comparisons.every((pair) => pair.neutral)) return { relation: 'soft-balance', reason: '무채색을 함께 사용해 새로운 색 계열이 늘어나는 것을 줄였어요.' }
  if (comparisons.every((pair) => pair.hue <= 55)) return { relation: 'soft-balance', reason: '확인된 대표색의 색상 방향이 가까운 조합이에요.' }
  return { relation: 'soft-balance', reason: '고른 옷 모두와 대표색을 비교했으며, 특정 톤 조합으로 확정하지는 않았어요.' }
}

/** 완성 코디의 실제 색 관계를 한 문장으로 설명한다. 요청한 색감을 충족하지 못하면 그 사실을 함께 알린다. */
export function describeOutfitColors(items: ColorRuleItem[], scheme: TodayOutfitColorScheme = 'auto') {
  if (scheme !== 'auto' && getColorSchemeFitScore(items, scheme)) {
    const reasons = {
      'tone-on-tone': '같은 색 계열에서 밝기를 달리한 톤온톤 조합이에요.',
      'tone-in-tone': '서로 다른 색 계열의 밝기와 채도가 비슷한 톤인톤 조합이에요.',
      achromatic: '확인된 대표색은 검정·흰색·회색 범위의 무채색 조합이에요.',
      accent: '차분한 색들을 바탕으로 한 아이템의 상대적으로 채도가 높은 색을 포인트로 사용했어요.',
    }
    return reasons[scheme]
  }
  const [first, ...rest] = items
  const evidence = first && items.length === 1 && !isComplex(first) && toOklch(first.colorHex)
    ? getColorSchemeFitScore(items, 'achromatic')
      ? '이 아이템의 확인된 대표색은 무채색이에요.'
      : '한 아이템의 대표색을 사용했으며, 두 색 사이의 톤 관계는 확정하지 않았어요.'
    : first ? getColorMatchEvidence(rest, first).reason : '확인할 대표색이 없어요.'
  return scheme !== 'auto' && !getColorSchemeFitScore(items, scheme)
    ? `선택한 색감 조건을 충족하지 못해 기본 조합을 골랐어요. ${evidence}`
    : evidence
}

function toHex(color: OklchColor): string {
  const radians = color.hue * Math.PI / 180
  // sRGB 밖의 색은 채도를 줄여 같은 색상 방향과 밝기를 최대한 유지한다.
  for (let chroma = color.chroma; ; chroma = Math.max(0, chroma - 0.005)) {
    const a = chroma * Math.cos(radians)
    const b = chroma * Math.sin(radians)
    const l = (color.lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
    const m = (color.lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
    const s = (color.lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
    const channels = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
    if (chroma === 0 || channels.every((channel) => channel >= 0 && channel <= 1)) {
      return `#${channels.map((channel) => Math.round(clamp(channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055, 0, 1) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
    }
  }
}

/**
 * 모든 선택 옷과 후보색을 비교해 무채색 받침·조화·포인트를 최대 하나씩 제안한다.
 * 기본 팔레트 외에 실제 대표색의 밝기를 바꾼 후보도 평가한다. 성립하지 않는 포인트 역할은 억지로 만들지 않는다.
 */
export function recommendOutfitColors(items: ColorRuleItem[], category: ClothingCategory): OutfitRecommendationColor[] {
  const selected = [...items].sort((left, right) => `${left.colorHex}:${left.colorName}`.localeCompare(`${right.colorHex}:${right.colorName}`))
  const choices = fashionColorLabels.filter((color) => color.name !== '다색').map(({ name, hex }) => ({ name, hex: hex.toUpperCase() }))
  const measured = selected.map((item) => ({ item, color: toOklch(item.colorHex) }))
  for (const { item, color } of measured) {
    if (!color || color.chroma <= rules.neutralChroma || isComplex(item)) continue
    for (const difference of [-0.22, 0.22]) {
      const hex = toHex({ ...color, lightness: clamp(color.lightness + difference, 0.25, 0.9) })
      choices.push({ name: getPaletteColorName(toOklch(hex)!), hex })
    }
  }
  const unique = [...new Map(choices.map((choice) => [choice.hex, choice])).values()]
  const ranked = unique.map((choice) => {
    const candidate: ColorRuleItem = { name: choice.name, category, colorName: choice.name, colorHex: choice.hex, colorMode: 'solid' }
    const scores = selected.map((item) => getColorHarmonyScore(item, candidate))
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 3
    const evidence = getColorMatchEvidence(selected, candidate)
    return { ...choice, color: toOklch(choice.hex)!, evidence, score: average * 0.6 + (scores.length ? Math.min(...scores) : 3) * 0.4 }
  }).sort((left, right) => right.score - left.score || left.hex.localeCompare(right.hex))
  const used = new Set<string>()
  const result: OutfitRecommendationColor[] = []
  const take = (role: OutfitRecommendationColor['role'], predicate: (choice: typeof ranked[number]) => boolean) => {
    const choice = ranked.find((entry) => !used.has(entry.hex) && predicate(entry))
    if (!choice) return
    used.add(choice.hex)
    result.push({ name: choice.name, hex: choice.hex, reason: choice.evidence.reason, role })
  }
  take('safe', (choice) => choice.color.chroma <= rules.neutralChroma)
  take('harmony', (choice) => choice.evidence.relation === 'tone-on-tone' || choice.evidence.relation === 'tone-in-tone')
  if (!result.some((entry) => entry.role === 'harmony')) take('harmony', (choice) => choice.color.chroma <= rules.supportChroma)
  take('accent', (choice) => choice.evidence.relation === 'accent')
  return result
}
