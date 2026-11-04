import { prisma } from '../../lib/prisma.js'

export interface CloudflareCleanupCursor {
  continuationToken?: string
  revision: number
}

/** CF 계정별 조회 위치를 DB에 보관해 새 배치 프로세스도 다음 페이지부터 이어간다. */
export const cloudflareCleanupCursorRepository = {
  async read(id: string): Promise<CloudflareCleanupCursor> {
    const cursor = await prisma.cloudflareCleanupCursor.findUnique({ where: { id } })
    return { continuationToken: cursor?.continuationToken ?? undefined, revision: cursor?.revision ?? 0 }
  },

  /** 읽었던 revision이 여전히 현재 값일 때만 진행한다. 끝에 도달하면 null로 첫 페이지를 예약한다. */
  async advance(id: string, cursor: CloudflareCleanupCursor, continuationToken?: string): Promise<boolean> {
    if (cursor.revision === 0) {
      try {
        await prisma.cloudflareCleanupCursor.create({ data: { id, continuationToken: continuationToken ?? null, revision: 1 } })
        return true
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return false
        throw error
      }
    }
    const result = await prisma.cloudflareCleanupCursor.updateMany({
      where: { id, revision: cursor.revision },
      data: { continuationToken: continuationToken ?? null, revision: { increment: 1 } },
    })
    return result.count === 1
  },
}
