import { ServiceError } from '../graphql/errors.js'

export interface PageInput {
  limit?: number | null
  cursor?: string | null
  sort?: 'latest' | 'oldest' | null
}

export function readPageInput(input: PageInput = {}) {
  const limit = input.limit ?? 20
  const sort = input.sort ?? 'latest'
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ServiceError('한 번에 1~50개까지 조회할 수 있습니다.', 'INVALID_PAGE')
  }
  const order = sort === 'oldest' ? 'asc' as const : 'desc' as const
  let boundary: { createdAt: Date; id: string } | undefined
  if (input.cursor) {
    try {
      const value = JSON.parse(Buffer.from(input.cursor, 'base64url').toString())
      if (value.sort !== sort || !/^[a-f\d]{24}$/i.test(value.id) ||
        typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) throw new Error()
      boundary = { createdAt: new Date(value.createdAt), id: value.id }
    } catch {
      throw new ServiceError('목록을 처음부터 다시 불러와주세요.', 'INVALID_CURSOR')
    }
  }
  const comparison = order === 'asc' ? 'gt' : 'lt'
  return {
    limit, sort, order,
    after: boundary ? {
      OR: [
        { createdAt: { [comparison]: boundary.createdAt } },
        { createdAt: boundary.createdAt, id: { [comparison]: boundary.id } },
      ],
    } : {},
  }
}

export function makePage<T extends { id: string; createdAt: Date }>(
  rows: T[], totalCount: number, page: ReturnType<typeof readPageInput>,
) {
  const items = rows.slice(0, page.limit)
  const last = items.at(-1)
  const hasNextPage = rows.length > page.limit
  return {
    items, totalCount, hasNextPage,
    nextCursor: hasNextPage && last ? Buffer.from(JSON.stringify({
      id: last.id, createdAt: last.createdAt.toISOString(), sort: page.sort,
    })).toString('base64url') : null,
  }
}
