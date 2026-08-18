import type {
  BodyBuild,
  ClothingCategory,
  Gender,
  PreferredFit,
} from '@prisma/client'
import { ServiceError } from '../../graphql/errors.js'
import { userRepository } from '../user/user.repository.js'
import { wardrobeRepository } from '../wardrobe/wardrobe.repository.js'
import { hasCompleteOutfitBase } from './outfit-composition.js'

const categoryLabels: Record<ClothingCategory, string> = {
  top: '상의',
  bottom: '하의',
  outer: '아우터',
  midlayer: '중간 아우터',
  dress: '원피스',
  shoes: '신발',
  accessory: '액세서리',
  other: '기타',
}

const fitLabels: Record<PreferredFit, string> = {
  wide: '여유로운 착용감',
  regular: '정사이즈에 가까운 기본 착용감',
  skinny: '몸에 맞는 슬림한 착용감',
}

const genderLabels: Record<Gender, string> = {
  male: '성인 남성 모델',
  female: '성인 여성 모델',
}

const bodyBuildLabels: Record<BodyBuild, string> = {
  slim: '마른 체형',
  average: '보통 체형',
  athletic: '근육이 발달한 탄탄한 체형',
  broad: '골격과 체격이 큰 체형',
}

const MAX_REFERENCE_IMAGE_BYTES = 12 * 1024 * 1024
const SUPPORTED_REFERENCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string }>
  error?: { message?: string }
}

function formatMeasurement(label: string, value?: number | null) {
  return value == null ? null : `${label} ${value}cm`
}

function describeGarment(
  item: Awaited<
    ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>
  >[number],
  index: number,
) {
  const measurements = [
    formatMeasurement('어깨너비', item.shoulderWidthCm),
    formatMeasurement('가슴 단면', item.chestWidthCm),
    formatMeasurement('소매 길이', item.sleeveLengthCm),
    formatMeasurement('총장', item.totalLengthCm),
    formatMeasurement('허리 단면', item.waistWidthCm),
    formatMeasurement('엉덩이 단면', item.hipWidthCm),
    formatMeasurement('인심', item.inseamCm),
    formatMeasurement('허벅지 단면', item.thighWidthCm),
    formatMeasurement('밑위', item.riseCm),
    formatMeasurement('밑단 단면', item.hemWidthCm),
  ].filter(Boolean)

  return [
    `참조 이미지 ${index + 1}`,
    categoryLabels[item.category!],
    item.subcategory,
    item.name,
    item.colorName,
    item.sizeLabel ? `표기 사이즈 ${item.sizeLabel}` : null,
    measurements.length > 0 ? measurements.join(', ') : null,
  ]
    .filter(Boolean)
    .join(' / ')
}

function describeBody(
  profile: Awaited<ReturnType<typeof userRepository.findViewerById>>,
) {
  const body = profile?.styleProfile
  if (!body) return '일반적인 성인 체형'

  const values = [
    body.gender ? genderLabels[body.gender] : null,
    body.bodyBuild ? bodyBuildLabels[body.bodyBuild] : null,
    formatMeasurement('키', body.heightCm),
    body.weightKg == null ? null : `몸무게 ${body.weightKg}kg`,
    formatMeasurement('어깨너비', body.shoulderWidthCm),
    formatMeasurement('가슴둘레', body.chestCircumferenceCm),
    formatMeasurement('허리둘레', body.waistCircumferenceCm),
    formatMeasurement('엉덩이둘레', body.hipCircumferenceCm),
    formatMeasurement('인심', body.inseamCm),
  ].filter(Boolean)

  return values.join(', ')
}

function describePreferredFit(
  profile: Awaited<ReturnType<typeof userRepository.findViewerById>>,
) {
  return fitLabels[profile?.styleProfile?.preferredFit ?? 'regular']
}

function buildPrompt(
  items: Awaited<
    ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>
  >,
  profile: Awaited<ReturnType<typeof userRepository.findViewerById>>,
) {
  const garments = items.map(describeGarment).join('\n')

  return `Create a photorealistic fashion lookbook image using every garment from the reference images exactly once.

Reference garment order and optional silhouette measurements:
${garments}

Model body guide: ${describeBody(profile)}.

Preferred styling fit: ${describePreferredFit(profile)}. Use this preference only when the reference images and garment measurements leave the fit ambiguous. Garment measurements and visible garment proportions always take priority. Do not resize or redesign a garment to force the preferred fit.

Preserve each referenced garment's visible color, material, pattern, length, proportions, and distinctive details. Body chest, waist, and hip values are full circumferences, while garment chest, waist, and hip widths are flat measurements. When both are provided, use their relationship to depict plausible ease without treating the result as exact virtual fitting. Dress a single adult fashion model matching the body guide in the complete coordinated outfit. Frame the complete outfit from the neck to the feet in a relaxed front-facing editorial pose, keeping the model's face entirely outside the image. Use a warm off-white studio background, soft natural light, realistic fabric folds, and a clean Korean fashion lookbook composition. Do not add text, captions, logos, extra garments, duplicate items, shopping UI, borders, or a collage. Do not infer or reproduce a real person's identity or face.`
}

async function downloadReferenceImage(url: string, index: number) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new ServiceError(
      `${index + 1}번째 옷 이미지를 불러오지 못했습니다.`,
      'OUTFIT_PREVIEW_IMAGE_FAILED',
    )
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0] ?? ''
  const bytes = await response.arrayBuffer()
  if (
    !SUPPORTED_REFERENCE_TYPES.has(mimeType) ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_REFERENCE_IMAGE_BYTES
  ) {
    throw new ServiceError(
      '참조할 수 없는 옷 이미지가 포함되어 있습니다.',
      'OUTFIT_PREVIEW_IMAGE_FAILED',
    )
  }

  return { bytes, mimeType }
}

export const outfitPreviewService = {
  async generate(userId: string, selectedItemIds: string[]) {
    const uniqueItemIds = [...new Set(selectedItemIds)]
    if (uniqueItemIds.length < 2 || uniqueItemIds.length > 8) {
      throw new ServiceError(
        'AI 룩 미리보기는 2개에서 8개의 옷으로 만들 수 있습니다.',
        'INVALID_OUTFIT_PREVIEW_ITEMS',
      )
    }

    const [unorderedItems, profile] = await Promise.all([
      wardrobeRepository.findManyOwnedWithImagesByIds(userId, uniqueItemIds),
      userRepository.findViewerById(userId),
    ])
    if (
      unorderedItems.length !== uniqueItemIds.length ||
      unorderedItems.some(
        (item) => !item.category || !item.displayImageAsset?.deliveryUrl,
      )
    ) {
      throw new ServiceError(
        '이미지가 있는 내 옷장 아이템만 미리보기에 사용할 수 있습니다.',
        'INVALID_OUTFIT_PREVIEW_ITEMS',
      )
    }

    const itemById = new Map(unorderedItems.map((item) => [item.id, item]))
    const items = uniqueItemIds.map((itemId) => itemById.get(itemId)!)
    if (!hasCompleteOutfitBase(items.map((item) => item.category!))) {
      throw new ServiceError(
        'AI 룩을 만들려면 상의나 아우터와 하의를 함께 선택해주세요.',
        'INCOMPLETE_OUTFIT_PREVIEW_ITEMS',
      )
    }
    const references = await Promise.all(
      items.map((item, index) =>
        downloadReferenceImage(item.displayImageAsset!.deliveryUrl!, index),
      ),
    )
    const prompt = buildPrompt(items, profile)
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2'
    if (!apiKey) {
      throw new ServiceError(
        'AI 이미지 생성 설정을 확인해주세요.',
        'AI_CONFIGURATION_ERROR',
      )
    }

    const form = new FormData()
    form.set('model', model)
    form.set('prompt', prompt)
    form.set('size', '1024x1536')
    form.set('quality', 'low')
    form.set('output_format', 'jpeg')
    form.set('output_compression', '88')
    references.forEach((reference, index) => {
      form.append(
        'image[]',
        new Blob([reference.bytes], { type: reference.mimeType }),
        `garment-${index + 1}.${reference.mimeType.split('/')[1]}`,
      )
    })

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    const payload = (await response.json().catch(() => null)) as
      | OpenAiImageResponse
      | null
    const imageBase64 = payload?.data?.[0]?.b64_json

    if (!response.ok || !imageBase64) {
      console.error('[outfit-preview] OpenAI image generation failed', {
        status: response.status,
        message: payload?.error?.message,
      })
      throw new ServiceError(
        'AI 룩 이미지를 만들지 못했습니다. 잠시 후 다시 시도해주세요.',
        'OUTFIT_PREVIEW_GENERATION_FAILED',
      )
    }

    return {
      imageBase64,
      mimeType: 'image/jpeg' as const,
      model,
    }
  },
}
