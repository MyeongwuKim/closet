import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import type { FashionItemAttributes } from '@closet/types'
import { ServiceError } from '../../graphql/errors.js'
import { imageRepository } from '../image/image.repository.js'
import { wardrobeRepository, type CreateWardrobeItemData } from './wardrobe.repository.js'
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

function mockWardrobeCreate(t: TestContext) {
  t.mock.method(imageRepository, 'findOwnedByIds', async () => [
    { id: 'display-image', uploadStatus: 'ready' },
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

test('전체 골지와 독립적으로 세 부위의 시보리 판정을 저장한다', async (t) => {
  const create = mockWardrobeCreate(t)
  const fashionAttributes: FashionItemAttributes = {
    ...legacyFashionAttributes,
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
