import assert from 'node:assert/strict'
import test from 'node:test'
import { readWardrobeFilterSelection, toggleWardrobeFilterSelection, writeWardrobeFilterSelection } from '../src/features/closet/utils/wardrobeFilters'

test('기존 단일 URL과 여러 선택을 섞어 읽고 표기가 다른 중복 브랜드는 한 번만 유지한다', () => {
  const params = new URLSearchParams('season=spring&color=네이비&brand=ＣＯＳ&tag=출근&brand=cos&color=베이지&tag=&unbranded=1')
  assert.deepEqual(readWardrobeFilterSelection(params), [
    { kind: 'color', value: '네이비' }, { kind: 'brand', value: 'COS' }, { kind: 'tag', value: '출근' },
    { kind: 'color', value: '베이지' }, { kind: 'unbranded', value: '1' },
  ])
})

test('다른 항목을 연달아 골라도 오른쪽에 붙고 다시 누른 조건만 해제한다', () => {
  const initial = new URLSearchParams('season=spring&category=top&q=셔츠&sort=oldest')
  const first = toggleWardrobeFilterSelection(initial, { kind: 'color', value: '네이비' })
  const second = toggleWardrobeFilterSelection(first, { kind: 'brand', value: 'ACME, Inc.' })
  const third = toggleWardrobeFilterSelection(second, { kind: 'color', value: '베이지' })
  assert.deepEqual(readWardrobeFilterSelection(new URLSearchParams(third.toString())), [
    { kind: 'color', value: '네이비' }, { kind: 'brand', value: 'ACME, Inc.' }, { kind: 'color', value: '베이지' },
  ])
  const removed = toggleWardrobeFilterSelection(third, { kind: 'color', value: '네이비' })
  assert.deepEqual(readWardrobeFilterSelection(removed), [{ kind: 'brand', value: 'ACME, Inc.' }, { kind: 'color', value: '베이지' }])
  const cleared = writeWardrobeFilterSelection(removed, [])
  assert.equal(cleared.toString(), initial.toString())
  assert.equal(initial.get('color'), null)
})
