import { ServiceError } from '../graphql/errors.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function parseDateOnly(value: string, label = '날짜') {
  if (!DATE_PATTERN.test(value)) {
    throw new ServiceError(
      `${label}는 YYYY-MM-DD 형식이어야 합니다.`,
      'INVALID_DATE',
    )
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ServiceError(`올바른 ${label}를 입력해주세요.`, 'INVALID_DATE')
  }

  return date
}

export function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}
