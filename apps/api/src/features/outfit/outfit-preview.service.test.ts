import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { ClothingCategory } from '@closet/types'
import { userRepository } from '../user/user.repository.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import {
  getLookbookBaseLayerGuide,
  getLookbookBagGuide,
  getLookbookGenderConstraint,
  getLookbookHairGuide,
  getLookbookHemTarget,
  lookbookGarmentLengthGuide,
  outfitPreviewService,
} from './outfit-preview.service.js'
import {
  describeLookbookFabric,
  lookbookFabricPreservationGuide,
} from './lookbook-fabric-guide.js'

test('여성 근육형은 근육과 넓은 어깨를 남성 모델로 재해석하지 않는다', () => {
  const guide = getLookbookGenderConstraint('female')

  assert.match(guide, /adult woman only/)
  assert.match(guide, /adult female anatomy and an adult female skeletal frame/)
  assert.match(guide, /selected build is athletic/)
  assert.match(guide, /visible training and muscle definition on a woman/)
  assert.match(guide, /A broad build alone does not imply muscle definition/)
  assert.match(guide, /Explicit saved measurements take priority/)
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
  assert.match(lookbookGarmentLengthGuide, /hang freely and naturally at its measured shoulder-to-hem depth/)
  assert.match(lookbookGarmentLengthGuide, /A closed-front outer may naturally cover an inner hem/)
  assert.match(lookbookGarmentLengthGuide, /with an open front, show that hem inside the opening/)
  assert.match(lookbookGarmentLengthGuide, /Never use a full tuck, half tuck, French tuck/)
  assert.match(lookbookGarmentLengthGuide, /Do not invent a belt/)
})

test('키 165cm에 총장 68cm인 니트는 실측 비율을 전달하며 특정 골반 위치로 단정하지 않는다', () => {
  const target = getLookbookHemTarget('top', 68, 165)

  assert.match(target!, /shoulderToHemCm=68/)
  assert.match(target!, /garmentLengthToModelHeight=41\.2%/)
  assert.match(target!, /without imposing a universal waist or hip cutoff/)
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

test('신발을 고르지 않은 룩북에는 임의의 운동화나 양말을 추가하지 않는다', async (t) => {
  const form = await requestMockPreview(t)
  assert.match(String(form.get('prompt')), /No footwear was selected/)
  assert.match(String(form.get('prompt')), /Show the model barefoot/)
  assert.match(String(form.get('prompt')), /Do not invent shoes, sneakers, sandals or socks/)
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

test('코듀로이는 세로 골과 입체 음영을 생성 지침으로 전달한다', () => {
  const description = describeLookbookFabric({
    name: '브라운 코듀로이 팬츠',
    subcategory: '일반 긴바지',
    fashionAttributes: {
      material: 'cotton',
      texture: 'corduroy',
      pattern: 'solid',
    },
  })

  assert.match(description, /material=cotton/)
  assert.match(description, /texture=corduroy/)
  assert.match(description, /continuous raised vertical corduroy wales/)
  assert.match(description, /never turn it into plain cotton, denim, or a flat matte surface/)
  assert.match(lookbookFabricPreservationGuide, /hard garment-identity constraints/)
  assert.match(lookbookFabricPreservationGuide, /clearly visible at normal lookbook viewing size/)
})

test('구버전 아이템은 이름에서 코듀로이 질감을 보완한다', () => {
  const description = describeLookbookFabric({
    name: '올리브 골덴 팬츠',
    subcategory: '팬츠',
    fashionAttributes: {
      material: 'unknown',
      texture: 'unknown',
      pattern: 'solid',
    },
  })

  assert.match(description, /texture=corduroy/)
})

function createPreviewItem(id: string, category: ClothingCategory, fashionAttributes?: unknown) {
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

async function requestMockPreview(
  t: TestContext,
  attributes?: unknown,
  extraItems: ReturnType<typeof createPreviewItem>[] = [],
  profile: Awaited<ReturnType<typeof userRepository.findViewerById>> = null,
  measurements: Record<string, { totalLengthCm?: number; chestWidthCm?: number; shoulderWidthCm?: number; sleeveLengthCm?: number }> = {},
) {
  const items = [createPreviewItem('top', 'top', attributes), createPreviewItem('bottom', 'bottom'), ...extraItems]
    .map((item) => ({ ...item, ...measurements[item.id] }))
  t.mock.method(userRepository, 'findViewerById', async () => profile)
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

  await outfitPreviewService.generate('viewer', items.map(item => item.id))
  assert.equal(requests.length, 1)
  return requests[0]!
}

test('실제 생성 요청에 최신 신체 수치·옷 여유·재킷과 이너의 상대 기장을 함께 전달한다', async (t) => {
  const profile = {
    styleProfile: {
      gender: 'male', bodyBuild: 'athletic', heightCm: 180, weightKg: 85,
      shoulderWidthCm: 48, chestCircumferenceCm: 104, waistCircumferenceCm: 82,
      hipCircumferenceCm: 100, inseamCm: 82, preferredFit: 'wide',
    },
  } as Awaited<ReturnType<typeof userRepository.findViewerById>>
  const jacket = { ...createPreviewItem('jacket', 'outer'), name: '짧은 재킷', subcategory: '재킷' }
  const form = await requestMockPreview(t, undefined, [jacket], profile, {
    top: { totalLengthCm: 74, chestWidthCm: 55, shoulderWidthCm: 50, sleeveLengthCm: 56 },
    jacket: { totalLengthCm: 58, chestWidthCm: 60 },
  })
  const prompt = String(form.get('prompt'))
  assert.match(prompt, /키 180cm, 몸무게 85kg, 어깨너비 48cm, 가슴둘레 104cm/)
  assert.match(prompt, /허리둘레 82cm, 엉덩이둘레 100cm, 인심 82cm/)
  assert.match(prompt, /naturally trained muscular build/)
  assert.match(prompt, /참조 이미지 1.*총장 74cm/)
  assert.match(prompt, /참조 이미지 1.*nominalChestEaseCm=6/)
  assert.match(prompt, /참조 이미지 1.*bodyLengthCm=74; sleeveLengthCm=56; nominalBodyMinusSleeveLengthCm=18/)
  assert.match(prompt, /Inner reference image 1 totalLengthCm=74; outer reference image 3 totalLengthCm=58/)
  assert.match(prompt, /inner garment is nominally 16 cm longer/)
  assert.match(prompt, /Garment measurements and visible garment proportions always take priority/)
})

test('앞이 열리는 코트에는 실측 보조 도식을 사진 뒤에 추가하고 이너 밑단을 바지 앞에 두도록 전달한다', async (t) => {
  const coat = {
    ...createPreviewItem('coat', 'outer', { frontOpeningStyle: 'buttons' }),
    name: '롱 코트', subcategory: '코트',
  }
  const form = await requestMockPreview(t, undefined, [coat], null, {
    top: { totalLengthCm: 70 }, coat: { totalLengthCm: 115 },
  })
  const prompt = String(form.get('prompt'))
  const images = form.getAll('image[]') as Blob[]
  assert.equal(images.length, 4)
  assert.equal(form.get('quality'), 'medium')
  assert.deepEqual(await Promise.all(images.slice(0, 3).map((image) => image.text())), [
    'mock-reference-top', 'mock-reference-bottom', 'mock-reference-coat',
  ])
  assert.equal(images[3]!.type, 'image/png')
  const diagram = Buffer.from(await images[3]!.arrayBuffer())
  assert.ok(diagram.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
  assert.match(prompt, /first 3 reference images exactly once/)
  assert.match(prompt, /Supplementary image 4 is a measured layer layout, not another garment reference/)
  assert.match(prompt, /Inner reference image 1 totalLengthCm=70; outer reference image 3 totalLengthCm=115/)
  assert.match(prompt, /hanging in front of the trousers at its measured depth/)
  assert.match(prompt, /No part of its front or sides may disappear into the trouser waistband/)
})

test('백팩은 등에 메고 벨트·목도리는 착용 액세서리로 구분한다', () => {
  const guide = getLookbookBagGuide([
    {name: '셔츠', category: 'top', subcategory: '셔츠'},
    {name: '레더 벨트', category: 'accessory', subcategory: '벨트'},
    {name: '캔틴 백팩', category: 'accessory', subcategory: '가방'},
    {name: '울 머플러', category: 'accessory', subcategory: '목도리'},
  ])
  assert.match(guide!, /Reference image 3 is a carried bag/)
  assert.match(guide!, /Wear this backpack naturally on the back/)
  assert.doesNotMatch(guide!, /Reference image [124] is a carried bag/)
  assert.match(guide!, /Bags are separate from worn accessories/)
  assert.equal(getLookbookBagGuide([{name: '벨트', category: 'accessory', subcategory: '벨트'}]), null)
})

test('가방의 사진을 AI 룩북 요청에 포함하고 손으로 드는 자세를 허용한다', async (t) => {
  const bag = {...createPreviewItem('bag', 'accessory'), name: '데일리 캔버스 백', subcategory: '가방'}
  const form = await requestMockPreview(t, undefined, [bag])
  const prompt = String(form.get('prompt'))
  assert.equal(form.getAll('image[]').length, 3)
  assert.match(prompt, /Reference image 3 is a carried bag/)
  assert.match(prompt, /Render each selected bag exactly once/)
  assert.match(prompt, /Allow one hand to hold a referenced bag handle/)
  assert.doesNotMatch(prompt, /No bag was selected/)
  assert.doesNotMatch(prompt, /both hands completely outside every pocket and away from the garments/)
})

test('이미지 API의 빈 성공 응답은 중복 과금을 피하도록 자동 재생성하지 않는다', async (t) => {
  const items = [createPreviewItem('top', 'top'), createPreviewItem('bottom', 'bottom')]
  t.mock.method(userRepository, 'findViewerById', async () => null)
  t.mock.method(wardrobeRepository, 'findManyOwnedWithImagesByIds', async () => [...items].reverse())
  t.mock.method(console, 'error', () => {})
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'test-key'
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  })

  let openAiRequestCount = 0
  t.mock.method(globalThis, 'fetch', async (url: unknown) => {
    const item = items.find((item) => item.displayImageAsset.deliveryUrl === url)
    if (item) {
      return new Response(`mock-reference-${item.id}`, { headers: { 'content-type': 'image/png' } })
    }

    openAiRequestCount += 1
    if (openAiRequestCount === 1) return Response.json({ data: [] })
    return Response.json({
      data: [{ b64_json: Buffer.from('mock-preview').toString('base64') }],
    })
  })

  await assert.rejects(outfitPreviewService.generate('viewer', ['top', 'bottom']), /AI 룩 이미지를 만들지 못했습니다/)
  assert.equal(openAiRequestCount, 1)
})

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
  assert.match(prompt, /material=knit, texture=ribbed/)
  assert.match(prompt, /Fabric surface preservation:.*hard garment-identity constraints/)
  assert.match(prompt, /do not homogenize different garments into generic smooth matte fabric/)
  assert.match(prompt, /Garment length and natural hem rule:.*mandatory garment proportion/)
  assert.match(prompt, /Keep every top fully untucked/)
  assert.match(
    prompt,
    /viewer's perspective \(image-left\).*same image-left orientation in every generation/,
  )
  assert.match(prompt, /Never turn or mirror the pose toward image-right/)
  assert.equal(form.get('quality'), 'medium')
  assert.equal(form.get('output_format'), 'png')
  assert.equal(form.get('output_compression'), null)
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
