import type { ClothingCategory } from '@prisma/client'

interface LayerLayoutItem {
  category: ClothingCategory | null
  totalLengthCm?: number | null
  sleeveLengthCm?: number | null
  fashionAttributes?: unknown
}

/** 참조 사진의 1-based 번호와 실측 총장을 공통 어깨선에 정렬한 내부 보조 도식이다. */
export interface LookbookLayerLayoutPlan {
  svg: string
  guide: string
  innerReferenceIndex: number
  outerReferenceIndex: number
  innerLengthCm: number
  outerLengthCm: number
  innerSleeveLengthCm?: number
  outerSleeveLengthCm?: number
}

const WIDTH = 768
const HEIGHT = 960
const SHOULDER_Y = 160
const MAX_DRAWN_LENGTH = 640

function isValidLength(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0
}

function canOpenFront(attributes: unknown) {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return false
  return ['buttons', 'zipper', 'wrap'].includes(String((attributes as Record<string, unknown>).frontOpeningStyle))
}

/**
 * 실측이 있는 상의 한 벌과 완전히 앞을 여는 아우터 한 벌의 상대 기장을 같은 축척으로 그린다.
 * 소매 실측이 있으면 같은 비교 시작점의 소매끝 깊이를 더하되 실제 봉제점·커프 간격은 확정하지 않는다.
 * 중간옷·복수 상의·복수 아우터나 불명확한 여밈은 도식에서 생략하며, 인체·허리 위치는 추정하지 않는다.
 */
export function buildLookbookLayerLayout(items: LayerLayoutItem[]): LookbookLayerLayoutPlan | null {
  const innerItems = items.flatMap((item, index) => item.category === 'top' ? [{ item, index }] : [])
  const outerItems = items.flatMap((item, index) => item.category === 'outer' ? [{ item, index }] : [])
  if (innerItems.length !== 1 || outerItems.length !== 1 || items.some((item) => item.category === 'midlayer')) return null
  const inner = innerItems[0]!
  const outer = outerItems[0]!
  const innerLengthCm = inner.item.totalLengthCm
  const outerLengthCm = outer.item.totalLengthCm
  if (!isValidLength(innerLengthCm) || !isValidLength(outerLengthCm) || !canOpenFront(outer.item.fashionAttributes)) return null

  // 길이를 먼저 최대 실측으로 나눠 축척을 맞추므로 큰 유한값에서도 좌표가 넘치지 않는다.
  const innerSleeveLengthCm = isValidLength(inner.item.sleeveLengthCm) ? inner.item.sleeveLengthCm : undefined
  const outerSleeveLengthCm = isValidLength(outer.item.sleeveLengthCm) ? outer.item.sleeveLengthCm : undefined
  const maximumLength = Math.max(innerLengthCm, outerLengthCm, innerSleeveLengthCm ?? 0, outerSleeveLengthCm ?? 0)
  const innerHeight = innerLengthCm / maximumLength * MAX_DRAWN_LENGTH
  const outerHeight = outerLengthCm / maximumLength * MAX_DRAWN_LENGTH
  const innerHemY = SHOULDER_Y + innerHeight
  const outerHemY = SHOULDER_Y + outerHeight
  const innerSleeveHeight = innerSleeveLengthCm == null ? undefined : innerSleeveLengthCm / maximumLength * MAX_DRAWN_LENGTH
  const outerSleeveHeight = outerSleeveLengthCm == null ? undefined : outerSleeveLengthCm / maximumLength * MAX_DRAWN_LENGTH
  const innerReferenceIndex = inner.index + 1
  const outerReferenceIndex = outer.index + 1
  const innerLabel = `INNER - reference ${innerReferenceIndex} - ${innerLengthCm} cm`
  const outerLabel = `OUTER - reference ${outerReferenceIndex} - ${outerLengthCm} cm`
  const hasSleeves = innerSleeveHeight != null || outerSleeveHeight != null
  const innerUnderarmY = SHOULDER_Y + Math.min(68, innerHeight * 0.35, (innerSleeveHeight ?? innerHeight) * 0.35)
  const outerUnderarmY = SHOULDER_Y + Math.min(68, outerHeight * 0.35, (outerSleeveHeight ?? outerHeight) * 0.35)
  const innerCuffY = innerSleeveHeight == null ? undefined : SHOULDER_Y + innerSleeveHeight
  const outerCuffY = outerSleeveHeight == null ? undefined : SHOULDER_Y + outerSleeveHeight
  const innerSleeveOutline = innerCuffY == null ? '' : `M264 ${SHOULDER_Y}H234L184 ${innerCuffY}H244L264 ${innerUnderarmY}M504 ${SHOULDER_Y}H534L584 ${innerCuffY}H524L504 ${innerUnderarmY}`
  const innerBody = innerCuffY == null
    ? `<rect x="264" y="${SHOULDER_Y}" width="240" height="${innerHeight}" fill="#e7f0ff" stroke="#2461a3" stroke-width="4"/>`
    : `<path d="M264 ${SHOULDER_Y}H234L184 ${innerCuffY}H244L264 ${innerUnderarmY}V${innerHemY}H504V${innerUnderarmY}L524 ${innerCuffY}H584L534 ${SHOULDER_Y}H504Z" fill="#e7f0ff" stroke="#2461a3" stroke-width="4"/>`
  const outerSleeves = outerCuffY == null ? '' : `<g id="outer-sleeves" data-length-cm="${outerSleeveLengthCm}" data-start-y="${SHOULDER_Y}" data-end-y="${outerCuffY}"><path d="M196 ${SHOULDER_Y}H160L108 ${outerCuffY}H180L196 ${outerUnderarmY}ZM572 ${SHOULDER_Y}H608L660 ${outerCuffY}H588L572 ${outerUnderarmY}Z" fill="#eee8dc" stroke="#79684b" stroke-width="4"/><path d="M108 ${outerCuffY}H180M588 ${outerCuffY}H660" stroke="#79684b" stroke-width="6"/></g>`
  // 안쪽 소매는 겉옷에 가려져도 길이 비교에 쓸 수 있도록 점선의 투시 윤곽으로 따로 표시한다.
  const innerSleeveOverlay = innerCuffY == null ? '' : `<g id="inner-sleeves" data-length-cm="${innerSleeveLengthCm}" data-start-y="${SHOULDER_Y}" data-end-y="${innerCuffY}" fill="none" stroke="#2461a3" stroke-width="3" stroke-dasharray="8 6"><path d="${innerSleeveOutline}"/><path d="M184 ${innerCuffY}H244M524 ${innerCuffY}H584" stroke-width="5"/></g>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
  <g font-family="Arial, sans-serif" fill="#192b3a">
    <text x="384" y="44" text-anchor="middle" font-size="24" font-weight="700">MEASURED LAYER LAYOUT</text>
    <text x="384" y="72" text-anchor="middle" font-size="14">AUXILIARY GEOMETRY ONLY - NOT AN EXTRA GARMENT</text>
    <text x="384" y="119" text-anchor="middle" font-size="17">COMMON SHOULDER MEASUREMENT LINE</text>
    <text x="384" y="145" text-anchor="middle" font-size="13">Same vertical scale for both garments. No body or waist position inferred.</text>
  </g>
  <g id="inner-layer" data-reference-index="${innerReferenceIndex}" data-length-cm="${innerLengthCm}" data-start-y="${SHOULDER_Y}" data-end-y="${innerHemY}">
    ${innerBody}
  </g>
  ${outerSleeves}
  <g id="outer-layer" data-reference-index="${outerReferenceIndex}" data-length-cm="${outerLengthCm}" data-start-y="${SHOULDER_Y}" data-end-y="${outerHemY}" fill="#eee8dc" stroke="#79684b" stroke-width="4">
    <rect x="196" y="${SHOULDER_Y}" width="96" height="${outerHeight}"/>
    <rect x="476" y="${SHOULDER_Y}" width="96" height="${outerHeight}"/>
  </g>
  ${innerSleeveOverlay}
  <path d="M108 ${SHOULDER_Y}H660" stroke="#4b555d" stroke-width="2" stroke-dasharray="8 6"/>
  <path d="M292 ${innerHemY}H476" stroke="#2461a3" stroke-width="6"/>
  <path d="M${hasSleeves ? 64 : 112} ${SHOULDER_Y}V${outerHemY}M${hasSleeves ? 54 : 102} ${SHOULDER_Y}H${hasSleeves ? 74 : 122}M${hasSleeves ? 54 : 102} ${outerHemY}H${hasSleeves ? 74 : 122}M${hasSleeves ? 56 : 104} ${outerHemY}H196" fill="none" stroke="#79684b" stroke-width="3"/>
  <path d="M${hasSleeves ? 704 : 656} ${SHOULDER_Y}V${innerHemY}M${hasSleeves ? 694 : 646} ${SHOULDER_Y}H${hasSleeves ? 714 : 666}M${hasSleeves ? 694 : 646} ${innerHemY}H${hasSleeves ? 714 : 666}M504 ${innerHemY}H${hasSleeves ? 712 : 664}" fill="none" stroke="#2461a3" stroke-width="3"/>
  <g font-family="Arial, sans-serif" font-size="18" font-weight="700">
    <text x="${hasSleeves ? 36 : 82}" y="${SHOULDER_Y + outerHeight / 2}" fill="#79684b" text-anchor="middle" transform="rotate(-90 ${hasSleeves ? 36 : 82} ${SHOULDER_Y + outerHeight / 2})">${outerLabel}</text>
    <text x="${hasSleeves ? 740 : 698}" y="${SHOULDER_Y + innerHeight / 2}" fill="#2461a3" text-anchor="middle" transform="rotate(-90 ${hasSleeves ? 740 : 698} ${SHOULDER_Y + innerHeight / 2})">${innerLabel}</text>
    <text x="384" y="851" fill="#2461a3" text-anchor="middle">${innerLabel}</text>
    <text x="384" y="879" fill="#79684b" text-anchor="middle">${outerLabel}</text>
  </g>
  <g font-family="Arial, sans-serif" font-size="14" fill="#46515a" text-anchor="middle">
    ${innerSleeveLengthCm == null ? '' : `<text x="384" y="903" fill="#2461a3">INNER SLEEVE - reference ${innerReferenceIndex} - ${innerSleeveLengthCm} cm (dashed)</text>`}
    ${outerSleeveLengthCm == null ? '' : `<text x="384" y="924" fill="#79684b">OUTER SLEEVE - reference ${outerReferenceIndex} - ${outerSleeveLengthCm} cm</text>`}
    <text x="384" y="${hasSleeves ? 946 : 916}" font-size="${hasSleeves ? 12 : 14}">${hasSleeves ? 'Sleeves share a comparison origin; actual seam anchors and drape can differ.' : "The open center reveals the inner garment's free-hanging hem."}</text>
    ${hasSleeves ? '' : '<text x="384" y="938">Use the garment photos for all design, color, material and width details.</text>'}
  </g>
</svg>`

  const guide = [
    'The last input image is an auxiliary measured layer layout, NOT a garment reference and NOT an extra item to wear.',
    `Its inner layer corresponds to reference image ${innerReferenceIndex} (${innerLengthCm} cm shoulder to hem), and its open outer layer to reference image ${outerReferenceIndex} (${outerLengthCm} cm shoulder to hem).`,
    'Use its shared shoulder line and common vertical scale to preserve the relative hem depths, including the complete free-hanging inner hem visible through the existing open front.',
    innerSleeveLengthCm == null ? null : `Reference image ${innerReferenceIndex} has saved sleeve length ${innerSleeveLengthCm} cm as well as body total length ${innerLengthCm} cm. The dashed inner sleeve outline is a comparative measurement cue through the coat, not visible stitching or an instruction to put the inner sleeve over the coat.`,
    outerSleeveLengthCm == null ? null : `Reference image ${outerReferenceIndex} has saved sleeve length ${outerSleeveLengthCm} cm as well as body total length ${outerLengthCm} cm. Its outer sleeve outline uses the same comparison scale.`,
    hasSleeves ? 'Sleeve and body lengths share a schematic comparison origin only: actual shoulder seam placement, dropped shoulders and garment construction may use different measurement anchors. Do not interpret their numeric difference as an exact visible cuff-to-hem gap.' : null,
    'The layout controls vertical geometry only. The original garment photos, saved body measurements and garment measurements determine garment identity, neckline, closures, sleeves, width, fit, colors, fabric and details.',
    'The diagram does not specify a body, waist position or exact physical drape. Never copy its schematic rectangles, colors, linework, numbers, labels or text into the final photorealistic image.',
    'Render only the single dressed model; do not include the diagram, a second view or a collage.',
  ].filter(Boolean).join(' ')
  return { svg, guide, innerReferenceIndex, outerReferenceIndex, innerLengthCm, outerLengthCm, ...(innerSleeveLengthCm == null ? {} : { innerSleeveLengthCm }), ...(outerSleeveLengthCm == null ? {} : { outerSleeveLengthCm }) }
}

/** 필요한 요청에서만 로컬 SVG를 PNG로 변환한다. 파일 저장이나 외부 통신을 수행하지 않는다. */
export async function renderLookbookLayerLayout(layout: LookbookLayerLayoutPlan) {
  const { RawImage } = await import('@huggingface/transformers')
  const image = await RawImage.fromBlob(new Blob([layout.svg], { type: 'image/svg+xml' }))
  const bytes = await image.toSharp().png().toBuffer()
  return { bytes: new Uint8Array(bytes), mimeType: 'image/png' as const }
}
