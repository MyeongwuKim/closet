import type { BodyBuild, ClothingCategory, Gender } from '@prisma/client'

interface BodyProportions {
  gender?: Gender | null
  bodyBuild?: BodyBuild | null
  heightCm?: number | null
  weightKg?: number | null
  chestCircumferenceCm?: number | null
  waistCircumferenceCm?: number | null
  hipCircumferenceCm?: number | null
  thighCircumferenceCm?: number | null
  shoulderWidthCm?: number | null
  inseamCm?: number | null
}

interface GarmentProportions {
  category: ClothingCategory | null
  totalLengthCm?: number | null
  chestWidthCm?: number | null
  waistWidthCm?: number | null
  hipWidthCm?: number | null
  thighWidthCm?: number | null
  subcategory?: string | null
  shoulderWidthCm?: number | null
  sleeveLengthCm?: number | null
  fashionAttributes?: unknown
}

const bodyBuildGuides: Record<BodyBuild, string> = {
  slim: 'Use a relatively slender frame consistent with the saved body mass and measurements. The slim label must not erase body volume required by the numeric profile or turn the adult into an underweight caricature.',
  average: 'The average selection describes an ordinary, non-athletic build; it is not a medium-weight or slim-waist preset. Do not add athletic definition.',
  athletic: 'Use a naturally trained muscular build with volume in the shoulders, chest, arms and thighs consistent with the saved measurements. Do not exaggerate it into competition-bodybuilder bulk or draw muscle definition through thick or loose clothing.',
  broad: 'Use a larger skeletal frame and fuller body volume consistent with the saved measurements. A broad build does not mean athletic or visibly muscular; do not add muscle definition or assume a particular body-fat percentage.',
}

function isPositiveMeasurement(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0
}

function formatCm(value: number) {
  return Number(value.toFixed(1)).toString()
}

/** 키 대비 체중을 전체 볼륨의 근사 보조값으로 쓰고, 저장된 부위의 실측은 이 값으로 덮어쓰지 않는다. */
function describeBodyMassSilhouette(body?: BodyProportions | null) {
  if (!isPositiveMeasurement(body?.heightCm) || !isPositiveMeasurement(body?.weightKg)) return null
  const massIndex = body.weightKg / (body.heightCm / 100) ** 2
  const basis = `Numeric body-mass cue: weightKg / heightMeters^2 = ${massIndex.toFixed(1)}. This is a rough visual size cue, not an exact body-fat measurement or medical diagnosis.`
  const hasTorsoCircumference = [body.chestCircumferenceCm, body.waistCircumferenceCm, body.hipCircumferenceCm].some(isPositiveMeasurement)
  if (!body.bodyBuild || body.bodyBuild === 'athletic') {
    return `${basis} Follow the supplied circumferences and build for body shape; do not infer abdominal fat or exact girths from this cue.`
  }
  if (massIndex >= 25 && hasTorsoCircumference) {
    const missingWaist = isPositiveMeasurement(body.waistCircumferenceCm)
      ? ''
      : ' Let the unmeasured midsection carry a plausible share of that volume.'
    return `${basis} Retain the fuller overall volume at the saved stature, using this cue only in regions without saved measurements, such as the exposed upper arms.${missingWaist} Blend the unmeasured regions naturally into the measured contours; do not infer abdominal fat or exact girths from this cue.`
  }
  if (massIndex >= 30) {
    const subject = body.gender === 'female' ? 'adult woman' : 'adult'
    return `${basis} For this non-athletic ${subject} with no saved torso circumferences, use a clearly plus-size, full-bodied build. The figure must look visibly wider relative to the saved height: preserve a broad waist and a rounded abdomen that projects naturally in the three-quarter view, with fuller hips, upper arms and thighs where unmeasured. Show the volume through the outer contour and the way the fabric hangs over it. Keep the actual stature and avoid elongating the legs or narrowing the waist to create a runway silhouette. Keep the result natural and respectful.`
  }
  if (massIndex >= 25) {
    return `${basis} For this non-athletic adult with no saved torso circumferences, use a visibly heavier-set build with a rounded soft abdomen, a fuller waist and hips, and fuller upper arms and thighs where unmeasured. Do not flatten the waist or replace this softness with athletic muscle definition.`
  }
  return `${basis} Keep realistic adult body volume consistent with the profile; do not add a larger abdomen without support from the supplied measurements.`
}

/** 입력한 부위만 실측으로 고정하고, 값이 없는 부위에는 키·체중·체형을 함께 쓰도록 안내한다. */
function describeBodyMeasurementMode(body?: BodyProportions | null) {
  const measurements = [
    ['shoulder width', body?.shoulderWidthCm],
    ['chest circumference', body?.chestCircumferenceCm],
    ['waist circumference', body?.waistCircumferenceCm],
    ['hip circumference', body?.hipCircumferenceCm],
    ['upper thigh circumference', body?.thighCircumferenceCm],
    ['inseam', body?.inseamCm],
  ] as const
  const saved = measurements.flatMap(([region, value]) =>
    isPositiveMeasurement(value) ? [`${region}=${formatCm(value)}cm`] : [])
  if (!saved.length) {
    return 'Body profile basis: overall silhouette from the available height, weight and build. No detailed body measurements were saved. Show the body size through the width and depth of the body at the saved stature and how the clothes drape over it. Keep regional fit approximate and never guess numeric body measurements or ease.'
  }

  const waist = body?.waistCircumferenceCm
  const hips = body?.hipCircumferenceCm
  const waistToHip = isPositiveMeasurement(waist) && isPositiveMeasurement(hips)
    ? ` Waist-to-hip circumference ratio=${formatCm(waist / hips * 100)}%. Use the supplied difference to shape the waist and hip contours under the clothes. This is a circumference relationship, not a ratio of front-view widths.`
    : ''
  return `Body profile basis: measured regional silhouette. Use each saved measurement as a separate shape anchor: ${saved.join(', ')}. Apply height, weight and build to the overall frame and infer only the unmeasured regions. Do not replace a measured shape with a generic distribution for this body weight.${waistToHip}`
}

/** 신체 실측 유무에 맞춰 전신 비율과 부위별 체형 근거를 생성 요청 앞에 전달한다. */
export function getLookbookBodyProportionGuide(body?: BodyProportions | null) {
  const savedBodyMass = isPositiveMeasurement(body?.heightCm) && isPositiveMeasurement(body?.weightKg)
    ? `Saved numeric body size: heightCm=${formatCm(body.heightCm)}; weightKg=${formatCm(body.weightKg)}. These values must visibly inform overall body volume. At the same height, a substantially heavier non-athletic profile must not be drawn with the same slender torso, waist, abdomen and limbs as a lighter profile merely because both selected average. Do not use a muscular body as a substitute for heavier non-athletic body volume.`
    : 'Height or weight is missing; use the available measurements without inventing an exact missing height or weight.'
  return [
    'Use the saved height, weight and detailed body measurements together; do not substitute a default tall, thin runway body.',
    'Explicit shoulder, chest, waist, hip, thigh and inseam measurements take priority over generic body-build shorthand or idealized gender proportions.',
    describeBodyMeasurementMode(body),
    isPositiveMeasurement(body?.thighCircumferenceCm)
      ? `Saved body thigh circumference=${formatCm(body.thighCircumferenceCm)}cm around ONE upper thigh, not the combined width of both legs. Preserve this upper-leg volume under the clothing; do not substitute default slender thighs to make trousers look comfortably fitted.`
      : null,
    savedBodyMass,
    'When a body-build label conflicts with the numeric profile, preserve the explicit body measurements first, then the height and weight as the basis for overall body size. Use the build label only to guide frame and distribution within those constraints, never to normalize the person to an average-sized body.',
    describeBodyMassSilhouette(body),
    body?.bodyBuild ? bodyBuildGuides[body.bodyBuild] : 'No body build was selected; do not invent athletic definition.',
    'Weight alone does not determine muscle mass, body-fat percentage or exact body shape. Use the saved weight even when circumferences are missing, without inventing exact girths, a body-fat percentage or a medical diagnosis. Keep the body size consistent under the clothes; do not change the body to make a garment fit.',
    'Keep the body under the clothes anatomically plausible; garment volume and drape must remain distinct from the body silhouette.',
  ].filter(Boolean).join(' ')
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

/**
 * 한 부위의 약식 여유를 신체 둘레 대비 비율과 직접적인 그림 지침으로 변환한다.
 * 3%·15% 경계는 이 제품의 거친 시각적 대비용 휴리스틱이며 의류 표준이나 실착 핏 판정 기준이 아니다.
 */
function describeLowerGarmentRegionEase(region: 'waist' | 'hip' | 'thigh', flatWidthCm: number, bodyCircumferenceCm: number) {
  const easeCm = flatWidthCm * 2 - bodyCircumferenceCm
  const relativeEase = easeCm / bodyCircumferenceCm
  const label = region === 'waist' ? 'Waist' : region === 'hip' ? 'Hip' : 'Thigh'
  const visualCue = easeCm < 0
    ? `negative: there is nominally less garment circumference than the measured ${region}; do not render this region as roomy. Show plausible stretching, fabric tension or closure strain only when supported by the reference fabric and construction.`
    : relativeEase <= 0.03
      ? `close: keep the fabric close to the measured ${region} with minimal spare fabric or gaping at this region; do not inflate this measured region into a baggy fit.`
      : relativeEase >= 0.15
        ? `roomy: render visibly loose room and spare fabric around the measured ${region}, including gaping where the reference construction permits; do not make this region sit flush like a close fit.`
        : `moderate: render noticeable but not excessive spare fabric and body-to-garment room around the measured ${region}; do not make it skin-tight or exaggerate it into oversized volume.`
  return `nominal${label}EaseCm=${formatCm(easeCm)} (twice garment flat ${region} width minus body ${region} circumference); nominal${label}EasePercent=${formatCm(relativeEase * 100)}% (nominal ease divided by body circumference); ${region}VisualCue=${visualCue}`
}

/**
 * 상의의 가슴·어깨 또는 하의의 허리·엉덩이·허벅지 실측을 신체와 비교해 약식 여유를 전달한다.
 * 하의는 값이 있는 부위의 여유·상대 비율·직접적인 드레이프 지침을 전달하며, 원단·패턴을 반영한 실제 착용 판정은 하지 않는다.
 */
export function describeLookbookGarmentEase(item: GarmentProportions, body?: BodyProportions | null) {
  if (item.category === 'bottom') {
    const values: string[] = []
    if (isPositiveMeasurement(item.waistWidthCm) && isPositiveMeasurement(body?.waistCircumferenceCm)) {
      values.push(describeLowerGarmentRegionEase('waist', item.waistWidthCm, body.waistCircumferenceCm))
    }
    if (isPositiveMeasurement(item.hipWidthCm) && isPositiveMeasurement(body?.hipCircumferenceCm)) {
      values.push(describeLowerGarmentRegionEase('hip', item.hipWidthCm, body.hipCircumferenceCm))
    }
    if (isPositiveMeasurement(item.thighWidthCm)
      && isPositiveMeasurement(body?.thighCircumferenceCm)
      && !/스커트|치마|skirt/iu.test(item.subcategory ?? '')) {
      values.push(describeLowerGarmentRegionEase('thigh', item.thighWidthCm, body.thighCircumferenceCm))
      values.push('The garment thigh width is the flat width of ONE trouser leg at the upper thigh; doubling it is an approximate circumference of that one leg. Compare it with the saved circumference of ONE body thigh, never the hip circumference or the combined width of both legs. Do not slim the body thigh or enlarge the trouser leg to hide this relationship. Apply the cue at the upper thigh only; preserve the referenced knee, calf and hem cut unless their own measurements support a change.')
      if (item.thighWidthCm * 2 === body.thighCircumferenceCm) {
        values.push('These supplied thigh measurements leave ZERO nominal spare circumference at the measured upper thigh. Render close fabric contact there, with plausible tension following the reference material, rather than roomy hanging fabric or a comfortable regular-fit gap.')
      }
    }
    if (!values.length) return null
    return [
      `${values.join('; ')}. These are approximate proportion cues, not an exact fitting simulation.`,
      'The close, moderate and roomy cues use product-specific rough rendering ranges: non-negative ease up to 3% of the body circumference is close, at least 15% is roomy, and the intervening range is moderate. These are visual heuristics, not apparel standards or real-world fit judgments.',
      'Apply the fit cues only to the measured regions with computed ease; do not infer an unmeasured waist, hip or body thigh circumference.',
      'Near-zero ease should read as a closer, less spacious fit around that region. Larger positive ease should remain visible as more room between the body and garment, including waistband gaping or spare fabric around the hips when supported by the reference construction; do not make every size look like the same regular fit.',
      'For negative ease, show plausible stretching, fabric tension or closure strain only when supported by the reference fabric and construction. Do not force an impossibly closed waistband or imply a comfortable fit when the measurements conflict.',
      'Keep the measured body and garment unchanged. Do not shrink the wearer, enlarge the garment, move the waistband to a different body level, or invent a belt, elastic or other fastening to hide excess room or a size mismatch.',
      'Account for the reference fabric, cut, rise and waistband position. Preserve the lower garment\'s leg or skirt shape; hip ease alone does not establish exact thigh tightness.',
    ].join(' ')
  }
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
