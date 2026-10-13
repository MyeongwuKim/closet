import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { FashionItemAttributes } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import { imageRepository } from '../image/image.repository.js'
import {
  wardrobeRepository,
  type CreateWardrobeItemData,
  type UpdateWardrobeItemData,
} from './wardrobe.repository.js'
import { getWardrobeWearStats, wardrobeService } from './wardrobe.service.js'

test('플래너 기록에서 아이템별 최근 착용일과 착용 횟수를 계산한다', () => {
  const stats = getWardrobeWearStats([
    {
      date: new Date('2026-08-23T00:00:00.000Z'),
      outfit: {
        items: [
          { wardrobeItemId: 'top-1' },
          { wardrobeItemId: 'bottom-1' },
        ],
      },
    },
    {
      date: new Date('2026-08-25T00:00:00.000Z'),
      outfit: { items: [{ wardrobeItemId: 'top-1' }] },
    },
  ])

  assert.equal(stats.get('top-1')?.wearCount, 2)
  assert.equal(
    stats.get('top-1')?.lastWornAt?.toISOString(),
    '2026-08-25T00:00:00.000Z',
  )
  assert.equal(stats.get('bottom-1')?.wearCount, 1)
})

test('같은 아이템의 같은 날짜 기록은 한 번만 센다', () => {
  const date = new Date('2026-08-25T00:00:00.000Z')
  const stats = getWardrobeWearStats([
    {
      date,
      outfit: { items: [{ wardrobeItemId: 'top-1' }] },
    },
    {
      date,
      outfit: { items: [{ wardrobeItemId: 'top-1' }] },
    },
  ])

  assert.equal(stats.get('top-1')?.wearCount, 1)
})

const legacyFashionAttributes: FashionItemAttributes = {
  layerRole: 'base',
  silhouette: 'relaxed',
  pattern: 'solid',
  material: 'knit',
  texture: 'ribbed',
  warmth: 'medium',
  formality: 0.4,
  confidence: 0.9,
}

const unknownShapeAttributes = {
  necklineStyle: 'unknown',
  frontOpeningStyle: 'unknown',
  pocketStyle: 'unknown',
} as const

function mockWardrobeCreate(t: TestContext) {
  t.mock.method(imageRepository, 'findOwnedByIds', async () => [
    { id: 'display-image', uploadStatus: 'ready', kind: 'wardrobeCutout', mimeType: 'image/png' },
  ])
  return t.mock.method(wardrobeRepository, 'create', async (data: CreateWardrobeItemData) => ({
    id: 'saved-item',
    ...data,
  }))
}

const createInput = {
  name: '그레이 골지 니트',
  displayImageAssetId: 'display-image',
  category: 'top' as const,
  seasons: ['autumn' as const],
}

test('새 옷은 배경 제거 PNG를 표시 자산으로 확인한 뒤에만 저장한다', async (t) => {
  t.mock.method(imageRepository, 'findOwnedByIds', async () => [
    { id: 'display-image', uploadStatus: 'ready', kind: 'wardrobeOriginal', mimeType: 'image/jpeg' },
  ])
  const create = t.mock.method(wardrobeRepository, 'create', async () => ({ id: 'saved-item' }) as never)

  await assert.rejects(wardrobeService.create('viewer', createInput), (error: unknown) =>
    error instanceof ServiceError && error.code === 'WARDROBE_CUTOUT_REQUIRED',
  )
  assert.equal(create.mock.callCount(), 0)
})

test('전체 골지와 독립적으로 세 부위의 시보리 판정을 저장한다', async (t) => {
  const create = mockWardrobeCreate(t)
  const fashionAttributes: FashionItemAttributes = {
    ...legacyFashionAttributes,
    ...unknownShapeAttributes,
    ribbedCuffs: 'present',
    ribbedHem: 'absent',
    ribbedNeckline: 'unknown',
  }

  await wardrobeService.create('viewer', { ...createInput, fashionAttributes })

  assert.deepEqual(create.mock.calls[0]?.arguments[0].fashionAttributes, fashionAttributes)
})

test('구버전 입력의 시보리 누락과 null은 unknown으로 저장한다', async (t) => {
  const cases = [
    { name: '필드 누락', attributes: legacyFashionAttributes },
    {
      name: 'nullable 필드',
      attributes: {
        ...legacyFashionAttributes,
        ribbedCuffs: null,
        ribbedHem: null,
        ribbedNeckline: null,
      },
    },
  ]

  for (const example of cases) {
    await t.test(example.name, async (t) => {
      const create = mockWardrobeCreate(t)
      await wardrobeService.create('viewer', {
        ...createInput,
        fashionAttributes: example.attributes,
      })

      assert.deepEqual(create.mock.calls[0]?.arguments[0].fashionAttributes, {
        ...legacyFashionAttributes,
        ...unknownShapeAttributes,
        ribbedCuffs: 'unknown',
        ribbedHem: 'unknown',
        ribbedNeckline: 'unknown',
      })
    })
  }
})

test('패션 분석 자체가 없는 기존 입력에는 속성을 임의 생성하지 않는다', async (t) => {
  const create = mockWardrobeCreate(t)
  await wardrobeService.create('viewer', { ...createInput, fashionAttributes: null })
  assert.equal(create.mock.calls[0]?.arguments[0].fashionAttributes, undefined)
})

test('브랜드명의 앞뒤 공백과 연속 공백을 정리해 저장한다', async (t) => {
  const create = mockWardrobeCreate(t)
  await wardrobeService.create('viewer', {
    ...createInput,
    brandName: '  무신사   스탠다드  ',
  })

  assert.equal(
    create.mock.calls[0]?.arguments[0].brandName,
    '무신사 스탠다드',
  )
})

test('저장된 브랜드명을 중복 없이 정리해 선택 목록으로 반환한다', async (t) => {
  t.mock.method(wardrobeRepository, 'findBrandNames', async () => [
    { brandName: 'COS' },
    { brandName: 'cos' },
    { brandName: '  무신사   스탠다드 ' },
    { brandName: null },
  ])

  assert.deepEqual(await wardrobeService.listBrands('viewer'), [
    '무신사 스탠다드',
    'COS',
  ])
})

test('브랜드 삭제는 사용자 범위에서 같은 브랜드의 표기를 찾아 보관한 옷까지 브랜드만 해제한다', async (t) => {
  const read = t.mock.method(wardrobeRepository, 'findBrandNames', async (_userId: string, _includeArchived?: boolean) => [
    { brandName: 'COS' }, { brandName: 'cos' }, { brandName: '  ＣＯＳ  ' },
    { brandName: 'COS' }, { brandName: 'COS STUDIO' }, { brandName: null },
  ])
  const clear = t.mock.method(wardrobeRepository, 'clearBrandName', async (_userId: string, _brandNames: string[]) => ({ count: 4 }))

  assert.equal(await wardrobeService.deleteBrand('viewer', '  cos '), 4)
  assert.deepEqual(read.mock.calls[0]?.arguments, ['viewer', true])
  assert.deepEqual(clear.mock.calls[0]?.arguments, ['viewer', ['COS', 'cos', '  ＣＯＳ  ']])
})

test('등록되지 않은 브랜드를 삭제하면 옷을 갱신하지 않고 0을 반환한다', async (t) => {
  t.mock.method(wardrobeRepository, 'findBrandNames', async () => [{ brandName: '러프사이드' }])
  const clear = t.mock.method(wardrobeRepository, 'clearBrandName', async () => ({ count: 0 }))
  assert.equal(await wardrobeService.deleteBrand('viewer', '스테디 에브리웨어'), 0)
  assert.equal(clear.mock.callCount(), 0)
})

test('비어 있거나 너무 긴 브랜드 삭제 요청은 조회 전에 거절한다', async (t) => {
  const read = t.mock.method(wardrobeRepository, 'findBrandNames', async () => [])
  for (const brand of [' \t ', 'A'.repeat(51)]) {
    await assert.rejects(wardrobeService.deleteBrand('viewer', brand), (error: unknown) =>
      error instanceof ServiceError && error.code === 'INVALID_WARDROBE_BRAND',
    )
  }
  assert.equal(read.mock.callCount(), 0)
})

test('옷 정보 수정 시 선택한 브랜드명을 정리해 DB 업데이트 값으로 전달한다', async (t) => {
  t.mock.method(wardrobeRepository, 'findById', async () => ({
    category: 'bottom',
    additionalCategories: [],
  }) as never)
  const update = t.mock.method(
    wardrobeRepository,
    'update',
    async (_itemId: string, data: UpdateWardrobeItemData) => data as never,
  )

  await wardrobeService.update('viewer', 'item-1', {
    brandName: '  리파사이드  ',
  })

  assert.equal(
    update.mock.calls[0]?.arguments[1].brandName,
    '리파사이드',
  )
})

test('잘못된 시보리 값은 unknown으로 덮어 저장하지 않고 거절한다', async (t) => {
  for (const field of ['ribbedCuffs', 'ribbedHem', 'ribbedNeckline'] as const) {
    await t.test(field, async (t) => {
      const create = mockWardrobeCreate(t)
      await assert.rejects(
        wardrobeService.create('viewer', {
          ...createInput,
          fashionAttributes: {
            ...legacyFashionAttributes,
            [field]: 'ribbed',
          } as FashionItemAttributes,
        }),
        (error: unknown) => error instanceof ServiceError && error.code === 'INVALID_FASHION_ATTRIBUTES',
      )
      assert.equal(create.mock.callCount(), 0)
    })
  }
})

test('하의의 형태 정보가 없으면 임의 추측 대신 unknown으로 저장한다', async (t) => {
  const create = mockWardrobeCreate(t)
  await wardrobeService.create('viewer', {
    ...createInput,
    category: 'bottom',
    fashionAttributes: {
      ...legacyFashionAttributes,
      layerRole: 'single',
    },
  })

  assert.deepEqual(create.mock.calls[0]?.arguments[0].fashionAttributes, {
    ...legacyFashionAttributes,
    ...unknownShapeAttributes,
    layerRole: 'single',
    ribbedCuffs: 'unknown',
    ribbedHem: 'unknown',
    ribbedNeckline: 'unknown',
    bottomLegShape: 'unknown',
    bottomWaistStyle: 'unknown',
    bottomFrontPleats: 'unknown',
  })
})

test('수정한 소재와 보온감을 패션 속성에 저장한다', async (t) => {
  t.mock.method(wardrobeRepository, 'findById', async () => ({
    category: 'top',
    additionalCategories: [],
  }) as never)
  const update = t.mock.method(
    wardrobeRepository,
    'update',
    async (_itemId: string, data: UpdateWardrobeItemData) => data as never,
  )

  await wardrobeService.update('viewer', 'item-1', {
    fashionAttributes: {
      ...legacyFashionAttributes,
      material: 'wool',
      warmth: 'heavy',
    },
  })

  assert.deepEqual(update.mock.calls[0]?.arguments[1].fashionAttributes, {
    ...legacyFashionAttributes,
    ...unknownShapeAttributes,
    material: 'wool',
    warmth: 'heavy',
    ribbedCuffs: 'unknown',
    ribbedHem: 'unknown',
    ribbedNeckline: 'unknown',
  })
})
