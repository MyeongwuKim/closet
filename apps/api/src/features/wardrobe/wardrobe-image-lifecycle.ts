import type { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { ServiceError } from '../../graphql/errors.js'
import { touchAiMutex } from '../../lib/ai/ai-storage.js'

/** 코디북과 실제 날짜에 배정된 복사본만 옷 사진을 보존한다. 어느 날짜에도 없는 숨은 복사본은 정리 대상 판정에서 제외한다. */
export const liveOutfitReferenceWhere = {
  OR: [
    { plannerOnly: false }, { plannerOnly: null }, { plannerOnly: { isSet: false } },
    { planEntries: { some: {} } },
  ],
} satisfies Prisma.OutfitWhereInput

const activeWardrobeReferenceWhere = {
  OR: [{ archivedAt: null }, { archivedAt: { isSet: false } }],
} satisfies Prisma.WardrobeItemWhereInput

/** 참조 생성과 정리가 같은 전용 잠금 행을 쓰도록 한다. 원본 수정 시각을 바꾸지 않아 AI 요청 fingerprint·추천 캐시를 불필요하게 바꾸지 않는다. */
export async function lockWardrobeReferenceMutexes(
  tx: Prisma.TransactionClient,
  references: { itemIds?: string[]; assetIds?: string[] },
) {
  for (const [kind, ids] of [['item', references.itemIds ?? []], ['asset', references.assetIds ?? []]] as const) {
    for (const id of [...new Set(ids)].sort()) {
      await touchAiMutex(tx, `wardrobe-image:${kind}:${id}`, randomUUID(), new Date())
    }
  }
}

/** 옷 사진을 새로 연결하는 트랜잭션에서 정리 작업과 같은 잠금을 얻는다. 이미 정리 중이거나 소유하지 않은 사진은 연결하지 않는다. */
export async function lockWardrobeImagesForReference(tx: Prisma.TransactionClient, userId: string, assetIds: string[]) {
  await lockWardrobeReferenceMutexes(tx, { assetIds })
  for (const id of [...new Set(assetIds)].sort()) {
    const where = {
      id, userId, kind: { in: ['wardrobeOriginal', 'wardrobeCutout'] }, uploadStatus: 'ready',
    } satisfies Prisma.ImageAssetWhereInput
    const asset = await tx.imageAsset.findFirst({ where, select: { id: true, updatedAt: true, retention: true } })
    if (!asset || !['permanent', 'temporary'].includes(asset.retention ?? 'permanent')) throw new ServiceError('옷 사진이 정리 중이거나 존재하지 않습니다.', 'INVALID_WARDROBE_IMAGE')
  }
}

/**
 * 코디·플래너·생성 작업의 새 옷 연결과 사진 정리가 같은 전용 잠금 행을 쓰도록 한다.
 * 기본은 활성 옷만 허용한다. allowArchived는 이미 살아 있는 코디가 쓰는 삭제 옷을 복사·이동할 때만 사용한다.
 */
export async function lockWardrobeItemsForReference(
  tx: Prisma.TransactionClient,
  userId: string,
  itemIds: string[],
  options: { allowArchived?: boolean } = {},
) {
  await lockWardrobeReferenceMutexes(tx, { itemIds })
  const assetIds: string[] = []
  for (const id of [...new Set(itemIds)].sort()) {
    const where = {
      id, userId, ...(!options.allowArchived ? activeWardrobeReferenceWhere : {}),
    } satisfies Prisma.WardrobeItemWhereInput
    const item = await tx.wardrobeItem.findFirst({
      where,
      select: { id: true, archivedAt: true, updatedAt: true, displayImageAssetId: true, originalImageAssetId: true },
    })
    if (!item) throw new ServiceError('현재 옷장에 있는 내 옷으로만 코디를 구성할 수 있습니다.', 'INVALID_OUTFIT_ITEMS')
    if (item.archivedAt) {
      const reference = await tx.outfitItem.findFirst({
        where: { wardrobeItemId: id, outfit: { is: liveOutfitReferenceWhere } }, select: { id: true },
      })
      if (!options.allowArchived || !reference) throw new ServiceError('기록에서 더 이상 사용하지 않는 삭제된 옷은 추가할 수 없습니다.', 'INVALID_OUTFIT_ITEMS')
    }
    if (item.displayImageAssetId) assetIds.push(item.displayImageAssetId)
    if (item.originalImageAssetId) assetIds.push(item.originalImageAssetId)
  }
  await lockWardrobeImagesForReference(tx, userId, assetIds)
}
