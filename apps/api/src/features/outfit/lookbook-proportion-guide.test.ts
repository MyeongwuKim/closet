import assert from 'node:assert/strict'
import test from 'node:test'
import {
  describeLookbookGarmentEase,
  describeLookbookSleeveHemRelation,
  getLookbookBodyProportionGuide,
  getLookbookHemTarget,
  getLookbookLayerLengthGuide,
} from './lookbook-proportion-guide.js'

test('긴 코트와 짧은 재킷은 키 대비 서로 다른 기장을 유지하며 골반 기장으로 통일하지 않는다', () => {
  const coat = getLookbookHemTarget('outer', 115, 165)
  const jacket = getLookbookHemTarget('outer', 58, 180)
  assert.match(coat!, /shoulderToHemCm=115; garmentLengthToModelHeight=69\.7%/)
  assert.match(jacket!, /shoulderToHemCm=58; garmentLengthToModelHeight=32\.2%/)
  assert.match(coat!, /not height above the ground/)
  assert.doesNotMatch(coat!, /computedUntuckedHemTarget=|lower-hip area/)
})

test('기장이나 키가 없거나 잘못되면 인체 위치를 계산하지 않는다', () => {
  for (const invalid of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(getLookbookHemTarget('outer', invalid, 170), null)
    assert.equal(getLookbookHemTarget('outer', 100, invalid), null)
  }
  assert.equal(getLookbookHemTarget('bottom', 100, 170), null)
  assert.equal(getLookbookHemTarget(null, 100, 170), null)
})

test('상의 길이 비율별 보조 인상을 구분해 긴 이너를 보통 티셔츠로 줄이지 않는다', () => {
  assert.match(getLookbookHemTarget('top', 85, 165)!, /longline top whose hem reaches the lower-thigh area/)
  assert.match(getLookbookHemTarget('top', 85, 165)!, /below the relaxed fingertips/)
  assert.match(getLookbookHemTarget('top', 70, 165)!, /past the full hips toward the upper-thigh area/)
  assert.match(getLookbookHemTarget('top', 85, 165)!, /not an exact anatomical landmark prediction/)
  assert.doesNotMatch(getLookbookHemTarget('top', 55, 165)!, /silhouette sanity check/)
  assert.match(getLookbookHemTarget('top', 120, 165)!, /lower leg or ankle/)
  assert.doesNotMatch(getLookbookHemTarget('top', 120, 165)!, /mid-thigh area/)
  assert.doesNotMatch(getLookbookHemTarget('outer', 115, 165)!, /silhouette sanity check/)
})

test('긴 몸판85와 소매56의 관계를 전달하되 실제 밑단 노출 간격으로 단정하지 않는다', () => {
  const guide = describeLookbookSleeveHemRelation({ category: 'top', totalLengthCm: 85, sleeveLengthCm: 56 })
  assert.match(guide!, /bodyLengthCm=85; sleeveLengthCm=56; nominalBodyMinusSleeveLengthCm=29/)
  assert.match(guide!, /including below the cuffs where shown in the reference/)
  assert.match(guide!, /not an exact exposed hem gap/)
  assert.equal(describeLookbookSleeveHemRelation({ category: 'top', totalLengthCm: 85 }), null)
  assert.equal(describeLookbookSleeveHemRelation({ category: 'bottom', totalLengthCm: 85, sleeveLengthCm: 56 }), null)
})

test('짧은 재킷58과 이너74는 입력 순서와 관계없이 이너가 16cm 길다는 관계를 전달한다', () => {
  const guide = getLookbookLayerLengthGuide([
    { category: 'outer', totalLengthCm: 58 },
    { category: 'bottom', totalLengthCm: 102 },
    { category: 'top', totalLengthCm: 74 },
  ])
  assert.match(guide!, /Inner reference image 3 totalLengthCm=74; outer reference image 1 totalLengthCm=58/)
  assert.match(guide!, /inner garment is nominally 16 cm longer/)
  assert.match(guide!, /hem extend naturally below the shorter outer garment/)
  assert.match(guide!, /not an exact exposed strip in cm/)
  assert.match(guide!, /outer shoulder-to-hem span is approximately 78\.4% of the inner span/)
  assert.doesNotMatch(guide!, /reference image 2/)
})

test('긴 코트115는 이너70보다 길고 기존 여밈이 있을 때만 열린 앞쪽으로 이너를 보여준다', () => {
  const guide = getLookbookLayerLengthGuide([
    { category: 'top', totalLengthCm: 70 },
    { category: 'outer', totalLengthCm: 115, fashionAttributes: { frontOpeningStyle: 'buttons' } },
  ])
  assert.match(guide!, /outer garment is nominally 45 cm longer/)
  assert.match(guide!, /inner hem above the outer hem/)
  assert.doesNotMatch(guide!, /Natural overlap may hide the inner hem/)
  assert.match(guide!, /through the existing open front/)
  assert.match(guide!, /hanging in front of the trousers at its measured depth/)
  assert.match(guide!, /do not use the coat panels to disguise a shortened or tucked inner/)
  assert.match(guide!, /trouser waistband is not a hem target/)
  assert.match(guide!, /inner shoulder-to-hem span is approximately 60\.9% of the outer span/)
  const pullover = getLookbookLayerLengthGuide([
    { category: 'top', totalLengthCm: 70 },
    { category: 'outer', totalLengthCm: 115, fashionAttributes: { frontOpeningStyle: 'halfZip' } },
  ])
  assert.doesNotMatch(pullover!, /through the existing open front/)
  assert.match(pullover!, /Natural overlap may hide the inner hem when the outer construction does not allow opening the front/)
})

test('실측 누락은 사진 크기로 보완하지 않으며 같은 레이어의 순서를 임의로 정하지 않는다', () => {
  const guide = getLookbookLayerLengthGuide([
    { category: 'top', totalLengthCm: 70 },
    { category: 'outer' },
  ])
  assert.match(guide!, /pixel heights do not establish real garment lengths/)
  assert.doesNotMatch(guide!, /nominally \d+ cm longer/)
  assert.equal(getLookbookLayerLengthGuide([{ category: 'top' }, { category: 'top' }]), null)
})

test('상의·중간옷·아우터 각각의 기장 관계를 보존하고 같은 기장은 노출 띠를 만들지 않는다', () => {
  const guide = getLookbookLayerLengthGuide([
    { category: 'outer', totalLengthCm: 110 },
    { category: 'top', totalLengthCm: 70 },
    { category: 'midlayer', totalLengthCm: 70 },
  ])!
  assert.equal((guide.match(/Inner reference image/g) ?? []).length, 3)
  assert.match(guide, /Their nominal lengths are equal/)
  assert.match(guide, /without inventing a large exposed strip/)
  assert.match(guide, /shoulder-to-hem spans are equal from the common shoulder measurement line/)
  assert.equal((guide.match(/outer garment is nominally 40 cm longer/g) ?? []).length, 2)
})

test('열린 코트 안에 닫힌 중간옷이 있으면 안쪽 상의를 억지로 드러내지 않는다', () => {
  const guide = getLookbookLayerLengthGuide([
    { category: 'top', totalLengthCm: 70 },
    { category: 'midlayer', totalLengthCm: 90, fashionAttributes: { frontOpeningStyle: 'none' } },
    { category: 'outer', totalLengthCm: 115, fashionAttributes: { frontOpeningStyle: 'buttons' } },
  ])!
  const nonAdjacent = guide.slice(guide.indexOf('Inner reference image 1 totalLengthCm=70; outer reference image 3'), guide.indexOf('Inner reference image 2'))
  assert.match(nonAdjacent, /An intervening selected layer may naturally cover this inner hem/)
  assert.doesNotMatch(nonAdjacent, /Show the complete free inner hem/)
  assert.match(guide.slice(guide.indexOf('Inner reference image 2')), /Show the complete free inner hem/)
})

test('근육형과 큰 체격을 구분하고 체중으로 근육량·체지방률을 단정하지 않는다', () => {
  const athletic = getLookbookBodyProportionGuide({ bodyBuild: 'athletic' })
  const broad = getLookbookBodyProportionGuide({ bodyBuild: 'broad' })
  assert.match(athletic, /naturally trained muscular build/)
  assert.match(broad, /broad build does not mean athletic or visibly muscular/)
  assert.doesNotMatch(broad, /Use a naturally trained muscular build/)
  for (const guide of [athletic, broad, getLookbookBodyProportionGuide(null)]) {
    assert.match(guide, /measurements take priority/)
    assert.match(guide, /Weight alone does not determine muscle mass/)
    assert.match(guide, /do not change the body to make a garment fit/)
  }
})

test('보통 체형도 키·체중을 우선하며 상세 둘레가 없다고 가는 허리로 정규화하지 않는다', () => {
  const guide = getLookbookBodyProportionGuide({ bodyBuild: 'average', heightCm: 176, weightKg: 100 })
  assert.match(guide, /heightCm=176; weightKg=100/)
  assert.match(guide, /not a medium-weight or slim-waist preset/)
  assert.match(guide, /preserve a broad waist and a rounded abdomen/)
  assert.match(guide, /explicit body measurements first, then the height and weight/)
  assert.match(guide, /Use the saved weight even when circumferences are missing/)
  assert.match(guide, /without inventing exact girths, a body-fat percentage or a medical diagnosis/)
  for (const body of [{ heightCm: 176 }, { heightCm: 0, weightKg: 100 }, { heightCm: 176, weightKg: Number.NaN }]) {
    assert.doesNotMatch(getLookbookBodyProportionGuide(body), /Saved numeric body size:/)
  }
})

test('여성 160cm·80kg의 체격은 기본 프로필에서 드러내고 상세 프로필은 부위별 실측을 우선한다', () => {
  const profile = { gender: 'female', bodyBuild: 'average', heightCm: 160, weightKg: 80 } as const
  const basic = getLookbookBodyProportionGuide(profile)
  const light = getLookbookBodyProportionGuide({ ...profile, weightKg: 55 })
  assert.match(basic, /No detailed body measurements were saved/)
  assert.match(basic, /non-athletic adult woman/)
  assert.match(basic, /visibly wider relative to the saved height/)
  assert.doesNotMatch(light, /visibly wider relative to the saved height/)
  assert.doesNotMatch(basic, /Waist-to-hip circumference ratio/)

  const partial = getLookbookBodyProportionGuide({ ...profile, hipCircumferenceCm: 110 })
  assert.match(partial, /separate shape anchor: hip circumference=110cm/)
  assert.match(partial, /Let the unmeasured midsection carry a plausible share/)
  assert.doesNotMatch(partial, /Waist-to-hip circumference ratio|a broad waist and a rounded abdomen/)

  const measured = getLookbookBodyProportionGuide({
    ...profile, waistCircumferenceCm: 80, hipCircumferenceCm: 110, inseamCm: 71,
  })
  assert.match(measured, /waist circumference=80cm, hip circumference=110cm, inseam=71cm/)
  assert.match(measured, /Waist-to-hip circumference ratio=72\.7%/)
  assert.doesNotMatch(measured, /unmeasured midsection|a broad waist and a rounded abdomen/)
})

test('상세 둘레가 없는 보통 체형은 키 대비 체중에 따라 복부·허리 볼륨을 구분한다', () => {
  const profile = { bodyBuild: 'average' as const, heightCm: 176 }
  const normal = getLookbookBodyProportionGuide({ ...profile, weightKg: 70 })
  const fuller = getLookbookBodyProportionGuide({ ...profile, weightKg: 90 })
  const heavier = getLookbookBodyProportionGuide({ ...profile, weightKg: 100 })
  assert.doesNotMatch(normal, /use a visibly heavier-set build|use a clearly plus-size/)
  assert.match(fuller, /heightMeters\^2 = 29\.1/)
  assert.match(fuller, /use a visibly heavier-set build/)
  assert.match(heavier, /heightMeters\^2 = 32\.3/)
  assert.match(heavier, /use a clearly plus-size, full-bodied build/)
  for (const guide of [
    getLookbookBodyProportionGuide({ ...profile, weightKg: 100, waistCircumferenceCm: 80 }),
    getLookbookBodyProportionGuide({ ...profile, weightKg: 100, bodyBuild: 'athletic' }),
  ]) {
    assert.doesNotMatch(guide, /use a clearly plus-size, full-bodied build/)
    assert.match(guide, /do not infer abdominal fat or exact girths from this cue/)
  }
})

test('옷 가슴 단면과 신체 둘레를 같은 단위로 비교하고 음의 여유도 숨기지 않는다', () => {
  const item = { category: 'top' as const, chestWidthCm: 55, shoulderWidthCm: 50 }
  const athletic = describeLookbookGarmentEase(item, { chestCircumferenceCm: 104, shoulderWidthCm: 48 })
  const slim = describeLookbookGarmentEase(item, { chestCircumferenceCm: 88, shoulderWidthCm: 42 })
  assert.match(athletic!, /nominalChestEaseCm=6/)
  assert.match(athletic!, /garmentMinusBodyShoulderWidthCm=2/)
  assert.match(slim!, /nominalChestEaseCm=22/)
  assert.match(slim!, /garmentMinusBodyShoulderWidthCm=8/)
  assert.match(describeLookbookGarmentEase(item, { chestCircumferenceCm: 114 })!, /nominalChestEaseCm=-4/)
  assert.match(athletic!, /not an exact fitting simulation/)
  assert.equal(describeLookbookGarmentEase(item, null), null)
  assert.equal(describeLookbookGarmentEase({ category: 'bottom', chestWidthCm: 55 }, { chestCircumferenceCm: 88 }), null)
  assert.equal(describeLookbookGarmentEase({ category: 'top', chestWidthCm: Number.NaN }, { chestCircumferenceCm: 88 }), null)
})

test('같은 하의의 허리·엉덩이 여유가 신체 치수에 따라 20·10·1cm와 20·10·2cm로 달라진다', () => {
  const item = { category: 'bottom' as const, waistWidthCm: 50, hipWidthCm: 60 }
  const cases = [
    { waistCircumferenceCm: 80, hipCircumferenceCm: 100, waistEase: 20, hipEase: 20, waistPercent: 25, hipPercent: 20, cue: 'roomy' },
    { waistCircumferenceCm: 90, hipCircumferenceCm: 110, waistEase: 10, hipEase: 10, waistPercent: 11.1, hipPercent: 9.1, cue: 'moderate' },
    { waistCircumferenceCm: 99, hipCircumferenceCm: 118, waistEase: 1, hipEase: 2, waistPercent: 1, hipPercent: 1.7, cue: 'close' },
  ]
  for (const body of cases) {
    const guide = describeLookbookGarmentEase(item, body)!
    assert.match(guide, new RegExp(`nominalWaistEaseCm=${body.waistEase} \\(`))
    assert.match(guide, new RegExp(`nominalHipEaseCm=${body.hipEase} \\(`))
    assert.ok(guide.includes(`nominalWaistEasePercent=${body.waistPercent}%`))
    assert.ok(guide.includes(`nominalHipEasePercent=${body.hipPercent}%`))
    assert.match(guide, new RegExp(`waistVisualCue=${body.cue}:`))
    assert.match(guide, new RegExp(`hipVisualCue=${body.cue}:`))
    assert.match(guide, /Near-zero ease should read as a closer, less spacious fit/)
    assert.match(guide, /Larger positive ease should remain visible as more room/)
    assert.match(guide, /waistband gaping or spare fabric around the hips/)
    assert.match(guide, /not an exact fitting simulation/)
    assert.doesNotMatch(guide, /nominalChestEaseCm|garmentMinusBodyShoulderWidthCm/)
  }
})

test('하의의 0과 음의 여유를 유지하고 원단 근거 없는 신축이나 치수 변경으로 맞추지 않는다', () => {
  const guide = describeLookbookGarmentEase(
    { category: 'bottom', waistWidthCm: 50, hipWidthCm: 60 },
    { waistCircumferenceCm: 100, hipCircumferenceCm: 124 },
  )!
  assert.match(guide, /nominalWaistEaseCm=0 \(/)
  assert.match(guide, /nominalHipEaseCm=-4 \(/)
  assert.match(guide, /nominalWaistEasePercent=0%/)
  assert.match(guide, /waistVisualCue=close: keep the fabric close to the measured waist with minimal spare fabric/)
  assert.match(guide, /nominalHipEasePercent=-3\.2%/)
  assert.match(guide, /hipVisualCue=negative: there is nominally less garment circumference than the measured hip/)
  assert.match(guide, /For negative ease, show plausible stretching, fabric tension or closure strain only when supported by the reference fabric and construction/)
  assert.match(guide, /Do not force an impossibly closed waistband/)
  assert.match(guide, /Do not shrink the wearer, enlarge the garment/)
  assert.match(guide, /invent a belt, elastic or other fastening/)
  assert.match(guide, /fabric, cut, rise and waistband position/)
})

test('하의는 실측 쌍이 있는 부위만 계산하며 나머지 치수나 허벅지 밀착도를 추정하지 않는다', () => {
  const waistOnly = describeLookbookGarmentEase(
    { category: 'bottom', waistWidthCm: 50, hipWidthCm: 60 },
    { waistCircumferenceCm: 90 },
  )!
  assert.match(waistOnly, /nominalWaistEaseCm=10 \(/)
  assert.doesNotMatch(waistOnly, /nominalHipEaseCm=/)
  assert.match(waistOnly, /waistVisualCue=moderate:/)
  assert.doesNotMatch(waistOnly, /nominalHipEasePercent=|hipVisualCue=/)
  const hipsOnly = describeLookbookGarmentEase(
    { category: 'bottom', hipWidthCm: 60 },
    { waistCircumferenceCm: 90, hipCircumferenceCm: 110 },
  )!
  assert.match(hipsOnly, /nominalHipEaseCm=10 \(/)
  assert.doesNotMatch(hipsOnly, /nominalWaistEaseCm=/)
  assert.match(hipsOnly, /hipVisualCue=moderate:/)
  assert.doesNotMatch(hipsOnly, /nominalWaistEasePercent=|waistVisualCue=/)
  assert.match(hipsOnly, /Apply the fit cues only to the measured regions with computed ease/)
  assert.match(hipsOnly, /do not infer an unmeasured waist, hip or body thigh circumference/)
  assert.match(hipsOnly, /hip ease alone does not establish exact thigh tightness/)
  assert.doesNotMatch(hipsOnly, /trousers|pants|fly|zipper/)
  assert.equal(describeLookbookGarmentEase({ category: 'bottom', waistWidthCm: 50, hipWidthCm: 60 }, null), null)
  assert.equal(describeLookbookGarmentEase({ category: 'bottom', waistWidthCm: 50 }, { hipCircumferenceCm: 110 }), null)
})

test('하의의 상대 여유 경계는 제품의 근사 그림 지침이며 부위별 결과를 직접 전달한다', () => {
  for (const [flatWidth, expected] of [[51.5, 'close'], [51.55, 'moderate'], [57.45, 'moderate'], [57.5, 'roomy']] as const) {
    const guide = describeLookbookGarmentEase(
      { category: 'bottom', waistWidthCm: flatWidth },
      { waistCircumferenceCm: 100 },
    )!
    assert.match(guide, new RegExp(`waistVisualCue=${expected}:`))
    assert.match(guide, /product-specific rough rendering ranges/)
    assert.match(guide, /visual heuristics, not apparel standards or real-world fit judgments/)
    assert.match(guide, /Keep the measured body and garment unchanged/)
    assert.match(guide, /Preserve the lower garment's leg or skirt shape/)
  }
  const mixed = describeLookbookGarmentEase(
    { category: 'bottom', waistWidthCm: 50, hipWidthCm: 60 },
    { waistCircumferenceCm: 99, hipCircumferenceCm: 100 },
  )!
  assert.match(mixed, /waistVisualCue=close:.*minimal spare fabric or gaping at this region/)
  assert.match(mixed, /hipVisualCue=roomy: render visibly loose room and spare fabric around the measured hip/)
  assert.match(mixed, /do not inflate this measured region into a baggy fit/)
  assert.match(mixed, /do not make this region sit flush like a close fit/)
  const moderate = describeLookbookGarmentEase({ category: 'bottom', waistWidthCm: 50 }, { waistCircumferenceCm: 90 })!
  assert.match(moderate, /moderate: render noticeable but not excessive spare fabric/)
  assert.match(moderate, /do not make it skin-tight or exaggerate it into oversized volume/)
})

test('하의의 누락·0·음수·NaN·무한대는 다른 부위의 유효한 여유 계산에 섞이지 않는다', () => {
  for (const invalid of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const invalidWaist = describeLookbookGarmentEase(
      { category: 'bottom', waistWidthCm: invalid, hipWidthCm: 60 },
      { waistCircumferenceCm: 90, hipCircumferenceCm: 110 },
    )!
    assert.doesNotMatch(invalidWaist, /nominalWaistEaseCm=/)
    assert.match(invalidWaist, /nominalHipEaseCm=10 \(/)
    const invalidBodyWaist = describeLookbookGarmentEase(
      { category: 'bottom', waistWidthCm: 50, hipWidthCm: 60 },
      { waistCircumferenceCm: invalid, hipCircumferenceCm: 110 },
    )!
    assert.doesNotMatch(invalidBodyWaist, /nominalWaistEaseCm=/)
    assert.match(invalidBodyWaist, /nominalHipEaseCm=10 \(/)
    assert.equal(describeLookbookGarmentEase(
      { category: 'bottom', waistWidthCm: invalid, hipWidthCm: invalid },
      { waistCircumferenceCm: 90, hipCircumferenceCm: 110 },
    ), null)
    assert.equal(describeLookbookGarmentEase(
      { category: 'bottom', waistWidthCm: 50, hipWidthCm: 60 },
      { waistCircumferenceCm: invalid, hipCircumferenceCm: invalid },
    ), null)
  }
})

test('허벅지 둘레 70cm는 한쪽 바지 단면 35·40·46cm와 비교해 밀착·중간·여유를 전달한다', () => {
  for (const [flatWidth, ease, percent, cue] of [[35, 0, 0, 'close'], [40, 10, 14.3, 'moderate'], [46, 22, 31.4, 'roomy']] as const) {
    const guide = describeLookbookGarmentEase(
      { category: 'bottom', subcategory: '일반 긴바지', thighWidthCm: flatWidth },
      { thighCircumferenceCm: 70 },
    )!
    assert.match(guide, new RegExp(`nominalThighEaseCm=${ease} \\(`))
    assert.ok(guide.includes(`nominalThighEasePercent=${percent}%`))
    assert.match(guide, new RegExp(`thighVisualCue=${cue}:`))
    assert.match(guide, /ONE trouser leg/)
    assert.match(guide, /ONE body thigh, never the hip circumference or the combined width of both legs/)
    assert.match(guide, /Do not slim the body thigh or enlarge the trouser leg/)
    assert.match(guide, /preserve the referenced knee, calf and hem cut/)
    if (ease === 0) assert.match(guide, /ZERO nominal spare circumference/)
    else assert.doesNotMatch(guide, /ZERO nominal spare circumference/)
  }
  const bodyGuide = getLookbookBodyProportionGuide({ thighCircumferenceCm: 70 })
  assert.match(bodyGuide, /Saved body thigh circumference=70cm around ONE upper thigh/)
  assert.match(bodyGuide, /Preserve this upper-leg volume/)
})

test('허벅지 비교는 신체·바지 실측 쌍이 있을 때만 하며 스커트와 미측정 부위에 적용하지 않는다', () => {
  for (const invalid of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(describeLookbookGarmentEase({ category: 'bottom', thighWidthCm: invalid }, { thighCircumferenceCm: 70 }), null)
    assert.equal(describeLookbookGarmentEase({ category: 'bottom', thighWidthCm: 35 }, { thighCircumferenceCm: invalid }), null)
  }
  assert.equal(describeLookbookGarmentEase({ category: 'bottom', subcategory: '미디 스커트', thighWidthCm: 35 }, { thighCircumferenceCm: 70 }), null)
  assert.equal(describeLookbookGarmentEase({ category: 'top', thighWidthCm: 35 }, { thighCircumferenceCm: 70 }), null)
  const negative = describeLookbookGarmentEase({ category: 'bottom', thighWidthCm: 34 }, { thighCircumferenceCm: 70 })!
  assert.match(negative, /nominalThighEaseCm=-2 \(/)
  assert.match(negative, /thighVisualCue=negative:/)
  assert.match(negative, /only when supported by the reference fabric and construction/)
  const independent = describeLookbookGarmentEase({ category: 'bottom', waistWidthCm: 50, thighWidthCm: 35 }, { waistCircumferenceCm: 80 })!
  assert.match(independent, /waistVisualCue=roomy:/)
  assert.doesNotMatch(independent, /nominalThighEaseCm=/)
})
