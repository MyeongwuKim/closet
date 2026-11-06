/**
 * 합성 신체·옷 실측으로 룩북의 체형과 상대 기장을 눈으로 비교할 자료를 만든다.
 * --live에서만 최대 3회 유료 이미지 요청을 보내며 실제 계정·DB·Cloudflare는 사용하지 않는다.
 * PNG 구조 검사와 시각 검토를 구분하고, 구조 검사만으로 착용 정확도나 일치율을 판정하지 않는다.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { pathToFileURL } from 'node:url'
import type { BodyBuild, ClothingCategory, Gender } from '@prisma/client'
import type { ViewerRecord } from '../features/user/user.repository.js'
import type { wardrobeRepository } from '../features/wardrobe/wardrobe.repository.js'

const MAX_IMAGE_REQUESTS = 3
const SYNTHETIC_USER_ID = 'synthetic-lookbook-proportions'
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const DEFAULT_CASE_NAMES = ['athletic-jacket', 'slim-jacket', 'broad-coat'] as const
const AVERAGE_WEIGHT_CASE_NAMES = ['average-176-70-jacket', 'average-176-90-jacket', 'average-176-100-jacket'] as const
const FEMALE_PROFILE_CASE_NAMES = ['female-160-55-basic', 'female-160-80-basic', 'female-160-80-measured'] as const
const CASE_NAMES = [
  ...DEFAULT_CASE_NAMES, 'broad-coat-short-inner', 'broad-coat-long-inner', ...AVERAGE_WEIGHT_CASE_NAMES, ...FEMALE_PROFILE_CASE_NAMES,
] as const
type CaseName = typeof CASE_NAMES[number]
type ReferenceName = 'jacket' | 'long-inner' | 'coat' | 'coat-inner' | 'coat-inner-short' | 'coat-inner-long' | 'pants'
  | 'blue-short-sleeve' | 'profile-test-pants'

interface SyntheticBody {
  gender: Gender
  bodyBuild: BodyBuild
  heightCm: number
  weightKg: number
  shoulderWidthCm: number | null
  chestCircumferenceCm: number | null
  waistCircumferenceCm: number | null
  hipCircumferenceCm: number | null
  thighCircumferenceCm?: number | null
  inseamCm: number | null
}

interface ProportionCase {
  name: CaseName
  body: SyntheticBody
  references: ReferenceName[]
  visualReviewCriteria: string[]
}

const COAT_BODY: SyntheticBody = { gender: 'female', bodyBuild: 'broad', heightCm: 165, weightKg: 62, shoulderWidthCm: 41, chestCircumferenceCm: 96, waistCircumferenceCm: 80, hipCircumferenceCm: 100, inseamCm: 76 }

const FEMALE_BASIC_BODY: SyntheticBody = {
  gender: 'female', bodyBuild: 'average', heightCm: 160, weightKg: 80,
  shoulderWidthCm: null, chestCircumferenceCm: null, waistCircumferenceCm: null,
  hipCircumferenceCm: null, thighCircumferenceCm: null, inseamCm: null,
}
const FEMALE_MEASURED_BODY: SyntheticBody = {
  ...FEMALE_BASIC_BODY,
  shoulderWidthCm: 40, chestCircumferenceCm: 103, waistCircumferenceCm: 80,
  hipCircumferenceCm: 110, thighCircumferenceCm: 67, inseamCm: 71,
}

function coatVisualReviewCriteria(innerLengthCm: number) {
  return [
    '큰 골격의 성인 여성 체형을 근육형이나 남성 체형으로 바꾸지 않는지 확인한다.',
    '115cm 코트를 골반 길이 재킷으로 줄이지 않고 무릎 아래까지 내려오는 긴 비율로 표현하는지 확인한다.',
    `${innerLengthCm}cm 이너를 완전히 빼 입히고, 허리 안으로 넣거나 접어 올려 총장을 숨기지 않는지 확인한다.`,
    '열린 코트 앞에서 이너 밑단 자체와 바지 허리선에 대한 밑단 깊이를 확인한다. 짧아서 겹치지 않는 경우와 긴 이너가 바지 위로 내려오는 경우를 구분한다.',
    '동일한 체형·115cm 코트·바지 조건의 55cm, 70cm, 85cm 사례를 비교한다. 이너 총장이 길어질수록 밑단이 순서대로 낮아지고, 몸·코트·바지 길이는 유지되는지 확인한다.',
  ]
}

/** 체형·체중·상세 치수·겹쳐 입는 옷의 기장 차이를 각 대조군 내에서 같은 옷 조건으로 비교한다. */
export const LOOKBOOK_PROPORTION_CASES: readonly ProportionCase[] = [
  {
    name: 'athletic-jacket',
    body: { gender: 'male', bodyBuild: 'athletic', heightCm: 180, weightKg: 85, shoulderWidthCm: 47, chestCircumferenceCm: 106, waistCircumferenceCm: 84, hipCircumferenceCm: 100, inseamCm: 82 },
    references: ['jacket', 'long-inner', 'pants'],
    visualReviewCriteria: [
      '성인 남성의 운동으로 단련된 체형을 유지하고 옷을 임의로 크게 만들지 않는지 확인한다.',
      '58cm 재킷 아래로 74cm 흰 이너의 밑단이 자연스럽게 드러나는지 확인한다.',
      'slim-jacket과 같은 옷을 사용했을 때 어깨·가슴과 옷의 여유 차이가 보이는지 비교한다.',
    ],
  },
  {
    name: 'slim-jacket',
    body: { gender: 'male', bodyBuild: 'slim', heightCm: 180, weightKg: 62, shoulderWidthCm: 42, chestCircumferenceCm: 88, waistCircumferenceCm: 72, hipCircumferenceCm: 90, inseamCm: 84 },
    references: ['jacket', 'long-inner', 'pants'],
    visualReviewCriteria: [
      '180cm의 마른 성인 남성 체형과 저장된 어깨·가슴둘레를 반영하는지 확인한다.',
      '58cm 재킷과 74cm 이너의 길이 차이를 옷을 넣어 입히거나 잘라서 숨기지 않는지 확인한다.',
      'athletic-jacket보다 같은 옷의 가슴·어깨 여유가 더 크게 보이는지 비교한다.',
    ],
  },
  {
    name: 'broad-coat',
    body: { ...COAT_BODY },
    references: ['coat', 'coat-inner', 'pants'],
    visualReviewCriteria: coatVisualReviewCriteria(70),
  },
  {
    name: 'broad-coat-short-inner',
    body: { ...COAT_BODY },
    references: ['coat', 'coat-inner-short', 'pants'],
    visualReviewCriteria: coatVisualReviewCriteria(55),
  },
  {
    name: 'broad-coat-long-inner',
    body: { ...COAT_BODY },
    references: ['coat', 'coat-inner-long', 'pants'],
    visualReviewCriteria: coatVisualReviewCriteria(85),
  },
  ...([70, 90, 100] as const).map((weightKg, index): ProportionCase => ({
    name: AVERAGE_WEIGHT_CASE_NAMES[index]!,
    body: {
      gender: 'male', bodyBuild: 'average', heightCm: 176, weightKg,
      shoulderWidthCm: null, chestCircumferenceCm: null, waistCircumferenceCm: null,
      hipCircumferenceCm: null, inseamCm: null,
    },
    references: ['jacket', 'long-inner', 'pants'],
    visualReviewCriteria: [
      '176cm·보통 체형·같은 옷을 유지하고 체중만 70/90/100kg으로 바꾼 결과를 비교한다.',
      '체중이 큰 조건을 날씬한 모델이나 근육형으로 바꾸지 않고 허리·복부·몸통·팔다리 볼륨에 반영하는지 본다.',
      '상세 둘레를 입력하지 않았으므로 정확한 둘레나 체지방률을 재현했다고 판정하지 않는다.',
      '옷 크기를 키우거나 자세·화면 확대 차이만으로 체격이 달라 보이는 것은 구분한다.',
    ],
  })),
  ...[
    { ...FEMALE_BASIC_BODY, weightKg: 55 },
    FEMALE_BASIC_BODY,
    FEMALE_MEASURED_BODY,
  ].map((body, index): ProportionCase => ({
    name: FEMALE_PROFILE_CASE_NAMES[index]!,
    body,
    references: ['blue-short-sleeve', 'profile-test-pants'],
    visualReviewCriteria: [
      '160cm·보통 체형의 기본 프로필에서 체중만 55kg에서 80kg으로 바뀌면 몸통·팔·허벅지 볼륨이 달라지는지 확인한다.',
      '같은 80kg에서 상세 치수를 추가하면 허리 대비 가슴과 엉덩이 비율, 바지의 허리 여유와 엉덩이·허벅지의 가까운 핏이 드러나는지 확인한다.',
      '옷 형태나 인물의 확대·회전으로 생긴 차이를 신체와 핏의 변화와 구분한다.',
    ],
  })),
]

/** 실행 여부·사례·출력 경로만 받는다. 잘못된 사례나 중복 인자는 유료 요청 전에 거절한다. */
export function parseLookbookProportionArgs(args: string[]) {
  let live = false
  let caseNames: CaseName[] = [...DEFAULT_CASE_NAMES]
  let output: string | undefined
  const seen = new Set<string>()
  for (const argument of args) {
    const name = argument.split('=')[0]!
    if (seen.has(name)) throw new Error(`중복 옵션을 확인해주세요: ${name}`)
    seen.add(name)
    if (argument === '--live') { live = true; continue }
    if (argument.startsWith('--cases=')) {
      const values = argument.slice('--cases='.length).split(',')
      if (values.some((value) => !CASE_NAMES.includes(value as CaseName)) || new Set(values).size !== values.length) {
        throw new Error(`--cases에는 중복 없이 ${CASE_NAMES.join(', ')}만 지정해주세요.`)
      }
      if (values.length > MAX_IMAGE_REQUESTS) throw new Error('--cases는 유료 요청 상한에 맞춰 한 번에 최대 3개만 선택해주세요.')
      caseNames = values as CaseName[]
      continue
    }
    if (argument.startsWith('--output=') && argument.slice('--output='.length).trim()) {
      output = argument.slice('--output='.length)
      continue
    }
    throw new Error(`사용법: evaluate:lookbook [--live] [--cases=최대3개] [--output=결과폴더]. 선택 가능 사례: ${CASE_NAMES.join(', ')}`)
  }
  return { live, caseNames, output }
}

interface ReferenceSpec {
  name: string
  category: ClothingCategory
  subcategory: string
  colorName: string
  colorHex: string
  totalLengthCm: number
  shoulderWidthCm?: number
  chestWidthCm?: number
  sleeveLengthCm?: number
  waistWidthCm?: number
  hipWidthCm?: number
  thighWidthCm?: number
  inseamCm?: number
}

const COAT_INNER_SPEC: ReferenceSpec = { name: '화이트 기본 이너 티셔츠', category: 'top', subcategory: '긴팔 티셔츠', colorName: '화이트', colorHex: '#f5f3ed', totalLengthCm: 70, shoulderWidthCm: 44, chestWidthCm: 53, sleeveLengthCm: 56 }

const REFERENCE_SPECS: Record<ReferenceName, ReferenceSpec> = {
  jacket: { name: '네이비 짧은 트러커 재킷', category: 'outer', subcategory: '재킷', colorName: '네이비', colorHex: '#26384c', totalLengthCm: 58, shoulderWidthCm: 52, chestWidthCm: 61, sleeveLengthCm: 60 },
  'long-inner': { name: '화이트 긴 이너 티셔츠', category: 'top', subcategory: '긴팔 티셔츠', colorName: '화이트', colorHex: '#f5f3ed', totalLengthCm: 74, shoulderWidthCm: 50, chestWidthCm: 56, sleeveLengthCm: 61 },
  coat: { name: '카멜 긴 울 코트', category: 'outer', subcategory: '롱 코트', colorName: '카멜', colorHex: '#a78159', totalLengthCm: 115, shoulderWidthCm: 48, chestWidthCm: 58, sleeveLengthCm: 57 },
  'coat-inner': COAT_INNER_SPEC,
  'coat-inner-short': { ...COAT_INNER_SPEC, totalLengthCm: 55 },
  'coat-inner-long': { ...COAT_INNER_SPEC, totalLengthCm: 85 },
  pants: { name: '베이지 스트레이트 팬츠', category: 'bottom', subcategory: '일반 긴바지', colorName: '베이지', colorHex: '#c5b28e', totalLengthCm: 103, waistWidthCm: 43, hipWidthCm: 55, inseamCm: 76 },
  'blue-short-sleeve': {
    name: '더스티 블루 반팔 티셔츠', category: 'top', subcategory: '반팔 티셔츠', colorName: '더스티 블루',
    colorHex: '#557589', totalLengthCm: 52, shoulderWidthCm: 43, chestWidthCm: 52, sleeveLengthCm: 18,
  },
  'profile-test-pants': {
    name: '베이지 스트레이트 팬츠', category: 'bottom', subcategory: '일반 긴바지', colorName: '베이지',
    colorHex: '#c5b28e', totalLengthCm: 99, waistWidthCm: 45, hipWidthCm: 56, thighWidthCm: 34.5, inseamCm: 71,
  },
}

/** 이너와 겉옷을 모두 선택한 사례의 합성 총장과 비율만 보고서에 기록한다. */
export function getLookbookProportionLayerMeasurements(caseName: CaseName) {
  const entry = LOOKBOOK_PROPORTION_CASES.find((item) => item.name === caseName)!
  const garments = entry.references.map((reference) => REFERENCE_SPECS[reference])
  const inner = garments.find((garment) => garment.category === 'top')
  const outer = garments.find((garment) => garment.category === 'outer')
  if (!inner || !outer) return undefined
  return {
    innerTotalLengthCm: inner.totalLengthCm,
    outerTotalLengthCm: outer.totalLengthCm,
    nominalLengthRatio: inner.totalLengthCm / outer.totalLengthCm,
  }
}

/** 같은 5px/cm 축척으로 만든 참조 도안이다. 텍스트·사람·실사용자 사진은 포함하지 않는다. */
export function createLookbookProportionReferenceSvg(reference: ReferenceName) {
  const spec = REFERENCE_SPECS[reference]
  const hemY = 60 + spec.totalLengthCm * 5
  const frame = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="760"><rect width="760" height="760" fill="#fffdf8"/>${content}</svg>`
  if (reference === 'pants') {
    return frame(`<g stroke="#8c795b" stroke-width="3" stroke-linejoin="round"><path fill="${spec.colorHex}" d="M272.5 60H487.5L517.5 ${hemY}H399L380 205L361 ${hemY}H242.5Z"/><path fill="none" d="M272.5 88H487.5M380 88V205M304 94L293 167M456 94L467 167M280 ${hemY - 14}H360M400 ${hemY - 14}H502"/><circle cx="380" cy="75" r="4" fill="#8c795b"/></g>`)
  }
  if (reference === 'profile-test-pants') {
    const hipHalf = spec.hipWidthCm! * 2.5
    const waistHalf = spec.waistWidthCm! * 2.5
    const crotchY = hemY - spec.inseamCm! * 5
    return frame(`<g stroke="#8c795b" stroke-width="3" stroke-linejoin="round"><path fill="${spec.colorHex}" d="M${380 - waistHalf} 60H${380 + waistHalf}L${380 + hipHalf} 145L503 ${hemY}H397L380 ${crotchY}L363 ${hemY}H257L${380 - hipHalf} 145Z"/><path fill="none" d="M260 88H500M380 88V${crotchY}M294 94L264 144M466 94L496 144M260 ${hemY - 12}H361M399 ${hemY - 12}H500"/><circle cx="380" cy="75" r="4" fill="#8c795b"/></g>`)
  }
  const shoulderHalf = spec.shoulderWidthCm! * 2.5
  const chestHalf = spec.chestWidthCm! * 2.5
  const leftShoulder = 380 - shoulderHalf
  const rightShoulder = 380 + shoulderHalf
  const leftBody = 380 - chestHalf
  const rightBody = 380 + chestHalf
  const cuffY = 60 + spec.sleeveLengthCm! * 4.6
  if (reference === 'blue-short-sleeve') {
    return frame(`<g stroke="#3c586a" stroke-width="3" stroke-linejoin="round"><path fill="${spec.colorHex}" d="M332 60Q380 93 428 60L${rightShoulder} 78L${rightShoulder + 63} ${cuffY}L${rightShoulder + 24} ${cuffY + 31}L${rightBody} 160V${hemY}H${leftBody}V160L${leftShoulder - 24} ${cuffY + 31}L${leftShoulder - 63} ${cuffY}L${leftShoulder} 78Z"/><path fill="none" d="M332 63Q380 105 428 63M${leftBody + 4} ${hemY - 10}H${rightBody - 4}"/></g>`)
  }
  const coat = reference === 'coat'
  const stroke = coat ? '#745638' : reference === 'jacket' ? '#132235' : '#b1aea6'
  const silhouette = `<path fill="${spec.colorHex}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round" d="M340 60Q380 91 420 60L${rightShoulder} 83L${rightShoulder + 119} ${cuffY}L${rightShoulder + 60} ${cuffY + 20}L${rightBody} 190L${rightBody + (coat ? 24 : 0)} ${hemY}H${leftBody - (coat ? 24 : 0)}L${leftBody} 190L${leftShoulder - 60} ${cuffY + 20}L${leftShoulder - 119} ${cuffY}L${leftShoulder} 83Z"/>`
  if (spec.category === 'top') {
    return frame(`${silhouette}<g fill="none" stroke="${stroke}" stroke-width="2"><path d="M340 60Q380 109 420 60M${leftBody + 3} ${hemY - 10}H${rightBody - 3}"/><path d="M${leftShoulder - 112} ${cuffY - 5}L${leftShoulder - 58} ${cuffY + 13}M${rightShoulder + 112} ${cuffY - 5}L${rightShoulder + 58} ${cuffY + 13}"/></g>`)
  }
  const collar = coat
    ? '<path fill="#bb946b" stroke="#745638" stroke-width="3" d="M340 60L380 165L326 132L342 109L322 90ZM420 60L380 165L434 132L418 109L438 90Z"/>'
    : '<path fill="#364d66" stroke="#132235" stroke-width="3" d="M340 60L380 90L350 125L327 93ZM420 60L380 90L410 125L433 93Z"/>'
  const buttons = (coat ? [220, 300, 380, 460] : [143, 200, 257, 314]).map((y) => `<circle cx="385" cy="${y}" r="5" fill="${stroke}"/>`).join('')
  const pockets = coat
    ? `<path d="M${leftBody + 28} 350L${leftBody + 88} 365M${rightBody - 28} 350L${rightBody - 88} 365"/>`
    : `<path d="M${leftBody + 24} 144H${leftBody + 96}V204L${leftBody + 60} 218L${leftBody + 24} 204ZM${rightBody - 96} 144H${rightBody - 24}V204L${rightBody - 60} 218L${rightBody - 96} 204Z"/>`
  return frame(`${silhouette}${collar}<g fill="none" stroke="${stroke}" stroke-width="3"><path d="M380 92V${hemY}M${leftBody} ${hemY - 10}H${rightBody}"/>${pockets}</g>${buttons}`)
}

/** 합성 PNG와 정확한 이미지 편집 endpoint만 허용하며 HTTP 오류도 자동 재요청하지 않는다. */
export function createLookbookProportionFetch(
  originalFetch: typeof globalThis.fetch,
  beforeImageRequest: (form: FormData, requestNumber: number) => Promise<void>,
) {
  let requests = 0
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.startsWith('data:image/png;base64,')) return originalFetch(input, init)
    if (url !== 'https://api.openai.com/v1/images/edits' || init?.method !== 'POST' || !(init.body instanceof FormData)) {
      throw new Error('합성 PNG 읽기와 OpenAI 이미지 편집 요청 외의 네트워크 접근은 허용하지 않습니다.')
    }
    if (requests >= MAX_IMAGE_REQUESTS) throw new Error('유료 이미지 요청 상한 3회에 도달했습니다.')
    requests += 1
    await beforeImageRequest(init.body, requests)
    const response = await originalFetch(input, { ...init, redirect: 'error' })
    // requestAiJson이 429·5xx를 보고 재전송하지 않도록 이 평가에서는 HTTP 오류를 직접 던진다.
    if (!response.ok) throw new Error(`이미지 요청 실패(HTTP ${response.status}). 자동 재시도하지 않았습니다.`)
    return response
  }
  return { fetch, get requests() { return requests } }
}

type WardrobeImageItem = Awaited<ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>>[number]

function makeSyntheticItem(reference: ReferenceName, png: Buffer): WardrobeImageItem {
  const spec = REFERENCE_SPECS[reference]
  const at = new Date('2026-11-04T00:00:00Z')
  return {
    id: reference, userId: SYNTHETIC_USER_ID, name: spec.name, category: spec.category, additionalCategories: [], subcategory: spec.subcategory,
    colorName: spec.colorName, colorHex: spec.colorHex, colorDetailName: spec.colorName, colorMode: 'solid', seasons: ['autumn', 'spring'],
    classificationStatus: 'classified', classificationConfidence: null, classificationModel: null, classificationCandidates: null,
    wearCount: 0, lastWornAt: null, archivedAt: null, updatedAt: at, createdAt: at, tags: [], brandName: null, sizeLabel: null,
    shoulderWidthCm: spec.shoulderWidthCm ?? null, chestWidthCm: spec.chestWidthCm ?? null, sleeveLengthCm: spec.sleeveLengthCm ?? null,
    totalLengthCm: spec.totalLengthCm, waistWidthCm: spec.waistWidthCm ?? null, hipWidthCm: spec.hipWidthCm ?? null, inseamCm: spec.inseamCm ?? null,
    thighWidthCm: spec.thighWidthCm ?? null, riseCm: null, hemWidthCm: null, displayImageAssetId: `fixture-${reference}`, originalImageAssetId: null,
    fashionAttributes: {
      layerRole: spec.category === 'outer' ? 'outer' : spec.category === 'top' ? 'base' : 'single',
      silhouette: 'regular', material: reference === 'coat' ? 'wool' : 'cotton', texture: 'smooth', pattern: 'solid',
      frontOpeningStyle: spec.category === 'outer' ? 'buttons' : spec.category === 'top' ? 'none' : 'unknown',
      necklineStyle: spec.category === 'outer' ? 'collar' : spec.category === 'top' ? 'crew' : 'unknown',
      ribbedCuffs: 'absent', ribbedHem: 'absent', ribbedNeckline: reference.includes('inner') ? 'present' : 'absent',
      warmth: reference === 'coat' ? 'heavy' : spec.category === 'top' ? 'light' : 'medium', formality: 0.4, confidence: 1,
    },
    displayImageAsset: {
      id: `fixture-${reference}`, userId: SYNTHETIC_USER_ID, createdAt: at, updatedAt: at, cloudflareImageId: `fixture-${reference}`,
      kind: 'wardrobeCutout', uploadStatus: 'ready', retention: 'permanent', expiresAt: null,
      deliveryUrl: `data:image/png;base64,${png.toString('base64')}`, deliveryVariant: null, originalFilename: null, storageFilename: null,
      mimeType: 'image/png', width: 760, height: 760, metadata: null, aiPreviewJobId: null,
    },
    originalImageAsset: null,
  }
}

interface CaseReport {
  name: CaseName
  body: SyntheticBody
  garments: ReferenceSpec[]
  innerTotalLengthCm?: number
  outerTotalLengthCm?: number
  /** 입력한 이너 총장 / 겉옷 총장이며 결과 이미지에서 측정한 값이 아니다. */
  nominalLengthRatio?: number
  visualReviewCriteria: string[]
  visualReviewRequired: true
  visualAccuracyScore: null
  status: 'generated' | 'failed'
  durationMs: number
  structuralChecks?: { pngSignature: true; portrait: true; width: number; height: number }
  model?: string
  imageFile?: string
  promptFile?: string
  /** 원본 옷 참조와 실측 보조 도식을 모두 포함한 실제 이미지 요청의 입력 개수다. */
  inputImageCount?: number
  layoutFile?: string
  error?: string
}

async function main() {
  const options = parseLookbookProportionArgs(process.argv.slice(2))
  if (!options.live) {
    console.log(`합성 체형·상대 기장 평가: evaluate:lookbook --live [--cases=최대3개] [--output=결과폴더]. 기본 사례: ${DEFAULT_CASE_NAMES.join(', ')}. 선택 가능: ${CASE_NAMES.join(', ')}. 최대 3회 유료 이미지 요청이며 결과는 별도 시각 검토가 필요합니다.`)
    return
  }
  try { loadEnvFile(resolve(import.meta.dirname, '../../.env')) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('AI 평가용 API 키가 설정되지 않았습니다.')

  // 서비스 모듈을 불러오기 전에 외부 DB 주소를 제거한다. 두 읽기 저장소도 합성 자료로 교체한다.
  process.env.DATABASE_URL = 'mongodb://127.0.0.1:1/closet_proportion_evaluation?directConnection=true&serverSelectionTimeoutMS=100'
  const [{ RawImage }, { aiExecutor, createAiExecutor, installAiExecutor }, { outfitPreviewService }, { wardrobeRepository: wardrobe }, { userRepository }, { prisma }] = await Promise.all([
    import('@huggingface/transformers'), import('../lib/ai/ai-execution.js'), import('../features/outfit/outfit-preview.service.js'),
    import('../features/wardrobe/wardrobe.repository.js'), import('../features/user/user.repository.js'), import('../lib/prisma.js'),
  ])
  const output = resolve(options.output ?? resolve(import.meta.dirname, '../../../../.playwright-mcp/lookbook-proportions'))
  await mkdir(output, { recursive: true })
  const report = { startedAt: new Date().toISOString(), requests: 0, maxImageRequests: MAX_IMAGE_REQUESTS, syntheticOnly: true, note: '구조 검사는 이미지 정확도 검사가 아니다. 합성 도안·합성 체형의 한 번씩 생성한 결과이며 실제 착용감이나 일반적 일치율을 측정하지 않는다.', cases: [] as CaseReport[] }
  const reportPath = resolve(output, 'report.json')
  const saveReport = () => writeFile(reportPath, JSON.stringify(report, null, 2))
  const originalFetch = globalThis.fetch
  const originalFindItems = wardrobe.findManyOwnedWithImagesByIds
  const originalFindViewer = userRepository.findViewerById
  let currentCase: ProportionCase | undefined
  let currentResult: CaseReport | undefined
  let currentItems: WardrobeImageItem[] = []
  installAiExecutor(createAiExecutor())
  Object.assign(wardrobe, { findManyOwnedWithImagesByIds: async (userId: string, ids: string[]) => {
    if (userId !== SYNTHETIC_USER_ID) throw new Error('합성 평가 계정만 허용합니다.')
    return currentItems.filter((item) => ids.includes(item.id))
  } })
  Object.assign(userRepository, { findViewerById: async (userId: string) => {
    if (userId !== SYNTHETIC_USER_ID || !currentCase) throw new Error('합성 평가 프로필이 없습니다.')
    return { styleProfile: { ...currentCase.body, preferredFit: 'regular' } } as ViewerRecord
  } })
  const network = createLookbookProportionFetch(originalFetch, async (form, requests) => {
    if (!currentCase || !currentResult) throw new Error('합성 평가 사례가 없습니다.')
    report.requests = requests
    currentResult.promptFile = `${currentCase.name}.prompt.txt`
    await writeFile(resolve(output, currentResult.promptFile), String(form.get('prompt')))
    const images = form.getAll('image[]')
    currentResult.inputImageCount = images.length
    const layout = images.find((image) => typeof image !== 'string' && image.name === 'measured-layer-layout.png')
    if (layout && typeof layout !== 'string') {
      // 실제 요청에 붙은 보조 도식을 저장해 생성 결과와 동일한 입력을 시각 검토한다.
      currentResult.layoutFile = `${currentCase.name}.layer-layout.png`
      await writeFile(resolve(output, currentResult.layoutFile), Buffer.from(await layout.arrayBuffer()))
    }
    await saveReport()
  })
  globalThis.fetch = network.fetch
  try {
    const referenceNames = [...new Set(LOOKBOOK_PROPORTION_CASES.filter((entry) => options.caseNames.includes(entry.name)).flatMap((entry) => entry.references))]
    const pngs = new Map<ReferenceName, Buffer>()
    for (const reference of referenceNames) {
      const svg = createLookbookProportionReferenceSvg(reference)
      const image = await RawImage.fromBlob(new Blob([svg], { type: 'image/svg+xml' }))
      const png = await image.toSharp().png().toBuffer()
      pngs.set(reference, png)
      await writeFile(resolve(output, `reference-${reference}.png`), png)
    }
    for (const name of options.caseNames) {
      currentCase = LOOKBOOK_PROPORTION_CASES.find((entry) => entry.name === name)!
      currentItems = currentCase.references.map((reference) => makeSyntheticItem(reference, pngs.get(reference)!))
      const result: CaseReport = {
        name, body: currentCase.body, garments: currentCase.references.map((reference) => REFERENCE_SPECS[reference]),
        ...getLookbookProportionLayerMeasurements(name),
        visualReviewCriteria: currentCase.visualReviewCriteria, visualReviewRequired: true, visualAccuracyScore: null,
        status: 'failed', durationMs: 0,
      }
      currentResult = result
      const startedAt = Date.now()
      try {
        const preview = await aiExecutor.run(SYNTHETIC_USER_ID, 'preview', { case: name, body: currentCase.body, references: currentCase.references },
          () => outfitPreviewService.generate(SYNTHETIC_USER_ID, currentCase!.references, 'casual'))
        const png = Buffer.from(preview.imageBase64, 'base64')
        if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('생성 결과가 PNG가 아닙니다.')
        const image = await RawImage.fromBlob(new Blob([png], { type: preview.mimeType }))
        if (image.width <= 0 || image.height <= image.width) throw new Error('생성 결과가 세로형 이미지가 아닙니다.')
        result.imageFile = `${name}.png`
        result.promptFile = `${name}.prompt.txt`
        await writeFile(resolve(output, result.imageFile), png)
        result.model = preview.model
        result.structuralChecks = { pngSignature: true, portrait: true, width: image.width, height: image.height }
        result.status = 'generated'
      } catch (error) {
        result.error = error instanceof Error ? error.message : '이미지 평가 요청에 실패했습니다.'
        process.exitCode = 1
      }
      result.durationMs = Date.now() - startedAt
      report.cases.push(result)
      await saveReport()
      console.log(`${name}: ${result.status}; visual review required`)
    }
  } finally {
    globalThis.fetch = originalFetch
    wardrobe.findManyOwnedWithImagesByIds = originalFindItems
    userRepository.findViewerById = originalFindViewer
    await prisma.$disconnect()
  }
  console.log(JSON.stringify({ requests: report.requests, generated: report.cases.filter((entry) => entry.status === 'generated').length, failed: report.cases.filter((entry) => entry.status === 'failed').length, report: reportPath }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main() }
  catch (error) {
    console.error(error instanceof Error ? error.message : '룩북 비율 평가에 실패했습니다.')
    process.exitCode = 1
  }
}
