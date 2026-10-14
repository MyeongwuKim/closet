import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatPlanPeriodLabel } from '../src/features/plan/utils/formatPlanPeriodLabel'

test('하루는 연도·보기 라벨과 숫자 날짜, 요일을 표시한다', () => {
  assert.deepEqual(formatPlanPeriodLabel('today', new Date(2026, 9, 14)), {
    eyebrow: '2026년 · 하루 플래너',
    startNumber: '10.14',
    startCaption: '수요일',
    accessibleLabel: '2026년 10월 14일 수요일',
  })
})

test('월간은 연도와 월을 분리해 표시한다', () => {
  assert.deepEqual(formatPlanPeriodLabel('month', new Date(2026, 8, 1)), {
    eyebrow: '2026년 · 월간 플래너',
    startNumber: '9',
    unit: '월',
    accessibleLabel: '2026년 9월',
  })
})

test('월을 넘는 주는 양끝 날짜의 월을 숫자로 표시한다', () => {
  assert.deepEqual(formatPlanPeriodLabel('week', new Date(2026, 7, 31)), {
    eyebrow: '2026년 · 주간 플래너',
    startNumber: '08.31',
    endNumber: '09.06',
    startCaption: '월요일',
    endCaption: '일요일',
    accessibleLabel: '2026년 8월 31일 – 2026년 9월 6일',
  })
})

test('연도를 넘는 주는 두 연도를 알려주고 입력 날짜를 변경하지 않는다', () => {
  const start = new Date(2026, 11, 28)

  assert.deepEqual(formatPlanPeriodLabel('week', start), {
    eyebrow: '2026–2027년 · 주간 플래너',
    startNumber: '12.28',
    endNumber: '01.03',
    startCaption: '월요일',
    endCaption: '일요일',
    accessibleLabel: '2026년 12월 28일 – 2027년 1월 3일',
  })
  assert.equal(start.getTime(), new Date(2026, 11, 28).getTime())
})
