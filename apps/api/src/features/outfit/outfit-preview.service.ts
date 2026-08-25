import type {
  BodyBuild,
  ClothingCategory,
  Gender,
  OutfitStyle,
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

const previewStyleLabels: Record<OutfitStyle, string> = {
  minimal: '미니멀',
  casual: '캐주얼',
  street: '스트릿',
  classic: '클래식',
  vintage: '빈티지',
  sporty: '스포티',
}

const previewStyleGuides: Record<OutfitStyle, string> = {
  minimal:
    'Keep the silhouette clean and restrained with a clear, uncluttered waistline.',
  casual:
    'Keep the outfit relaxed and natural. Leave short straight-hem shirts, linen shirts, T-shirts, sweatshirts, and knits untucked by default.',
  street:
    'Keep relaxed or oversized layers untucked and preserve the intended volume of each garment.',
  classic:
    'Create a structured, polished silhouette. Fully tuck only a thin shirt, polo, or fine-gauge top when its long or curved hem is visibly designed for tucking.',
  vintage:
    'Preserve the garments’ original period-inspired proportions and use an untucked silhouette unless a thin long shirt is clearly designed for tucking.',
  sporty:
    'Keep athletic and casual layers untucked and preserve an easy, functional silhouette.',
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

function describeOutfitStyle(style?: string | null) {
  const normalized = style?.trim().replaceAll(/\s+/g, ' ').slice(0, 20)
  if (!normalized) {
    return 'No explicit style was selected. Follow the garments’ visible design and natural proportions.'
  }

  if (Object.hasOwn(previewStyleGuides, normalized)) {
    const outfitStyle = normalized as OutfitStyle
    return `${previewStyleLabels[outfitStyle]} (${outfitStyle}): ${previewStyleGuides[outfitStyle]}`
  }

  return `User-selected style label: "${normalized}". Interpret it only as a visual styling direction without changing any referenced garment.`
}

function buildPrompt(
  items: Awaited<
    ReturnType<typeof wardrobeRepository.findManyOwnedWithImagesByIds>
  >,
  profile: Awaited<ReturnType<typeof userRepository.findViewerById>>,
  style?: string | null,
) {
  const garments = items.map(describeGarment).join('\n')

  return `Create a photorealistic fashion lookbook image using every garment from the reference images exactly once.

Reference garment order and optional silhouette measurements:
${garments}

Model body guide: ${describeBody(profile)}.

Preferred styling fit: ${describePreferredFit(profile)}. Use this preference only when the reference images and garment measurements leave the fit ambiguous. Garment measurements and visible garment proportions always take priority. Do not resize or redesign a garment to force the preferred fit.

Selected outfit style: ${describeOutfitStyle(style)}

Decide whether to tuck a top by its actual design, thickness, hem shape, length, the selected style, and the full outfit proportions. Never tuck outerwear, hoodies, sweatshirts, or thick knits. Never use a half tuck or French tuck. When uncertain, keep the top fully untucked so its original length and hem remain visible.

Preserve each referenced garment's visible color, material, pattern, length, proportions, and distinctive details. Body chest, waist, and hip values are full circumferences, while garment chest, waist, and hip widths are flat measurements. When both are provided, use their relationship to depict plausible ease without treating the result as exact virtual fitting. Dress a single adult fashion model matching the body guide in the complete coordinated outfit.

Show the model in a three-quarter front view like a clean apparel catalog photo: rotate the torso, hips, and feet together about 20 to 30 degrees away from a straight-on view toward one side. Do not use a full side profile. Keep the torso upright, shoulders level, legs uncrossed, and both feet flat with a small natural gap. Use a neutral standing-at-attention pose, not an editorial fashion pose. Both arms must hang straight and relaxed beside the torso, with both hands fully visible next to the thighs. Keep both hands completely outside every pocket and away from the garments. Do not cross or fold the arms, bend an arm across the torso, put a hand on the waist or hip, touch or hold a jacket, cover the waistline, lean, step forward, or create a dynamic pose. Arms and hands must not obscure the top, outerwear, waistband, pockets, or lower garment.

Frame the complete outfit from the neck to the feet, keeping the model's face entirely outside the image. Use a warm off-white studio background, soft natural light, realistic fabric folds, and a clean Korean fashion lookbook composition. Do not add text, captions, logos, extra garments, duplicate items, shopping UI, borders, or a collage. Do not infer or reproduce a real person's identity or face.`
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
  async generate(
    userId: string,
    selectedItemIds: string[],
    style?: string | null,
  ) {
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
    const prompt = buildPrompt(items, profile, style)
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
