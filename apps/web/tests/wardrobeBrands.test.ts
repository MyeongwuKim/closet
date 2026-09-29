import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getWardrobeBrandOptions,
  normalizeWardrobeBrand,
} from '../src/features/closet/utils/wardrobeBrands'

test('직접 입력한 브랜드명의 연속 공백을 정리한다', () => {
  assert.equal(normalizeWardrobeBrand('  무신사   스탠다드  '), '무신사 스탠다드')
})

test('저장된 브랜드를 대소문자 중복 없이 선택 목록으로 만든다', () => {
  assert.deepEqual(
    getWardrobeBrandOptions(['COS', 'cos', '무신사 스탠다드'], '아더에러'),
    ['무신사 스탠다드', '아더에러', 'COS'],
  )
})
