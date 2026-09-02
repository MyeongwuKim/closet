import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import { userRepository } from '../user/user.repository.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import {
  getLookbookBaseLayerGuide,
  getLookbookGenderConstraint,
  getLookbookHairGuide,
  getLookbookHemTarget,
  lookbookGarmentLengthGuide,
  outfitPreviewService,
} from './outfit-preview.service.js'

test('여성 근육형은 근육과 넓은 어깨를 남성 모델로 재해석하지 않는다', () => {
  const guide = getLookbookGenderConstraint('female')

  assert.match(guide, /adult woman only/)
  assert.match(guide, /adult female anatomy and an adult female skeletal frame/)
  assert.match(guide, /visible training and muscle definition on a woman/)
  assert.match(guide, /shoulders proportional to the hips/)
  assert.match(guide, /naturally defined waist/)
  assert.match(guide, /Do not render a wide rectangular male torso/)
  assert.match(guide, /Never reinterpret muscularity/)
  assert.match(guide, /missing body measurements/)
  assert.match(guide, /adult man or a male-presenting mannequin/)
})

test('여성 모델의 머리는 어깨를 지나 윗가슴까지 내려오는 긴 생머리로 유지한다', () => {
  const guide = getLookbookHairGuide('female')

  assert.match(guide, /straight dark long hair/)
  assert.match(guide, /extend clearly past the shoulders by about 15 to 25 cm/)
  assert.match(guide, /reach the upper chest and upper back/)
  assert.match(guide, /not a bob, lob, shoulder-length cut/)
  assert.match(guide, /ends must never stop at the shoulders/)
  assert.match(guide, /long ends visibly inside the crop/)
  assert.match(guide, /Most hair should fall behind the shoulders/)
})

test('저장된 총장을 키에 맞춰 유지하고 모든 상의를 자연스럽게 빼 입힌다', () => {
  assert.match(lookbookGarmentLengthGuide, /mandatory garment proportion/)
  assert.match(lookbookGarmentLengthGuide, /scale that length against the saved model heightCm/)
  assert.match(lookbookGarmentLengthGuide, /Keep every top fully untucked/)
  assert.match(lookbookGarmentLengthGuide, /hang freely and naturally over the waistband/)
  assert.match(lookbookGarmentLengthGuide, /Never use a full tuck, half tuck, French tuck/)
  assert.match(lookbookGarmentLengthGuide, /Do not invent a belt/)
})

test('키 165cm에 총장 68cm인 니트의 밑단을 허리가 아닌 하단 골반으로 안내한다', () => {
  const target = getLookbookHemTarget('top', 68, 165)

  assert.match(target!, /lower-hip area, approaching the upper thigh/)
  assert.match(target!, /garmentLengthToModelHeight=41\.2%/)
  assert.match(target!, /do not end this garment at the waistband/)
})

test('브이넥 니트에는 흰색 이너 티셔츠 레이어를 안내한다', () => {
  const guide = getLookbookBaseLayerGuide([
    {
      name: '그레이 브이넥 니트',
      category: 'top',
      subcategory: '니트',
    },
    {
      name: '차콜 데님',
      category: 'bottom',
      subcategory: '데님',
    },
  ])

  assert.ok(guide?.includes('white crew-neck T-shirt'))
  assert.ok(guide?.includes('inside the V opening'))
})

test('일반 니트에는 옷장에 없는 이너를 추가하지 않는다', () => {
  const guide = getLookbookBaseLayerGuide([
    {
      name: '그레이 롤넥 니트',
      category: 'top',
      subcategory: '니트',
    },
  ])

  assert.equal(guide, null)
})

test('브이넥 니트와 다른 상의를 함께 선택했으면 추가 이너를 만들지 않는다', () => {
  const guide = getLookbookBaseLayerGuide([
    {
      name: '브이넥 스웨터',
      category: 'top',
      subcategory: '스웨터',
      fashionAttributes: { material: 'knit' },
    },
    {
      name: '화이트 셔츠',
      category: 'top',
      subcategory: '셔츠',
    },
  ])

  assert.equal(guide, null)
})

function createPreviewItem(id: string, category: 'top' | 'bottom', fashionAttributes?: unknown) {
  return {
    id,
    name: category === 'top' ? '그레이 니트' : '차콜 팬츠',
    category,
    subcategory: category === 'top' ? '니트' : '팬츠',
    colorName: '그레이',
    fashionAttributes,
    displayImageAsset: { deliveryUrl: `https://wardrobe.example.test/${id}.png` },
  }
}

async function requestMockPreview(t: TestContext, attributes?: unknown) {
  const items = [createPreviewItem('top', 'top', attributes), createPreviewItem('bottom', 'bottom')]
  t.mock.method(userRepository, 'findViewerById', async () => null)
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => [...items].reverse())
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'test-key'
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  })

  const requests: FormData[] = []
  t.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => {
    const item = items.find((item) => item.displayImageAsset.deliveryUrl === url)
    if (item) {
      return new Response(`mock-reference-${item.id}`, { headers: { 'content-type': 'image/png' } })
    }
    assert.equal(url, 'https://api.openai.com/v1/images/edits')
    assert.ok(options?.body instanceof FormData)
    requests.push(options.body)
    return Response.json({ data: [{ b64_json: Buffer.from('mock-preview').toString('base64') }] })
  })

  await outfitPreviewService.generate('viewer', ['top', 'bottom'])
  assert.equal(requests.length, 1)
  return requests[0]!
}

test('실제 이미지 편집 요청에 참조 이미지별 시보리 판정과 원형 보존 규칙을 전달한다', async (t) => {
  const form = await requestMockPreview(t, {
    material: 'knit',
    texture: 'ribbed',
    ribbedCuffs: 'present',
    ribbedHem: 'absent',
    ribbedNeckline: 'unknown',
  })
  const prompt = String(form.get('prompt'))
  const garmentLines = prompt.split('\n').filter((line) => line.startsWith('참조 이미지'))
  const images = form.getAll('image[]')

  assert.match(garmentLines[0]!, /참조 이미지 1.*그레이 니트.*ribbedCuffs=present, ribbedHem=absent, ribbedNeckline=unknown/)
  assert.match(garmentLines[1]!, /참조 이미지 2.*차콜 팬츠.*ribbedCuffs=unknown, ribbedHem=unknown, ribbedNeckline=unknown/)
  assert.equal(images.length, 2)
  assert.ok(images[0] instanceof Blob && images[1] instanceof Blob)
  assert.deepEqual(await Promise.all(images.map((image) => (image as Blob).text())), [
    'mock-reference-top',
    'mock-reference-bottom',
  ])
  assert.match(prompt, /present signal.*preserve that region's reference band/)
  assert.match(prompt, /absent signal.*non-ribbed cuff or elastic finish, including any existing gathers/)
  assert.match(prompt, /Do not add a new ribbed band or unsupported gathering or cinching/)
  assert.match(prompt, /unknown signal.*neither present nor absent/)
  assert.match(prompt, /Preserve any clearly visible finish.*including visible ribbing/)
  assert.match(prompt, /do not invent ribbed bands in hidden, cropped or unclear regions/)
  assert.match(prompt, /Whole-garment ribbed texture is independent/)
  assert.match(prompt, /Keep the reference neckline shape, sleeve length and hem proportions unchanged/)
  assert.match(prompt, /Garment length and natural hem rule:.*mandatory garment proportion/)
  assert.match(prompt, /Keep every top fully untucked/)
  assert.match(
    prompt,
    /viewer's perspective \(image-left\).*same image-left orientation in every generation/,
  )
  assert.match(prompt, /Never turn or mirror the pose toward image-right/)
})

test('기존 아이템의 누락·null·잘못된 판정은 골지 원단이어도 unknown으로 생성에 전달한다', async (t) => {
  const cases = [
    { name: '속성 없음', attributes: undefined },
    { name: '분석 없음', attributes: null },
    { name: '구버전 골지 원단', attributes: { material: 'knit', texture: 'ribbed' } },
    { name: 'nullable 필드', attributes: { ribbedCuffs: null, ribbedHem: null, ribbedNeckline: null } },
    { name: '잘못된 저장값', attributes: { ribbedCuffs: 'ribbed', ribbedHem: true, ribbedNeckline: 1 } },
  ]

  for (const example of cases) {
    await t.test(example.name, async (t) => {
      const form = await requestMockPreview(t, example.attributes)
      const garmentLine = String(form.get('prompt')).split('\n').find((line) => line.startsWith('참조 이미지 1'))
      assert.match(garmentLine!, /ribbedCuffs=unknown, ribbedHem=unknown, ribbedNeckline=unknown/)
    })
  }
})
