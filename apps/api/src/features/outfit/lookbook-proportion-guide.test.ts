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
