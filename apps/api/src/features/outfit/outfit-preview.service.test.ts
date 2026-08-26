import assert from 'node:assert/strict'
import test from 'node:test'
import { getLookbookBaseLayerGuide } from './outfit-preview.service.js'

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
