import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLookbookProportionFetch,
  createLookbookProportionReferenceSvg,
  getLookbookProportionLayerMeasurements,
  LOOKBOOK_PROPORTION_CASES,
  parseLookbookProportionArgs,
} from './evaluate-lookbook-proportions.js'

test('명시적인 --live 없이는 실행하지 않고 세 가지 합성 사례를 기본 선택한다', () => {
  assert.deepEqual(parseLookbookProportionArgs([]), {
    live: false, caseNames: ['athletic-jacket', 'slim-jacket', 'broad-coat'], output: undefined,
  })
})

test('선택 사례의 순서와 공백이 포함된 출력 경로를 보존한다', () => {
  assert.deepEqual(parseLookbookProportionArgs(['--live', '--cases=broad-coat,slim-jacket', '--output=/tmp/lookbook results']), {
    live: true, caseNames: ['broad-coat', 'slim-jacket'], output: '/tmp/lookbook results',
  })
})

test('코트의 이너 55·70·85cm 세 사례를 순서대로 선택할 수 있다', () => {
  const caseNames = ['broad-coat-short-inner', 'broad-coat', 'broad-coat-long-inner']
  assert.deepEqual(parseLookbookProportionArgs([`--cases=${caseNames.join(',')}`]).caseNames, caseNames)
  assert.throws(() => parseLookbookProportionArgs(['--live', '--cases=athletic-jacket,broad-coat-short-inner,broad-coat,broad-coat-long-inner']), /최대 3개/)
})

test('알 수 없는 옵션·사례·중복·빈 값을 유료 요청 전에 거절한다', () => {
  for (const args of [
    ['--live=false'], ['--live', '--live'], ['--cases='], ['--cases=athletic-jacket,'],
    ['--cases=athletic-jacket,athletic-jacket'], ['--cases=unknown'],
    ['--cases=broad-coat', '--cases=slim-jacket'], ['--output='], ['--output=   '], ['--unknown'],
  ]) assert.throws(() => parseLookbookProportionArgs(args), Error, args.join(' '))
})

test('두 남성 사례는 동일한 옷과 키로 체형·몸무게·둘레의 차이를 비교한다', () => {
  const athletic = LOOKBOOK_PROPORTION_CASES.find((entry) => entry.name === 'athletic-jacket')!
  const slim = LOOKBOOK_PROPORTION_CASES.find((entry) => entry.name === 'slim-jacket')!
  assert.deepEqual(athletic.references, slim.references)
  assert.equal(athletic.body.heightCm, slim.body.heightCm)
  assert.equal(athletic.body.gender, slim.body.gender)
  assert.ok(athletic.body.weightKg > slim.body.weightKg)
  assert.ok(athletic.body.chestCircumferenceCm > slim.body.chestCircumferenceCm)
  assert.ok(athletic.body.shoulderWidthCm > slim.body.shoulderWidthCm)
  assert.equal(LOOKBOOK_PROPORTION_CASES.find((entry) => entry.name === 'broad-coat')!.body.bodyBuild, 'broad')
})

test('코트 대조군은 같은 체형·코트·바지를 유지하며 이너 총장 비율만 바꾼다', () => {
  const names = ['broad-coat-short-inner', 'broad-coat', 'broad-coat-long-inner'] as const
  const control = LOOKBOOK_PROPORTION_CASES.find((entry) => entry.name === 'broad-coat')!
  const expectedLengths = [55, 70, 85]
  for (const [index, name] of names.entries()) {
    const entry = LOOKBOOK_PROPORTION_CASES.find((item) => item.name === name)!
    assert.deepEqual(entry.body, control.body)
    assert.equal(entry.references[0], 'coat')
    assert.equal(entry.references[2], 'pants')
    const measurements = getLookbookProportionLayerMeasurements(name)
    assert.equal(measurements.innerTotalLengthCm, expectedLengths[index])
    assert.equal(measurements.outerTotalLengthCm, 115)
    assert.equal(measurements.nominalLengthRatio, expectedLengths[index]! / 115)
    assert.match(entry.visualReviewCriteria.join(' '), /허리 안으로 넣거나/)
    assert.match(entry.visualReviewCriteria.join(' '), /밑단 깊이/)
    assert.match(entry.visualReviewCriteria.join(' '), /길어질수록 밑단이 순서대로 낮아지고/)
  }
})

test('도안은 총장 5px/cm 축척과 동일한 어깨 시작점을 사용해 레이어 길이 차이를 유지한다', () => {
  const jacket = createLookbookProportionReferenceSvg('jacket')
  const longInner = createLookbookProportionReferenceSvg('long-inner')
  const coat = createLookbookProportionReferenceSvg('coat')
  assert.match(jacket, /L532\.5 350/)
  assert.match(longInner, /L520 430/)
  assert.match(coat, /L549 635/)
  for (const svg of [jacket, longInner, coat]) {
    assert.match(svg, /width="760" height="760"/)
    assert.doesNotMatch(svg, /<text|<image|href=/)
  }
})

test('코트용 이너 도안도 55·70·85cm 총장에 따라 밑단이 달라지고 다른 디테일은 같다', () => {
  const references = ['coat-inner-short', 'coat-inner', 'coat-inner-long'] as const
  const hemValues = [335, 410, 485]
  const normalized = references.map((reference, index) => {
    const svg = createLookbookProportionReferenceSvg(reference)
    const hem = hemValues[index]!
    assert.match(svg, new RegExp(`L512\\.5 ${hem}H247\\.5`))
    assert.doesNotMatch(svg, /<circle/)
    return svg.replaceAll(String(hem), 'HEM').replaceAll(String(hem - 10), 'HEM_STITCH')
  })
  assert.equal(normalized[0], normalized[1])
  assert.equal(normalized[1], normalized[2])
})

test('합성 PNG 외의 외부 주소·다른 API·잘못된 요청 본문은 원본 fetch에 전달하지 않는다', async () => {
  const calls: string[] = []
  const network = createLookbookProportionFetch(async (url) => { calls.push(String(url)); return Response.json({}) }, async () => {})
  for (const url of ['https://imagedelivery.net/private', 'https://api.openai.com/v1/responses', 'https://api.openai.com.evil.test/v1/images/edits']) {
    await assert.rejects(network.fetch(url, { method: 'POST', body: new FormData() }), /네트워크 접근/)
  }
  await assert.rejects(network.fetch('https://api.openai.com/v1/images/edits', { method: 'POST', body: '{}' }), /네트워크 접근/)
  assert.deepEqual(calls, [])
  await network.fetch('data:image/png;base64,aGVsbG8=')
  assert.equal(calls.length, 1)
  assert.equal(network.requests, 0)
})

test('이미지 호출은 3회 상한이며 다음 호출을 시작하지 않고 HTTP 오류를 즉시 던진다', async () => {
  let calls = 0
  const recorded: number[] = []
  const network = createLookbookProportionFetch(async (_url, options) => {
    calls += 1
    assert.equal(options?.redirect, 'error')
    return Response.json({}, { status: calls === 1 ? 503 : 200 })
  }, async (_form, requestNumber) => { recorded.push(requestNumber) })
  const options = { method: 'POST', body: new FormData() }
  await assert.rejects(network.fetch('https://api.openai.com/v1/images/edits', options), /HTTP 503.*자동 재시도/)
  assert.equal(calls, 1)
  await network.fetch('https://api.openai.com/v1/images/edits', options)
  await network.fetch('https://api.openai.com/v1/images/edits', options)
  await assert.rejects(network.fetch('https://api.openai.com/v1/images/edits', options), /상한 3회/)
  assert.equal(calls, 3)
  assert.deepEqual(recorded, [1, 2, 3])
})
