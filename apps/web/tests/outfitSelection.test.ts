import assert from 'node:assert/strict'
import test from 'node:test'
import { isBagItem, type WardrobeItem } from '@closet/types'
import { outfitSlots } from '../src/features/lookbook/components/outfitSlots'
import {
  getOutfitSelectionLimit,
  getOutfitSelectionCapacity,
  getOutfitSlotId,
  matchesOutfitSelectionCategory,
} from '../src/features/lookbook/utils/outfitSelection'

type SelectionItem = Pick<WardrobeItem, 'name' | 'category' | 'subcategory'>
const bag: SelectionItem = { name: '캔틴 백팩 차콜', category: 'accessory', subcategory: '가방' }
const belt: SelectionItem = { name: '레더 벨트', category: 'accessory', subcategory: '벨트' }
const scarf: SelectionItem = { name: '울 목도리', category: 'accessory', subcategory: '목도리' }
const gloves: SelectionItem = { name: '캐시미어 장갑', category: 'accessory', subcategory: '장갑' }

test('가방을 넣어도 벨트·목도리·장갑의 선택 칸은 별도로 유지한다', () => {
  assert.equal(getOutfitSlotId(bag), 'bag')
  for (const item of [belt, scarf, gloves]) {
    assert.equal(getOutfitSlotId(item), 'accessory')
    assert.equal(matchesOutfitSelectionCategory(item, 'bag'), false)
  }
  assert.equal(matchesOutfitSelectionCategory(bag, 'accessory'), false)
  assert.equal(getOutfitSelectionLimit('bag'), 1)
  assert.equal(getOutfitSelectionLimit('accessory'), 4)
  const accessoryItems = [bag, belt, scarf, gloves].filter(item => matchesOutfitSelectionCategory(item, 'accessory'))
  assert.deepEqual(accessoryItems, [belt, scarf, gloves])
})

test('구성 편집의 가방 교체는 기존 착용 액세서리를 제거하지 않는다', () => {
  const bagSlot = outfitSlots.find(slot => slot.id === 'bag')!
  const accessorySlot = outfitSlots.find(slot => slot.id === 'accessory')!
  const selected = [bag, belt, scarf, gloves] as WardrobeItem[]
  assert.deepEqual(selected.filter(item => !bagSlot.matches(item)), [belt, scarf, gloves])
  assert.deepEqual(selected.filter(item => !accessorySlot.matches(item)), [bag])
  assert.notEqual(bagSlot.position, accessorySlot.position)
})

test('기타로 저장된 구버전 가방도 이름으로 찾고 구체적인 착용 분류는 우선한다', () => {
  assert.equal(isBagItem({name: 'Canvas Tote Bag', category: 'other', subcategory: '기타'}), true)
  assert.equal(isBagItem({name: '검정 백팩', category: 'other', subcategory: null}), true)
  assert.equal(isBagItem({name: '가방에 보관하는 장갑', category: 'accessory', subcategory: '장갑'}), false)
  assert.equal(isBagItem({name: '백팩 프린트 티셔츠', category: 'top', subcategory: '반팔'}), false)
  assert.equal(isBagItem({name: '데일리 레더 지갑', category: 'accessory', subcategory: '지갑'}), false)
})

test('가방 선택은 다른 아이템을 유지하면서 전체 8개 제한을 넘지 않는다', () => {
  const baseItems: SelectionItem[] = [
    {name: '상의', category: 'top', subcategory: '셔츠'},
    {name: '하의', category: 'bottom', subcategory: '팬츠'},
    {name: '아우터', category: 'outer', subcategory: '재킷'},
    {name: '신발', category: 'shoes', subcategory: '스니커즈'},
  ]
  const accessories: SelectionItem[] = [belt, scarf, gloves, {name: '모자', category: 'accessory', subcategory: '모자'}]
  assert.equal(getOutfitSelectionCapacity('bag', [...baseItems, ...accessories]), 0)
  assert.equal(getOutfitSelectionCapacity('bag', [...baseItems, belt, scarf, gloves, bag]), 1)
  assert.equal(getOutfitSelectionCapacity('accessory', [...baseItems, bag]), 3)
})
