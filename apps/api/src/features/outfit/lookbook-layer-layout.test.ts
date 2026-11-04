import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLookbookLayerLayout,
  renderLookbookLayerLayout,
} from './lookbook-layer-layout.js'

const coat = { category: 'outer' as const, totalLengthCm: 115, fashionAttributes: { frontOpeningStyle: 'buttons' } }
const top = { category: 'top' as const, totalLengthCm: 70 }

function drawnSpan(svg: string, id: 'inner-layer' | 'outer-layer' | 'inner-sleeves' | 'outer-sleeves') {
  const match = new RegExp(`id="${id}"[^>]*data-start-y="([^"]+)"[^>]*data-end-y="([^"]+)"`).exec(svg)
  assert.ok(match)
  return Number(match[2]) - Number(match[1])
}

test('코트115와 이너70을 공통 어깨선에 같은 축척으로 놓고 원래 참조 번호를 유지한다', () => {
  const layout = buildLookbookLayerLayout([coat, { category: 'bottom' }, top])!
  assert.equal(layout.outerReferenceIndex, 1)
  assert.equal(layout.innerReferenceIndex, 3)
  assert.equal(layout.outerLengthCm, 115)
  assert.equal(layout.innerLengthCm, 70)
  assert.match(layout.svg, /width="768" height="960"/)
  assert.match(layout.svg, /No body or waist position inferred/)
  assert.equal(drawnSpan(layout.svg, 'outer-layer'), 640)
  assert.ok(Math.abs(drawnSpan(layout.svg, 'inner-layer') / drawnSpan(layout.svg, 'outer-layer') - 70 / 115) < 1e-12)
  assert.match(layout.guide, /last input image.*NOT a garment reference/)
  assert.match(layout.guide, /reference image 3 \(70 cm shoulder to hem\)/)
  assert.match(layout.guide, /Never copy its schematic rectangles, colors, linework, numbers, labels or text/)
})

test('이너55·70·85는 겉옷과 같은 축척에서 서로 다른 밑단 깊이를 만든다', () => {
  const depths = [55, 70, 85].map((totalLengthCm) => buildLookbookLayerLayout([{ ...top, totalLengthCm }, coat])!)
  for (let index = 0; index < depths.length; index += 1) {
    assert.equal(depths[index]!.innerReferenceIndex, 1)
    assert.equal(depths[index]!.outerReferenceIndex, 2)
    assert.ok(Math.abs(drawnSpan(depths[index]!.svg, 'inner-layer') / 640 - [55, 70, 85][index]! / 115) < 1e-12)
  }
  assert.ok(drawnSpan(depths[0]!.svg, 'inner-layer') < drawnSpan(depths[1]!.svg, 'inner-layer'))
  assert.ok(drawnSpan(depths[1]!.svg, 'inner-layer') < drawnSpan(depths[2]!.svg, 'inner-layer'))
})

test('이너가 재킷보다 길거나 같은 경우에도 좌표 범위와 비율을 보존한다', () => {
  for (const totalLengthCm of [58, 74]) {
    const layout = buildLookbookLayerLayout([{ ...top, totalLengthCm }, { ...coat, totalLengthCm: 58 }])!
    assert.ok(drawnSpan(layout.svg, 'inner-layer') <= 640)
    assert.ok(drawnSpan(layout.svg, 'outer-layer') <= 640)
    assert.ok(Math.abs(drawnSpan(layout.svg, 'inner-layer') / drawnSpan(layout.svg, 'outer-layer') - totalLengthCm / 58) < 1e-12)
  }
})

test('유효한 소매도 같은 축척으로 표시해 70·85 몸판이 56 소매끝보다 아래에서 끝남을 보여준다', () => {
  for (const totalLengthCm of [70, 85]) {
    const layout = buildLookbookLayerLayout([
      { ...coat, sleeveLengthCm: 57 },
      { ...top, totalLengthCm, sleeveLengthCm: 56 },
    ])!
    assert.equal(layout.innerSleeveLengthCm, 56)
    assert.equal(layout.outerSleeveLengthCm, 57)
    const bodySpan = drawnSpan(layout.svg, 'inner-layer')
    const sleeveSpan = drawnSpan(layout.svg, 'inner-sleeves')
    assert.ok(bodySpan > sleeveSpan)
    assert.ok(Math.abs(bodySpan / sleeveSpan - totalLengthCm / 56) < 1e-12)
    assert.ok(Math.abs(drawnSpan(layout.svg, 'outer-sleeves') / drawnSpan(layout.svg, 'outer-layer') - 57 / 115) < 1e-12)
    assert.match(layout.svg, /INNER SLEEVE - reference 2 - 56 cm \(dashed\)/)
    assert.match(layout.svg, /OUTER SLEEVE - reference 1 - 57 cm/)
    assert.match(layout.svg, /actual seam anchors and drape can differ/)
    assert.match(layout.guide, /not visible stitching/)
    assert.match(layout.guide, /not interpret their numeric difference as an exact visible cuff-to-hem gap/)
  }
})

test('짧은 몸판·단일 소매 정보·몸판보다 긴 소매도 유효한 원래 비율로 보존한다', () => {
  const short = buildLookbookLayerLayout([{ ...top, totalLengthCm: 55, sleeveLengthCm: 56 }, coat])!
  assert.ok(drawnSpan(short.svg, 'inner-layer') < drawnSpan(short.svg, 'inner-sleeves'))
  assert.equal(short.outerSleeveLengthCm, undefined)
  assert.doesNotMatch(short.svg, /id="outer-sleeves"/)
  const outerOnly = buildLookbookLayerLayout([top, { ...coat, sleeveLengthCm: 200 }])!
  assert.equal(drawnSpan(outerOnly.svg, 'outer-sleeves'), 640)
  assert.ok(Math.abs(drawnSpan(outerOnly.svg, 'outer-layer') / 640 - 115 / 200) < 1e-12)
  assert.doesNotMatch(outerOnly.svg, /id="inner-sleeves"/)
})

test('소매가 없거나 잘못되면 기존 총장 도식을 그대로 유지한다', () => {
  const original = buildLookbookLayerLayout([top, coat])!
  for (const sleeveLengthCm of [undefined, null, -1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
    const layout = buildLookbookLayerLayout([{ ...top, sleeveLengthCm }, { ...coat, sleeveLengthCm }])!
    assert.equal(layout.svg, original.svg)
    assert.equal(layout.guide, original.guide)
    assert.equal(layout.innerSleeveLengthCm, undefined)
    assert.equal(layout.outerSleeveLengthCm, undefined)
  }
})

test('다중 상의·다중 아우터·중간옷이나 누락 레이어는 모호한 도식을 만들지 않는다', () => {
  for (const items of [[top], [coat], [top, top, coat], [top, coat, coat], [top, coat, { category: 'midlayer' as const }], []]) {
    assert.equal(buildLookbookLayerLayout(items), null)
  }
})

test('실측이 없거나 음수·0·NaN·무한이면 생성하지 않는다', () => {
  for (const totalLengthCm of [undefined, null, -1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(buildLookbookLayerLayout([{ ...top, totalLengthCm }, coat]), null)
    assert.equal(buildLookbookLayerLayout([top, { ...coat, totalLengthCm }]), null)
  }
})

test('앞을 완전히 열 수 있는 판정이 없거나 펄오버·반집업이면 임의의 열린 코트를 그리지 않는다', () => {
  for (const fashionAttributes of [undefined, null, [], 'buttons', {}, { frontOpeningStyle: 'none' }, { frontOpeningStyle: 'halfZip' }, { frontOpeningStyle: 'halfButtons' }, { frontOpeningStyle: 'unknown' }]) {
    assert.equal(buildLookbookLayerLayout([top, { ...coat, fashionAttributes }]), null)
  }
  for (const frontOpeningStyle of ['buttons', 'zipper', 'wrap']) {
    assert.ok(buildLookbookLayerLayout([top, { ...coat, fashionAttributes: { frontOpeningStyle } }]))
  }
})

test('실제 로컬 도식 렌더링은 고정 크기의 PNG를 반환한다', async () => {
  for (const items of [[coat, top], [{ ...coat, sleeveLengthCm: 57 }, { ...top, totalLengthCm: 85, sleeveLengthCm: 56 }]]) {
    const layout = buildLookbookLayerLayout(items)!
    const rendered = await renderLookbookLayerLayout(layout)
    const bytes = Buffer.from(rendered.bytes)
    assert.equal(rendered.mimeType, 'image/png')
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    assert.equal(bytes.readUInt32BE(16), 768)
    assert.equal(bytes.readUInt32BE(20), 960)
  }
})
