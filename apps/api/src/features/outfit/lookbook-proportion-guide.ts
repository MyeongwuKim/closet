import type { BodyBuild, ClothingCategory } from '@prisma/client'

interface BodyProportions {
  bodyBuild?: BodyBuild | null
  chestCircumferenceCm?: number | null
  shoulderWidthCm?: number | null
}

interface GarmentProportions {
  category: ClothingCategory | null
  totalLengthCm?: number | null
  chestWidthCm?: number | null
  shoulderWidthCm?: number | null
  sleeveLengthCm?: number | null
  fashionAttributes?: unknown
}

const bodyBuildGuides: Record<BodyBuild, string> = {
  slim: 'Keep a slender frame and lower body volume without turning the adult into an underweight caricature.',
  average: 'Use an ordinary adult build consistent with the saved measurements, without adding athletic definition.',
  athletic: 'Use a naturally trained muscular build with volume in the shoulders, chest, arms and thighs consistent with the saved measurements. Do not exaggerate it into competition-bodybuilder bulk or draw muscle definition through thick or loose clothing.',
  broad: 'Use a larger skeletal frame and fuller body volume consistent with the saved measurements. A broad build does not mean athletic or visibly muscular; do not add muscle definition or assume a particular body-fat percentage.',
}

function isPositiveMeasurement(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0
}

function formatCm(value: number) {
  return Number(value.toFixed(1)).toString()
}

/** 체형 선택을 보조 지침으로 해석하며, 실제 입력 치수를 일반적인 모델 체형보다 우선한다. */
export function getLookbookBodyProportionGuide(body?: BodyProportions | null) {
  return [
    'Use the saved height, weight and detailed body measurements together; do not substitute a default tall, thin runway body.',
    'Explicit shoulder, chest, waist, hip and inseam measurements take priority over generic body-build shorthand or idealized gender proportions.',
    body?.bodyBuild ? bodyBuildGuides[body.bodyBuild] : 'No body build was selected; do not invent athletic definition.',
    'Weight alone does not determine muscle mass, body-fat percentage or exact body shape. Do not invent missing measurements, and do not change the body to make a garment fit.',
    'Keep the body under the clothes anatomically plausible; garment volume and drape must remain distinct from the body silhouette.',
  ].join(' ')
}

/**
 * 어깨에서 재는 상의류의 총장을 키 대비 비율로 전달한다.
 * 인체 비율이 없는 상태에서 특정 골반·무릎 위치를 확정하거나 긴 코트를 짧은 기장으로 제한하지 않는다.
 */
export function getLookbookHemTarget(
  category: ClothingCategory | null,
  totalLengthCm?: number | null,
  modelHeightCm?: number | null,
) {
  if (
    !category || !['top', 'outer', 'midlayer'].includes(category) ||
    !isPositiveMeasurement(totalLengthCm) || !isPositiveMeasurement(modelHeightCm)
  ) return null

  const ratio = totalLengthCm / modelHeightCm
  // 생성 모델이 긴 이너도 보통 티셔츠로 정규화하지 않도록 대략적인 길이 인상을 덧붙인다.
  // 정확한 인체 위치를 계산하는 규칙은 아니며, 총장 비율·실제 참조와 신체 치수가 우선한다.
  const topSilhouetteCue = category !== 'top' || ratio < 0.4
    ? null
    : ratio >= 1
      ? 'a floor-trailing extra-long top body'
      : ratio >= 0.7
        ? 'a very long top body continuing toward the lower leg or ankle'
        : ratio >= 0.6
          ? 'a long top body extending below the knee toward the calf'
          : ratio >= 0.55
            ? 'a very long top body continuing toward the knee area'
          : ratio >= 0.5
            ? 'an elongated longline top whose hem reaches the lower-thigh area above the knee, below the relaxed fingertips in the arms-down pose'
            : ratio >= 0.45
              ? 'an elongated top body continuing toward the mid-thigh area'
              : 'a hip-covering long top whose hem continues past the full hips toward the upper-thigh area, instead of stopping at the trouser waistband'
  const silhouetteGuide = topSilhouetteCue
    ? ` Rough silhouette sanity check for this saved height: preserve ${topSilhouetteCue}. Do not shorten it into a standard waist-length or upper-hip T-shirt merely because its name or category says T-shirt. This is not an exact anatomical landmark prediction; retain the measured length and reference proportions.`
    : ''
  return `shoulderToHemCm=${formatCm(totalLengthCm)}; garmentLengthToModelHeight=${(ratio * 100).toFixed(1)}%; interpret this as shoulder-to-hem length, not height above the ground. Place the hem using the saved body proportions and the reference construction, without imposing a universal waist or hip cutoff. Never shorten a long coat to jacket or hip length.${silhouetteGuide}`
}

/** 몸판과 소매의 실측을 함께 전달해 긴 몸판을 보통 티셔츠 길이로 줄이지 않도록 한다. 봉제 시작점 차이로 실제 밑단 간격을 확정하지 않는다. */
export function describeLookbookSleeveHemRelation(item: GarmentProportions) {
  if (!item.category || !['top', 'outer', 'midlayer'].includes(item.category) ||
    !isPositiveMeasurement(item.totalLengthCm) || !isPositiveMeasurement(item.sleeveLengthCm)) return null
  return `bodyLengthCm=${formatCm(item.totalLengthCm)}; sleeveLengthCm=${formatCm(item.sleeveLengthCm)}; nominalBodyMinusSleeveLengthCm=${formatCm(item.totalLengthCm - item.sleeveLengthCm)}. Preserve the reference's body-hem versus sleeve-cuff relationship in the arms-down pose. A visibly elongated body must stay elongated, including below the cuffs where shown in the reference; do not normalize it into a standard short T-shirt. Sleeve and body measurement anchors can differ, so this difference is not an exact exposed hem gap.`
}

/** 가슴 단면을 약식 둘레로 환산해 신체와의 여유 차이를 전달한다. 원단·패턴을 반영한 실제 착용 판정은 아니다. */
export function describeLookbookGarmentEase(item: GarmentProportions, body?: BodyProportions | null) {
  if (!item.category || !['top', 'outer', 'midlayer', 'dress'].includes(item.category)) return null
  const values: string[] = []
  if (isPositiveMeasurement(item.chestWidthCm) && isPositiveMeasurement(body?.chestCircumferenceCm)) {
    values.push(`nominalChestEaseCm=${formatCm(item.chestWidthCm * 2 - body.chestCircumferenceCm)} (twice garment flat chest width minus body chest circumference)`)
  }
  if (isPositiveMeasurement(item.shoulderWidthCm) && isPositiveMeasurement(body?.shoulderWidthCm)) {
    values.push(`garmentMinusBodyShoulderWidthCm=${formatCm(item.shoulderWidthCm - body.shoulderWidthCm)}`)
  }
  if (!values.length) return null
  return `${values.join('; ')}. These are approximate proportion cues, not an exact fitting simulation; keep the measured garment and body unchanged, accounting for reference fabric, cut and any layers underneath.`
}

const layerOrder: Partial<Record<ClothingCategory, number>> = { top: 0, midlayer: 1, outer: 2 }

function hasFullFrontOpening(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return ['buttons', 'zipper', 'wrap'].includes(String((value as Record<string, unknown>).frontOpeningStyle))
}

/**
 * 서로 다른 레이어의 상의 총장을 비교해 이너·겉옷 밑단의 순서를 안내한다.
 * 앞이 완전히 열리는 겉옷은 이너의 자유 밑단을 드러내고, 못 여는 겉옷은 자연스러운 가림을 허용한다.
 * 실측이 없는 사진의 픽셀 크기에서 cm나 바지 허리 높이를 추정하지 않는다.
 */
export function getLookbookLayerLengthGuide(items: GarmentProportions[]) {
  const layers = items.flatMap((item, index) => {
    const order = item.category ? layerOrder[item.category] : undefined
    return order == null ? [] : [{ item, index, order }]
  })
  if (!layers.some((inner) => layers.some((outer) => inner.order < outer.order))) return null

  const guides = [
    'Layer from the body outward as top, then midlayer, then outer. Preserve each referenced garment as a separate layer with its own neckline, sleeves and hem; never fuse the layers or copy one hem onto every garment.',
    'Compare saved upper-garment total lengths using their normal shoulder-to-hem convention, excluding collars and hoods. A nominal length difference guides hem ordering, not an exact exposed strip in cm: body volume, construction and drape affect the visible difference.',
    'Separate product photos are independently scaled; their pixel heights do not establish real garment lengths. If either measurement is missing, follow the visible reference proportions without inventing a numeric difference.',
    'For full-front-opening coats or jackets, leave the existing front open down past the measured hem of the immediately visible inner layer so its free-hanging bottom edge is visible inside the opening. Respect natural coverage by other selected layers. Never add a front opening to a pullover or half-zip, move closures, or shorten an outer layer just to expose an inner hem.',
    'Place an untucked inner in front of the trousers, not behind their waistband. Its measured shoulder-to-hem depth determines where it ends; the trouser waistband is not a hem target. Let the inner cover the trouser front and waistband wherever its actual length reaches, without hiding a tuck behind the coat. A genuinely shorter reference may end above the waistband.',
  ]

  for (const inner of layers) {
    for (const outer of layers) {
      if (inner.order >= outer.order) continue
      const innerLength = inner.item.totalLengthCm
      const outerLength = outer.item.totalLengthCm
      if (!isPositiveMeasurement(innerLength) || !isPositiveMeasurement(outerLength)) continue
      const difference = innerLength - outerLength
      const hasInterveningLayer = layers.some((layer) => layer.order > inner.order && layer.order < outer.order)
      const canShowCompleteInnerHem = hasFullFrontOpening(outer.item.fashionAttributes) && !hasInterveningLayer
      const relation = difference > 0
        ? `The inner garment is nominally ${formatCm(difference)} cm longer. Let its untucked hem extend naturally below the shorter outer garment; do not crop, tuck or roll it to match the outer hem.`
        : difference < 0
          ? `The outer garment is nominally ${formatCm(-difference)} cm longer. Keep the inner hem above the outer hem; never lengthen the inner garment to show it below the outer garment. ${canShowCompleteInnerHem ? 'Show the complete free inner hem through the existing open front, hanging in front of the trousers at its measured depth. Keep the opening clear below this hem; do not use the coat panels to disguise a shortened or tucked inner.' : hasInterveningLayer ? 'An intervening selected layer may naturally cover this inner hem; do not remove or crop that layer to reveal it.' : 'Natural overlap may hide the inner hem when the outer construction does not allow opening the front.'}`
          : 'Their nominal lengths are equal. Keep their hems at approximately the same level, allowing natural drape without inventing a large exposed strip.'
      const alignedRatio = difference === 0
        ? 'Their shoulder-to-hem spans are equal from the common shoulder measurement line.'
        : innerLength < outerLength
        ? `From their common shoulder measurement line, the inner shoulder-to-hem span is approximately ${(innerLength / outerLength * 100).toFixed(1)}% of the outer span. Place the inner hem at that depth inside the outer front, rather than substituting a generic waist-length inner top.`
        : `From their common shoulder measurement line, the outer shoulder-to-hem span is approximately ${(outerLength / innerLength * 100).toFixed(1)}% of the inner span. Preserve this relative depth rather than making the hems match.`
      guides.push(`Inner reference image ${inner.index + 1} totalLengthCm=${formatCm(innerLength)}; outer reference image ${outer.index + 1} totalLengthCm=${formatCm(outerLength)}. ${relation} ${alignedRatio}`)
    }
  }
  return guides.join(' ')
}
