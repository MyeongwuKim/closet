import assert from 'node:assert/strict'
import test from 'node:test'
import { getCenteredScrollTop } from '../src/features/lookbook/utils/outfitPickerScroll'

test('현재 선택된 옷 카드가 목록 중앙에 오도록 스크롤 위치를 계산한다', () => {
  assert.equal(
    getCenteredScrollTop({
      currentScrollTop: 0,
      containerTop: 200,
      containerHeight: 600,
      itemTop: 700,
      itemHeight: 250,
    }),
    325,
  )
})

test('선택된 옷이 목록 위쪽이면 음수로 스크롤하지 않는다', () => {
  assert.equal(
    getCenteredScrollTop({
      currentScrollTop: 0,
      containerTop: 200,
      containerHeight: 600,
      itemTop: 230,
      itemHeight: 250,
    }),
    0,
  )
})
